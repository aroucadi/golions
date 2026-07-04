import { NextResponse } from 'next/server';
import { kvGet, kvSet } from '../kv';

interface Monitor {
  route: string;
  date: string;
  interval: number;
  enabled: boolean;
  status: string;
  flightsFound: number;
  lastChecked: string | null;
}

interface LogEntry {
  timestamp: string;
  route: string;
  date: string;
  status: 'NO_FLIGHTS' | 'FLIGHTS_AVAILABLE' | 'ERROR' | 'RATE_LIMITED';
  flightsFound: number;
  responseTimeMs: number;
}

export async function GET(request: Request) {
  // Verify authorization header from Vercel Cron if necessary
  const authHeader = request.headers.get('authorization');
  if (process.env.VERCEL_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load monitors and session headers from KV
  const monitors = (await kvGet<Monitor[]>('golions_monitors')) || [];
  const rawHeaders = (await kvGet<string>('golions_headers')) || '';
  const discordUrl = (await kvGet<string>('golions_discord')) || '';
  const slackUrl = (await kvGet<string>('golions_slack')) || '';

  const activeMonitors = monitors.filter((m) => m.enabled);

  if (activeMonitors.length === 0) {
    return NextResponse.json({ message: 'No active monitors configured.' });
  }

  if (!rawHeaders) {
    return NextResponse.json({ message: 'Active session headers not configured.' });
  }

  const logs = (await kvGet<LogEntry[]>('golions_logs')) || [];
  const updatedMonitors = [...monitors];
  const newLogs: LogEntry[] = [];

  for (const monitor of activeMonitors) {
    const startTime = Date.now();
    const [origin, destination] = monitor.route.split('-');

    const searchPayload = {
      travelers: [{ passengerTypeCode: 'ADT' }],
      itineraries: [
        {
          originLocationCode: origin || 'CMN',
          destinationLocationCode: destination || 'BOS',
          departureDateTime: `${monitor.date}T00:00:00.000`,
          isRequestedBound: true
        }
      ],
      commercialFareFamilies: ['RAMNEWFF', 'RAMNEWFFBS'],
      searchPreferences: { showUnavailableEntries: false }
    };

    // Parse raw custom headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const lines = rawHeaders.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'host' && lowerKey !== 'content-length' && lowerKey !== 'accept-encoding') {
          headers[key] = value;
        }
      }
    }

    try {
      const response = await fetch('https://api-des.royalairmaroc.com/airlines/AT/v2/search/air-calendars', {
        method: 'POST',
        headers,
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      const elapsed = Date.now() - startTime;
      const payload = await response.json().catch(() => null);

      let status: LogEntry['status'] = 'NO_FLIGHTS';
      let flightsFound = 0;

      if (!response.ok || response.status === 429) {
        status = response.status === 429 ? 'RATE_LIMITED' : 'ERROR';
      } else {
        if (payload && payload.airCalendarBounds) {
          flightsFound = payload.airCalendarBounds.length;
        } else if (payload && payload.itineraries) {
          flightsFound = payload.itineraries.length;
        } else if (payload && Array.isArray(payload.errors)) {
          const isNoFlights = payload.errors.some((e: any) => e.code === '7959');
          status = isNoFlights ? 'NO_FLIGHTS' : 'ERROR';
        } else if (payload) {
          flightsFound = 1;
        }
        status = flightsFound > 0 ? 'FLIGHTS_AVAILABLE' : 'NO_FLIGHTS';
      }

      const checkLog: LogEntry = {
        timestamp: new Date().toISOString(),
        route: monitor.route,
        date: monitor.date,
        status,
        flightsFound,
        responseTimeMs: elapsed
      };

      newLogs.push(checkLog);

      // Update monitor status in KV
      const mIndex = updatedMonitors.findIndex((m) => m.route === monitor.route && m.date === monitor.date);
      if (mIndex >= 0) {
        updatedMonitors[mIndex] = {
          ...updatedMonitors[mIndex],
          status,
          flightsFound,
          lastChecked: new Date().toISOString()
        };
      }

      // Send alert webhooks on seat discovery
      if (status === 'FLIGHTS_AVAILABLE') {
        await sendServerlessAlerts({ discordUrl, slackUrl, log: checkLog });
      }

    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      newLogs.push({
        timestamp: new Date().toISOString(),
        route: monitor.route,
        date: monitor.date,
        status: 'ERROR',
        flightsFound: 0,
        responseTimeMs: elapsed
      });
    }
  }

  // Update records in KV
  await kvSet('golions_monitors', updatedMonitors);
  await kvSet('golions_logs', [...newLogs, ...logs].slice(0, 100));

  return NextResponse.json({
    success: true,
    checkedCount: activeMonitors.length,
    results: newLogs
  });
}

async function sendServerlessAlerts({ discordUrl, slackUrl, log }: { discordUrl: string; slackUrl: string; log: LogEntry }) {
  const alertBody = {
    embeds: [
      {
        title: `🦁 GO LIONS Alert: Flight Discovered!`,
        description: `Discovered flight seats for ${log.route} on ${log.date}! Check availability and book now.`,
        color: 3066993,
        fields: [
          { name: 'Route', value: log.route, inline: true },
          { name: 'Date', value: log.date, inline: true }
        ]
      }
    ]
  };

  if (discordUrl) {
    await fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertBody)
    }).catch(() => {});
  }

  if (slackUrl) {
    await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🦁 GO LIONS: Flight seats found! ${log.route} on ${log.date}` })
    }).catch(() => {});
  }
}

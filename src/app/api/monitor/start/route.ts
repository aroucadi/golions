import { NextResponse } from 'next/server';
import { kvGet, kvSet } from '../../kv';

export async function POST(request: Request) {
  try {
    const { route, date, interval } = await request.json();
    if (!route || !date) {
      return NextResponse.json({ error: 'Missing route or date' }, { status: 400 });
    }

    const monitors = (await kvGet<any[]>('golions_monitors')) || [];
    
    const exists = monitors.some((m) => m.route === route && m.date === date);
    if (!exists) {
      monitors.push({
        route,
        date,
        interval: interval || 60000,
        enabled: true,
        status: 'PENDING',
        flightsFound: 0,
        lastChecked: null
      });
      await kvSet('golions_monitors', monitors);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

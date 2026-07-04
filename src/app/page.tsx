"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  Users, 
  Bell, 
  History, 
  Play, 
  Square, 
  Plus, 
  Trash2, 
  Copy, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  Flame,
  Volume2,
  Lock,
  Unlock,
  AlertCircle,
  Settings,
  Code
} from 'lucide-react';

interface Monitor {
  route: string;
  date: string;
  interval: number;
  enabled: boolean;
  status: string;
  flightsFound: number;
  lastChecked: string | null;
}

interface Profile {
  id: string;
  name: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  loyaltyNumber?: string;
  encrypted: boolean;
  createdAt: string;
}

interface QueueState {
  detected: boolean;
  provider: string;
  queueId?: string;
  estimatedWaitSeconds?: number;
  position?: number;
  lastUpdated: string;
}

interface LogEntry {
  timestamp: string;
  route: string;
  date: string;
  status: 'NO_FLIGHTS' | 'FLIGHTS_AVAILABLE' | 'ERROR' | 'RATE_LIMITED';
  flightsFound: number;
  responseTimeMs: number;
}

export default function Dashboard() {
  // Operational Mode: Local server vs Serverless (Vercel)
  const [isServerless, setIsServerless] = useState(true);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [queue, setQueue] = useState<QueueState>({ detected: false, provider: 'NONE', lastUpdated: '' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rawHeaders, setRawHeaders] = useState('');
  const [headersStatus, setHeadersStatus] = useState<'NONE' | 'SAVED' | 'TESTING' | 'ERROR'>('NONE');
  
  // Settings & Configs
  const [discordUrl, setDiscordUrl] = useState('');
  const [slackUrl, setSlackUrl] = useState('');

  // Form states
  const [route, setRoute] = useState('CMN-BOS');
  const [date, setDate] = useState('2026-07-08');
  const [interval, setIntervalVal] = useState(60000);
  
  const [profName, setProfName] = useState('');
  const [profPassport, setProfPassport] = useState('');
  const [profNat, setProfNat] = useState('MA');
  const [profDob, setProfDob] = useState('1995-05-15');
  const [profEmail, setProfEmail] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profLoyalty, setProfLoyalty] = useState('');
  const [decryptProfiles, setDecryptProfiles] = useState(false);

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const backendUrl = 'http://localhost:3001';

  // Initialize and load configurations
  useEffect(() => {
    // Detect operational mode by testing Fastify health endpoint
    checkBackendHealth();
    loadLocalProfiles();
    loadLocalSettings();

    // Register audio alert
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');

    return () => {
      // Cleanup intervals
      browserIntervals.current.forEach((intVal) => clearInterval(intVal));
    };
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setIsServerless(false);
        fetchBackendStatus();
        fetchBackendQueue();
      }
    } catch {
      setIsServerless(true);
      console.log('🦁 GO LIONS: Backend offline/local not found. Running in standalone Serverless Mode.');
    }
  };

  // --- Local / Standalone Storage and Scheduling (Vercel Mode) ---

  const loadLocalProfiles = () => {
    const data = localStorage.getItem('golions_profiles');
    if (data) {
      try {
        setProfiles(JSON.parse(data));
      } catch {
        setProfiles([]);
      }
    }
  };

  const saveLocalProfiles = (updated: Profile[]) => {
    setProfiles(updated);
    localStorage.setItem('golions_profiles', JSON.stringify(updated));
  };

  const loadLocalSettings = () => {
    setDiscordUrl(localStorage.getItem('golions_discord') || '');
    setSlackUrl(localStorage.getItem('golions_slack') || '');
    const savedHeaders = localStorage.getItem('golions_headers');
    if (savedHeaders) {
      setRawHeaders(savedHeaders);
      setHeadersStatus('SAVED');
    }
  };

  const saveSettings = (disc: string, slac: string) => {
    setDiscordUrl(disc);
    setSlackUrl(slac);
    localStorage.setItem('golions_discord', disc);
    localStorage.setItem('golions_slack', slac);
  };

  // --- Search execution client-side (CORS-Proxy bypass) ---

  const executeBrowserSearch = async (config: Omit<Monitor, 'status' | 'flightsFound' | 'lastChecked'>) => {
    const startTime = Date.now();
    const [origin, destination] = config.route.split('-');

    const searchPayload = {
      travelers: [{ passengerTypeCode: 'ADT' }],
      itineraries: [
        {
          originLocationCode: origin || 'CMN',
          destinationLocationCode: destination || 'BOS',
          departureDateTime: `${config.date}T00:00:00.000`,
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

    const parsedHeaders = parseRawHeadersText(rawHeaders);
    Object.assign(headers, parsedHeaders);

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://api-des.royalairmaroc.com/airlines/AT/v2/search/air-calendars',
          method: 'POST',
          headers,
          payload: searchPayload
        })
      });

      const resData = await response.json();
      const elapsed = Date.now() - startTime;

      let status: LogEntry['status'] = 'NO_FLIGHTS';
      let flightsFound = 0;

      if (!response.ok || resData.status === 429 || resData.error) {
        status = resData.status === 429 ? 'RATE_LIMITED' : 'ERROR';
      } else {
        const payload = resData.data;
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
        route: config.route,
        date: config.date,
        status,
        flightsFound,
        responseTimeMs: elapsed
      };

      // Play audio and send alerts on availability transition
      if (status === 'FLIGHTS_AVAILABLE') {
        audioRef.current?.play().catch(() => {});
        triggerWebhookAlerts(checkLog);
      }

      // Update state
      setLogs((prev) => [checkLog, ...prev.slice(0, 50)]);
      setMonitors((prev) =>
        prev.map((m) =>
          m.route === config.route && m.date === config.date
            ? { ...m, status, flightsFound, lastChecked: new Date().toISOString() }
            : m
        )
      );

    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorLog: LogEntry = {
        timestamp: new Date().toISOString(),
        route: config.route,
        date: config.date,
        status: 'ERROR',
        flightsFound: 0,
        responseTimeMs: elapsed
      };
      setLogs((prev) => [errorLog, ...prev.slice(0, 50)]);
    }
  };

  const triggerWebhookAlerts = async (log: LogEntry) => {
    const alertBody = {
      embeds: [
        {
          title: `🦁 GO LIONS: Flight Found CMN-BOS!`,
          description: `Discovered flight seats for ${log.route} on ${log.date}! Check availability immediately.`,
          color: 3066993,
          fields: [
            { name: 'Route', value: log.route, inline: true },
            { name: 'Date', value: log.date, inline: true }
          ]
        }
      ]
    };

    if (discordUrl) {
      fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertBody)
      }).catch(() => {});
    }

    if (slackUrl) {
      fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🦁 GO LIONS: Flight discovered! ${log.route} on ${log.date}` })
      }).catch(() => {});
    }
  };

  // --- Helper parsers ---

  const parseRawHeadersText = (text: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    return headers;
  };

  // --- Backend Mode (Fastify Mode fallback) ---

  const fetchBackendStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/monitor/status`);
      const data = await res.json();
      setMonitors(data.monitors || []);
    } catch {}
  };

  const fetchBackendQueue = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/queue/status`);
      const data = await res.json();
      setQueue(data);
    } catch {}
  };

  // --- General Form Actions ---

  const handleSaveHeaders = async () => {
    if (!rawHeaders.trim()) return;
    setHeadersStatus('TESTING');
    localStorage.setItem('golions_headers', rawHeaders);

    if (!isServerless) {
      // Sync headers to Fastify server
      try {
        const res = await fetch(`${backendUrl}/api/session/headers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawHeaders })
        });
        const data = await res.json();
        if (res.ok) {
          setHeadersStatus('SAVED');
          if (data.queueState) setQueue(data.queueState);
        } else {
          setHeadersStatus('ERROR');
        }
      } catch {
        setHeadersStatus('ERROR');
      }
    } else {
      // Standalone (Vercel) Mode queue cookie parser check
      setHeadersStatus('SAVED');
      const isQueue = rawHeaders.includes('queueit') || rawHeaders.includes('QueueIT');
      setQueue({
        detected: isQueue,
        provider: isQueue ? 'QUEUE_IT' : 'NONE',
        lastUpdated: new Date().toISOString()
      });
    }
  };

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route || !date) return;

    if (!isServerless) {
      // Local Fastify Server Monitor
      try {
        const res = await fetch(`${backendUrl}/api/monitor/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ route, date, interval })
        });
        if (res.ok) fetchBackendStatus();
      } catch (err) {
        console.error('Error starting backend monitor:', err);
      }
    } else {
      // Client-side Browser loop (Vercel Mode)
      const key = `${route}_${date}`;
      if (browserIntervals.current.has(key)) return;

      const newMonitor: Monitor = {
        route,
        date,
        interval,
        enabled: true,
        status: 'PENDING',
        flightsFound: 0,
        lastChecked: null
      };

      setMonitors((prev) => [...prev, newMonitor]);
      
      // Immediate execution
      executeBrowserSearch(newMonitor);

      // Set loop interval
      const intVal = setInterval(() => {
        executeBrowserSearch(newMonitor);
      }, Math.max(interval, 10000));

      browserIntervals.current.set(key, intVal);
    }
  };

  const handleStopMonitor = async (mRoute: string, mDate: string) => {
    if (!isServerless) {
      try {
        const res = await fetch(`${backendUrl}/api/monitor/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ route: mRoute, date: mDate })
        });
        if (res.ok) fetchBackendStatus();
      } catch {}
    } else {
      const key = `${mRoute}_${mDate}`;
      const intVal = browserIntervals.current.get(key);
      if (intVal) {
        clearInterval(intVal);
        browserIntervals.current.delete(key);
      }
      setMonitors((prev) => prev.filter((m) => !(m.route === mRoute && m.date === mDate)));
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName || !profPassport) return;

    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name: profName,
      passportNumber: profPassport,
      nationality: profNat,
      dateOfBirth: profDob,
      email: profEmail,
      phone: profPhone,
      loyaltyNumber: profLoyalty || undefined,
      encrypted: false,
      createdAt: new Date().toISOString()
    };

    saveLocalProfiles([...profiles, newProfile]);
    
    // reset form
    setProfName('');
    setProfPassport('');
    setProfEmail('');
    setProfPhone('');
    setProfLoyalty('');
  };

  const handleDeleteProfile = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    saveLocalProfiles(updated);
  };

  const handleTestAlert = async () => {
    audioRef.current?.play().catch(() => {});
    const mockLog: LogEntry = {
      timestamp: new Date().toISOString(),
      route: 'CMN-BOS',
      date: '2026-07-08',
      status: 'FLIGHTS_AVAILABLE',
      flightsFound: 2,
      responseTimeMs: 150
    };
    await triggerWebhookAlerts(mockLog);
    alert('Mock notification webhook dispatched, and native audio played.');
  };

  // Generate Sync Bookmarklet text
  const getBookmarkletText = () => {
    const currentHost = typeof window !== 'undefined' ? window.location.origin : '';
    return `javascript:(async () => {
      const cookies = document.cookie;
      let token = null;
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const val = sessionStorage.getItem(key);
        if (val && (val.includes('Bearer') || val.length > 20)) {
          token = val;
          break;
        }
      }
      if (!token) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const val = localStorage.getItem(key);
          if (val && (val.includes('Bearer') || val.length > 20)) {
            token = val;
            break;
          }
        }
      }
      if (!token) {
        alert('🦁 GO LIONS: Could not find authentication token. Run a search first.');
        return;
      }
      const backend = '${currentHost}/api/session/headers';
      try {
        const res = await fetch(backend, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawHeaders: 'Authorization: ' + token + '\\nCookie: ' + cookies })
        });
        if (res.ok) alert('🦁 GO LIONS: Session successfully synced!');
        else alert('🦁 GO LIONS: Sync failed.');
      } catch (e) {
        alert('🦁 GO LIONS: Connection error: ' + e.message);
      }
    })();`.replace(/\s+/g, ' ');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 flex items-center gap-2">
            <span className="text-amber-500 font-mono">🦁</span> GO LIONS Booking Intelligence
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Local booking coordinator & monitor for high-demand supporters campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button 
            onClick={handleTestAlert}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded text-xs text-slate-300 font-semibold transition"
          >
            <Bell className="w-3.5 h-3.5" /> Test Webhooks & Audio
          </button>
          <div className={`px-3 py-1.5 rounded text-xs font-mono font-semibold flex items-center gap-1.5 ${
            isServerless 
              ? 'bg-amber-950/40 border border-amber-800/80 text-amber-400'
              : 'bg-emerald-950/50 border border-emerald-800/80 text-emerald-400'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isServerless ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            {isServerless ? 'SERVERLESS OPERATION (VERCEL)' : 'LOCAL SERVER ONLINE'}
          </div>
        </div>
      </header>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Headers & Session Configuration */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Active Session Panel */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Shield className="text-amber-500 w-5 h-5" /> 1. Session Configuration
              </h2>
              {headersStatus === 'SAVED' && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Paste the request headers copied from Chrome DevTools (for instance, right-click on the <code>air-calendars</code> request &rarr; Copy &rarr; Copy Request Headers). This bypasses WAF and loads actual session tokens safely.
            </p>

            <textarea
              className="w-full h-40 bg-slate-950 border border-slate-800 rounded p-3 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-amber-600"
              placeholder="Authorization: Bearer kI432Zivu...&#10;x-d-token: 3:02x...&#10;x-incap-spa-info: visid_incap...&#10;Cookie: JSESSIONID=..."
              value={rawHeaders}
              onChange={(e) => setRawHeaders(e.target.value)}
            />

            <button
              onClick={handleSaveHeaders}
              disabled={headersStatus === 'TESTING'}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 text-slate-950 font-bold rounded text-xs transition"
            >
              {headersStatus === 'TESTING' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> SAVING SESSION...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" /> REGISTER SESSION HEADERS
                </>
              )}
            </button>

            {headersStatus === 'SAVED' && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-900 text-emerald-400 rounded text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Session cookies parsed and synced successfully!
              </div>
            )}
          </div>

          {/* Mobile Bookmarklet Widget */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Code className="text-amber-500 w-4 h-4" /> Mobile Session Sync Tool
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              To easily sync headers from your mobile phone, save the script below as a browser bookmark. Open <code>royalairmaroc.com</code> on your mobile browser, run a search, then click the bookmark!
            </p>
            <button
              onClick={() => {
                copyToClipboard(getBookmarkletText());
                alert('Bookmarklet code copied to clipboard!');
              }}
              className="w-full py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded text-[10px] font-mono transition"
            >
              COPY BOOKMARKLET CODE
            </button>
          </div>

          {/* Webhook Alert settings */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Settings className="text-amber-500 w-4 h-4" /> Webhook Integrations
            </h2>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">DISCORD WEBHOOK URL</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordUrl}
                  onChange={(e) => saveSettings(e.target.value, slackUrl)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">SLACK WEBHOOK URL</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackUrl}
                  onChange={(e) => saveSettings(discordUrl, e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Center/Right Column: Flight Monitors & Search Scheduler */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Availability Monitors */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Activity className="text-amber-500 w-5 h-5" /> 2. Active Search Watchers
            </h2>

            {/* Monitor Creator */}
            <form onSubmit={handleAddMonitor} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 border border-slate-800 rounded-lg">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">ROUTE</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:outline-none focus:border-amber-500"
                  placeholder="CMN-BOS"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">TRAVEL DATE</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:outline-none focus:border-amber-500"
                  placeholder="2026-07-08"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">INTERVAL</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:outline-none focus:border-amber-500"
                  value={interval}
                  onChange={(e) => setIntervalVal(parseInt(e.target.value, 10))}
                >
                  <option value={10000}>10 Seconds (Fast)</option>
                  <option value={30000}>30 Seconds</option>
                  <option value={60000}>60 Seconds (Safe)</option>
                  <option value={120000}>2 Minutes</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-3 rounded text-xs transition"
                >
                  <Plus className="w-4 h-4" /> ADD WATCHER
                </button>
              </div>
            </form>

            {/* Active Watcher list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-mono">
                    <th className="py-2">ROUTE</th>
                    <th className="py-2">DATE</th>
                    <th className="py-2">INTERVAL</th>
                    <th className="py-2">STATUS</th>
                    <th className="py-2">FLIGHTS FOUND</th>
                    <th className="py-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {monitors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 font-mono">
                        No active search watchers running.
                      </td>
                    </tr>
                  ) : (
                    monitors.map((m, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/25">
                        <td className="py-3 font-bold text-slate-200">{m.route}</td>
                        <td className="py-3 font-mono">{m.date}</td>
                        <td className="py-3 text-slate-400">{m.interval / 1000}s</td>
                        <td className="py-3">
                          {m.status === 'FLIGHTS_AVAILABLE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold font-mono animate-pulse">
                              <Flame className="w-3 h-3" /> SEATS FOUND
                            </span>
                          ) : m.status === 'NO_FLIGHTS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 border border-amber-900 text-amber-400 font-mono">
                              NO FLIGHTS
                            </span>
                          ) : m.status === 'RATE_LIMITED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950 border border-purple-900 text-purple-400 font-mono">
                              RATE LIMITED
                            </span>
                          ) : m.status === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500 font-mono">
                              PENDING
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 border border-rose-900 text-rose-400 font-mono">
                              ERROR
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-bold font-mono text-slate-300">
                          {m.status === 'FLIGHTS_AVAILABLE' ? `${m.flightsFound}` : '0'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleStopMonitor(m.route, m.date)}
                            className="p-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-400 rounded transition"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Passenger profiles */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Users className="text-amber-500 w-5 h-5" /> 3. Passenger Readiness Profiles
              </h2>
            </div>

            {/* Profile list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.length === 0 ? (
                <div className="md:col-span-2 text-center py-6 text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded">
                  No passenger profiles saved. Create one below!
                </div>
              ) : (
                profiles.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-950 border border-slate-850 rounded-lg space-y-2 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{p.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">DOB: {p.dateOfBirth} | {p.nationality}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteProfile(p.id)}
                        className="text-rose-500 hover:text-rose-400 p-0.5 hover:bg-slate-900 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] font-mono space-y-1 bg-slate-900/50 p-2 rounded border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">PASSPORT:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{p.passportNumber}</span>
                          <button 
                            onClick={() => copyToClipboard(p.passportNumber)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                            title="Copy passport number"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">EMAIL:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{p.email}</span>
                          <button 
                            onClick={() => copyToClipboard(p.email)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">PHONE:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{p.phone}</span>
                          <button 
                            onClick={() => copyToClipboard(p.phone)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Profile creator form */}
              {profiles.length < 10 && (
                <form onSubmit={handleCreateProfile} className="p-3 border border-dashed border-slate-700 rounded-lg space-y-2 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> ADD NEW PASSENGER</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Full Name"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Passport Number"
                      value={profPassport}
                      onChange={(e) => setProfPassport(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Nationality (e.g. MA)"
                      value={profNat}
                      onChange={(e) => setProfNat(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="DOB (YYYY-MM-DD)"
                      value={profDob}
                      onChange={(e) => setProfDob(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Email Address"
                      value={profEmail}
                      onChange={(e) => setProfEmail(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Phone (+212...)"
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-slate-600 rounded text-[11px] font-bold text-slate-200 transition"
                  >
                    SAVE PROFILE
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Logs & History */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <History className="text-amber-500 w-5 h-5" /> 4. Real-time Search Logs
            </h2>
            <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 h-52 overflow-y-auto font-mono text-[10px] space-y-1.5">
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-6">Logs will appear here once monitoring commences...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b border-slate-900 pb-1">
                    <span className="text-slate-500 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-slate-300 font-bold shrink-0">{log.route} ({log.date})</span>
                    <span className="text-slate-500 shrink-0">&rarr;</span>
                    {log.status === 'FLIGHTS_AVAILABLE' ? (
                      <span className="text-emerald-400 font-bold">FLIGHTS FOUND</span>
                    ) : log.status === 'NO_FLIGHTS' ? (
                      <span className="text-amber-500">NO FLIGHTS</span>
                    ) : log.status === 'RATE_LIMITED' ? (
                      <span className="text-purple-400 font-bold">429 RATE LIMITED</span>
                    ) : (
                      <span className="text-rose-500 font-bold">ERROR</span>
                    )}
                    <span className="text-slate-600 font-mono text-[9px] ml-auto">{log.responseTimeMs}ms</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

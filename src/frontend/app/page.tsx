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
  AlertCircle
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

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [queue, setQueue] = useState<QueueState>({ detected: false, provider: 'NONE', lastUpdated: '' });
  const [logs, setLogs] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState('');
  const [headersStatus, setHeadersStatus] = useState<'NONE' | 'SAVED' | 'TESTING' | 'ERROR'>('NONE');
  
  // Form states
  const [route, setRoute] = useState('CMN-IAH');
  const [date, setDate] = useState('2026-07-04');
  const [interval, setIntervalVal] = useState(60000);
  
  const [profName, setProfName] = useState('');
  const [profPassport, setProfPassport] = useState('');
  const [profNat, setProfNat] = useState('MA');
  const [profDob, setProfDob] = useState('1995-05-15');
  const [profEmail, setProfEmail] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profLoyalty, setProfLoyalty] = useState('');
  const [decryptProfiles, setDecryptProfiles] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  // Initialize and load configurations
  useEffect(() => {
    fetchStatus();
    fetchProfiles();
    fetchQueueStatus();
    fetchHistory();

    // Register audio alert
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');

    // WebSocket initialization
    const ws = new WebSocket(`${wsUrl}/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'AVAILABILITY_CHANGE') {
          // Play sound if flights appeared
          if (msg.result.status === 'FLIGHTS_AVAILABLE' && msg.result.changeDetected) {
            audioRef.current?.play().catch(() => {});
          }
          fetchStatus();
          fetchHistory();
        } else if (msg.type === 'QUEUE_UPDATE') {
          setQueue(msg);
        }
      } catch (err) {
        console.error('Error handling websocket message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [decryptProfiles]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/monitor/status`);
      const data = await res.json();
      setMonitors(data.monitors || []);
    } catch (err) {
      console.error('Error fetching monitor status:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/profiles?decrypt=${decryptProfiles}`);
      const data = await res.json();
      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/queue/status`);
      const data = await res.json();
      setQueue(data);
    } catch (err) {
      console.error('Error fetching queue status:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/monitor/history`);
      const data = await res.json();
      setLogs((data || []).reverse().slice(0, 30));
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // Actions
  const handleSaveHeaders = async () => {
    if (!rawHeaders.trim()) return;
    setHeadersStatus('TESTING');
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
    } catch (err) {
      setHeadersStatus('ERROR');
    }
  };

  const handleStartMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendUrl}/api/monitor/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, date, interval })
      });
      if (res.ok) {
        fetchStatus();
        fetchHistory();
      }
    } catch (err) {
      console.error('Error starting monitor:', err);
    }
  };

  const handleStopMonitor = async (mRoute: string, mDate: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/monitor/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: mRoute, date: mDate })
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Error stopping monitor:', err);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName || !profPassport) return;
    try {
      const res = await fetch(`${backendUrl}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profName,
          passportNumber: profPassport,
          nationality: profNat,
          dateOfBirth: profDob,
          email: profEmail,
          phone: profPhone,
          loyaltyNumber: profLoyalty || undefined
        })
      });
      if (res.ok) {
        // reset form
        setProfName('');
        setProfPassport('');
        setProfEmail('');
        setProfPhone('');
        setProfLoyalty('');
        fetchProfiles();
      } else {
        const data = await res.json();
        alert(data.error || 'Error saving profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/profiles/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchProfiles();
    } catch (err) {
      console.error('Error deleting profile:', err);
    }
  };

  const handleTestAlert = async () => {
    try {
      await fetch(`${backendUrl}/api/alerts/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Error testing alert:', err);
    }
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
          <div className="px-3 py-1.5 rounded text-xs font-mono font-semibold bg-emerald-950/50 border border-emerald-800/80 text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            LOCAL SERVER ONLINE
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
                <Shield className="text-amber-500 w-5 h-5" /> 1. Active Session Headers
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
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> REGISTERING SESSION...
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
                Session headers registered! Waiting room state updated.
              </div>
            )}
            {headersStatus === 'ERROR' && (
              <div className="p-3 bg-rose-950/30 border border-rose-900 text-rose-400 rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Failed to parse headers. Ensure key-value mappings are correct.
              </div>
            )}
          </div>

          {/* Waiting Room Panel */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Clock className="text-amber-500 w-5 h-5" /> Queue-It Status
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                <p className="text-[10px] text-slate-500 font-mono">QUEUE DETECTED</p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                  {queue.detected ? '⚠️ YES' : '❌ NO'}
                </p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                <p className="text-[10px] text-slate-500 font-mono">PROVIDER</p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                  {queue.provider}
                </p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                <p className="text-[10px] text-slate-500 font-mono">EST. WAIT TIME</p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                  {queue.estimatedWaitSeconds ? `${Math.ceil(queue.estimatedWaitSeconds / 60)} min` : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                <p className="text-[10px] text-slate-500 font-mono">IN FRONT OF YOU</p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">
                  {queue.position !== undefined ? queue.position.toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>
            {queue.detected && (
              <div className="p-3 bg-amber-950/20 border border-amber-900 text-amber-400 rounded text-[11px] leading-relaxed">
                <strong>Queue active!</strong> Toolkit will continuously report wait time stats while you keep the session fresh. DO NOT close your browser queue tab.
              </div>
            )}
          </div>

        </div>

        {/* Center/Right Column: Flight Monitors & Search Scheduler */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Availability Monitors */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Activity className="text-amber-500 w-5 h-5" /> 2. Flight Search Watchers
            </h2>

            {/* Monitor Creator */}
            <form onSubmit={handleStartMonitor} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 border border-slate-800 rounded-lg">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">ROUTE</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:outline-none focus:border-amber-500"
                  placeholder="CMN-IAH"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold font-mono">TRAVEL DATE</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:outline-none focus:border-amber-500"
                  placeholder="2026-07-04"
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
                    <th className="py-2">SEATS/FLIGHTS</th>
                    <th className="py-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {monitors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
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
                              <Flame className="w-3 h-3" /> FLIGHTS FOUND
                            </span>
                          ) : m.status === 'NO_FLIGHTS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 border border-amber-900 text-amber-400 font-mono">
                              NO FLIGHTS
                            </span>
                          ) : m.status === 'RATE_LIMITED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950 border border-purple-900 text-purple-400 font-mono">
                              RATE LIMITED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 border border-rose-900 text-rose-400 font-mono">
                              ERROR
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-bold font-mono text-slate-300">
                          {m.status === 'FLIGHTS_AVAILABLE' ? `${m.flightsFound} bounds` : '0'}
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
              <button
                onClick={() => setDecryptProfiles(!decryptProfiles)}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-700 hover:border-slate-600 rounded text-[11px] font-mono text-slate-300 transition"
              >
                {decryptProfiles ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Encrypt Fields
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Decrypt Profiles
                  </>
                )}
              </button>
            </div>

            {/* Profile list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((p) => (
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
                        <span className={p.encrypted ? 'text-amber-600/70 font-mono text-[9px] italic' : 'text-slate-300'}>
                          {p.encrypted ? 'IV:TAG:CIPHERTEXT [AES]' : p.passportNumber}
                        </span>
                        {!p.encrypted && (
                          <button 
                            onClick={() => copyToClipboard(p.passportNumber)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition"
                            title="Copy passport number"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">EMAIL:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={p.encrypted ? 'text-amber-600/70 font-mono text-[9px] italic' : 'text-slate-300'}>
                          {p.encrypted ? 'IV:TAG:CIPHERTEXT [AES]' : p.email}
                        </span>
                        {!p.encrypted && (
                          <button 
                            onClick={() => copyToClipboard(p.email)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">PHONE:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={p.encrypted ? 'text-amber-600/70 font-mono text-[9px] italic' : 'text-slate-300'}>
                          {p.encrypted ? 'IV:TAG:CIPHERTEXT [AES]' : p.phone}
                        </span>
                        {!p.encrypted && (
                          <button 
                            onClick={() => copyToClipboard(p.phone)}
                            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Profile creator form */}
              {profiles.length < 10 ? (
                <form onSubmit={handleCreateProfile} className="p-3 border border-dashed border-slate-700 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> ADD NEW PASSENGER</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Full Name"
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Passport Number"
                      value={profPassport}
                      onChange={(e) => setProfPassport(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Nationality (e.g. MA)"
                      value={profNat}
                      onChange={(e) => setProfNat(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="DOB (YYYY-MM-DD)"
                      value={profDob}
                      onChange={(e) => setProfDob(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Email Address"
                      value={profEmail}
                      onChange={(e) => setProfEmail(e.target.value)}
                    />
                    <input
                      type="text"
                      className="bg-slate-950 border border-slate-800 rounded p-1 text-[11px] focus:outline-none focus:border-amber-500"
                      placeholder="Phone (+212...)"
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1 bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-slate-600 rounded text-[11px] font-bold text-slate-200 transition"
                  >
                    ENCRYPT AND SAVE PROFILE
                  </button>
                </form>
              ) : (
                <div className="p-3 border border-dashed border-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-500 font-semibold font-mono">
                  MAXIMUM OF 10 PROFILES REACHED
                </div>
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
                      <span className="text-emerald-400 font-bold">FLIGHTS FOUND ({log.flightsFound} bounds)</span>
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

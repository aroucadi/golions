I'll create a comprehensive, implementation-ready PRD as a downloadable markdown file optimized for rapid local development. Based on your HAR analysis and the elite architect requirements, here's the complete specification:



```markdown

\# GO LIONS Booking Intelligence Toolkit

\## Production-Ready Implementation Blueprint v3.0

\### Target: https://golions.royalairmaroc.com/



\---



\## 🎯 Mission Statement



Provide Moroccan supporters with a \*\*locally-run intelligence dashboard\*\* that maximizes booking success by:

1\. Detecting flight inventory the moment it appears

2\. Preparing passenger data for rapid manual entry

3\. Providing queue visibility without bypassing security

4\. Operating entirely within ethical boundaries



\*\*Critical Constraint:\*\* This toolkit assists human users. It never automates booking, bypasses queues, or attacks RAM infrastructure.



\---



\## 📋 Quick Start (For Coding Agent)



```bash

\# Prerequisites

Node.js 20+ 

PostgreSQL 16 (optional, SQLite for local dev)

Redis 7 (optional, in-memory for local dev)



\# Bootstrap (5 minutes to running)

git clone \[repo]

cd golions-toolkit

cp .env.example .env

npm install

npm run dev



\# The dashboard will be at http://localhost:3000

\# API at http://localhost:3001

```



\---



\## 🏗️ Architecture Overview



```

┌─────────────────────────────────────────────────────────┐

│                   User's Browser                         │

│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │

│  │  Dashboard   │  │  Alerts    │  │  Profile       │  │

│  │  (Next.js)   │  │  Panel     │  │  Manager       │  │

│  └──────┬───────┘  └─────┬──────┘  └───────┬────────┘  │

│         │                │                  │           │

│         └────────────────┼──────────────────┘           │

│                          │ WebSocket :3001/ws           │

└──────────────────────────┼──────────────────────────────┘

&#x20;                          │

┌──────────────────────────┼──────────────────────────────┐

│                    Local Server (Fastify :3001)          │

│  ┌───────────────────────┴──────────────────────────┐   │

│  │              Event Bus (EventEmitter)             │   │

│  └───────────────────────┬──────────────────────────┘   │

│                          │                              │

│  ┌───────────┐  ┌────────┴──────┐  ┌────────────────┐  │

│  │ Monitor   │  │  Queue        │  │  Profile       │  │

│  │ Scheduler │  │  Observer     │  │  Service       │  │

│  └─────┬─────┘  └──────┬────────┘  └───────┬────────┘  │

│        │               │                   │           │

│  ┌─────┴───────────────┴───────────────────┴────────┐   │

│  │         Rate Limiter (Token Bucket)              │   │

│  └─────┬────────────────────────────────────────────┘   │

│        │  Max: 10 req/min total to RAM                 │

└────────┼───────────────────────────────────────────────┘

&#x20;        │

&#x20;        │  HTTPS (identical to browser behavior)

&#x20;        ▼

┌─────────────────────────────────────────────────────────┐

│         Royal Air Maroc Infrastructure                  │

│  Queue-It → OAuth → API Gateway → Booking Engine        │

└─────────────────────────────────────────────────────────┘

```



\---



\## 📦 Module Decomposition



\### Module 1: `ReconEngine` (5 files)

\*\*Purpose:\*\* Document the RAM platform structure



```typescript

// src/modules/recon/types.ts

export interface EndpointCatalog {

&#x20; endpoints: Endpoint\[];

&#x20; lastUpdated: Date;

&#x20; harFileHash: string;

}



export interface Endpoint {

&#x20; path: string;           // e.g., "/api/air-calendars"

&#x20; method: 'GET' | 'POST';

&#x20; requestSchema: object;

&#x20; responseSchema: object;

&#x20; headers: Record<string, string>;

&#x20; authentication: 'OAUTH' | 'NONE' | 'QUEUE\_COOKIE';

}



// src/modules/recon/ReconEngine.ts

export class ReconEngine {

&#x20; async loadFromHAR(harPath: string): Promise<EndpointCatalog>;

&#x20; async validateEndpoint(endpoint: Endpoint): Promise<boolean>;

&#x20; getSearchEndpoints(): Endpoint\[];

&#x20; getAuthFlow(): AuthFlow;

}

```



\*\*Files to create:\*\*

1\. `src/modules/recon/types.ts` - Type definitions

2\. `src/modules/recon/ReconEngine.ts` - Main class

3\. `src/modules/recon/HARParser.ts` - HAR file parser

4\. `src/modules/recon/\_\_tests\_\_/recon.test.ts` - Tests with sample HAR

5\. `src/data/endpoints-catalog.json` - Generated catalog



\---



\### Module 2: `AvailabilityMonitor` (8 files) ⭐ CRITICAL

\*\*Purpose:\*\* Poll flight search endpoints, detect inventory changes



```typescript

// src/modules/monitor/types.ts

export interface MonitorConfig {

&#x20; route: string;          // "CMN-IAH"

&#x20; date: string;           // "2026-07-04"

&#x20; interval: number;        // milliseconds (min: 60000)

&#x20; enabled: boolean;

}



export interface FlightSearchResult {

&#x20; id: string;

&#x20; timestamp: Date;

&#x20; endpoint: string;

&#x20; status: 'NO\_FLIGHTS' | 'FLIGHTS\_AVAILABLE' | 'ERROR' | 'RATE\_LIMITED';

&#x20; flightsFound: number;

&#x20; rawResponse: object;

&#x20; responseTimeMs: number;

&#x20; changeDetected: boolean;

&#x20; previousStatus?: string;

}



// src/modules/monitor/AvailabilityMonitor.ts

export class AvailabilityMonitor {

&#x20; private activeMonitors: Map<string, NodeJS.Timer>;

&#x20; private searchHistory: FlightSearchResult\[];

&#x20; 

&#x20; async startMonitoring(config: MonitorConfig): Promise<void>;

&#x20; async stopMonitoring(routeKey: string): Promise<void>;

&#x20; async executeSearch(config: MonitorConfig): Promise<FlightSearchResult>;

&#x20; private detectChange(current: FlightSearchResult, previous?: FlightSearchResult): boolean;

&#x20; getActiveMonitors(): MonitorConfig\[];

&#x20; getHistory(routeKey: string): FlightSearchResult\[];

}

```



\*\*Critical algorithm - Change Detection:\*\*

```typescript

// src/modules/monitor/DiffEngine.ts

export class DiffEngine {

&#x20; static detectChange(current: FlightSearchResult, previous?: FlightSearchResult): ChangeDetection {

&#x20;   // Rule 1: No previous = first check, not a change

&#x20;   if (!previous) return { changed: false, severity: 'NONE' };

&#x20;   

&#x20;   // Rule 2: Status transition NO\_FLIGHTS → FLIGHTS\_AVAILABLE = CRITICAL

&#x20;   if (previous.status === 'NO\_FLIGHTS' \&\& current.status === 'FLIGHTS\_AVAILABLE') {

&#x20;     return { changed: true, severity: 'CRITICAL', type: 'INVENTORY\_APPEARED' };

&#x20;   }

&#x20;   

&#x20;   // Rule 3: Status transition FLIGHTS\_AVAILABLE → NO\_FLIGHTS = HIGH

&#x20;   if (previous.status === 'FLIGHTS\_AVAILABLE' \&\& current.status === 'NO\_FLIGHTS') {

&#x20;     return { changed: true, severity: 'HIGH', type: 'INVENTORY\_SOLD\_OUT' };

&#x20;   }

&#x20;   

&#x20;   // Rule 4: Flights count changed = MEDIUM

&#x20;   if (current.status === 'FLIGHTS\_AVAILABLE' \&\& previous.status === 'FLIGHTS\_AVAILABLE' 

&#x20;       \&\& current.flightsFound !== previous.flightsFound) {

&#x20;     return { changed: true, severity: 'MEDIUM', type: 'FLIGHT\_COUNT\_CHANGED' };

&#x20;   }

&#x20;   

&#x20;   // Rule 5: Error state change = MEDIUM

&#x20;   if (current.status === 'ERROR' \&\& previous.status !== 'ERROR') {

&#x20;     return { changed: true, severity: 'MEDIUM', type: 'ERROR\_DETECTED' };

&#x20;   }

&#x20;   

&#x20;   return { changed: false, severity: 'NONE' };

&#x20; }

}

```



\*\*Files to create:\*\*

1\. `src/modules/monitor/types.ts`

2\. `src/modules/monitor/AvailabilityMonitor.ts`

3\. `src/modules/monitor/DiffEngine.ts`

4\. `src/modules/monitor/SearchExecutor.ts` - Makes actual HTTP requests

5\. `src/modules/monitor/MonitorScheduler.ts` - Manages intervals

6\. `src/modules/monitor/\_\_tests\_\_/monitor.test.ts`

7\. `src/modules/monitor/\_\_tests\_\_/diff.test.ts`

8\. `src/data/monitor-state.json` - Persisted state



\---



\### Module 3: `RateLimiter` (3 files) ⚠️ HARD CONSTRAINT

\*\*Purpose:\*\* Ensure ethical request patterns



```typescript

// src/modules/ratelimit/TokenBucket.ts

export class TokenBucket {

&#x20; private tokens: number;

&#x20; private lastRefill: Date;

&#x20; 

&#x20; constructor(

&#x20;   private maxTokens: number = 10,     // 10 requests total

&#x20;   private refillRate: number = 1,      // 1 token per 6 seconds

&#x20;   private refillInterval: number = 6000 // 6 seconds

&#x20; ) {}

&#x20; 

&#x20; async tryConsume(count: number = 1): Promise<boolean> {

&#x20;   this.refill();

&#x20;   if (this.tokens >= count) {

&#x20;     this.tokens -= count;

&#x20;     return true;

&#x20;   }

&#x20;   return false;

&#x20; }

&#x20; 

&#x20; async waitForToken(): Promise<void> {

&#x20;   while (!(await this.tryConsume())) {

&#x20;     await new Promise(resolve => setTimeout(resolve, 1000));

&#x20;   }

&#x20; }

&#x20; 

&#x20; private refill(): void {

&#x20;   const now = Date.now();

&#x20;   const elapsed = now - this.lastRefill.getTime();

&#x20;   const tokensToAdd = Math.floor(elapsed / this.refillInterval) \* this.refillRate;

&#x20;   this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);

&#x20;   this.lastRefill = new Date(now);

&#x20; }

}

```



\*\*Files to create:\*\*

1\. `src/modules/ratelimit/TokenBucket.ts`

2\. `src/modules/ratelimit/RateLimitGuard.ts` - Wrapper with logging

3\. `src/modules/ratelimit/\_\_tests\_\_/ratelimit.test.ts`



\---



\### Module 4: `QueueObserver` (5 files)

\*\*Purpose:\*\* Passive queue state detection (no bypass)



```typescript

// src/modules/queue/types.ts

export interface QueueState {

&#x20; detected: boolean;

&#x20; provider: 'QUEUE\_IT' | 'NONE' | 'UNKNOWN';

&#x20; queueId?: string;

&#x20; cookies?: Record<string, string>;

&#x20; estimatedWaitSeconds?: number;

&#x20; position?: number;

&#x20; totalWaiting?: number;

&#x20; lastUpdated: Date;

}



// src/modules/queue/QueueObserver.ts

export class QueueObserver {

&#x20; async detectQueue(): Promise<QueueState>;

&#x20; async monitorQueuePosition(cookies: Record<string, string>): Promise<void>;

&#x20; getQueueStatus(): QueueState;

}

```



\*\*Files to create:\*\*

1\. `src/modules/queue/types.ts`

2\. `src/modules/queue/QueueObserver.ts`

3\. `src/modules/queue/CookieAnalyzer.ts`

4\. `src/modules/queue/\_\_tests\_\_/queue.test.ts`

5\. `src/data/queue-patterns.json` - Known Queue-It patterns



\---



\### Module 5: `ProfileManager` (5 files) 🔒

\*\*Purpose:\*\* Securely store passenger data locally



```typescript

// src/modules/profile/types.ts

export interface PassengerProfile {

&#x20; id: string;

&#x20; name: string;

&#x20; passportNumber: string;

&#x20; nationality: string;

&#x20; dateOfBirth: string;

&#x20; email: string;

&#x20; phone: string;

&#x20; emergencyContact?: {

&#x20;   name: string;

&#x20;   phone: string;

&#x20; };

&#x20; loyaltyNumber?: string;

&#x20; encrypted: boolean;

&#x20; createdAt: Date;

}



// src/modules/profile/ProfileManager.ts

export class ProfileManager {

&#x20; async storeProfile(profile: Omit<PassengerProfile, 'id' | 'encrypted' | 'createdAt'>): Promise<string>;

&#x20; async getProfile(id: string): Promise<PassengerProfile>;

&#x20; async getAllProfiles(): Promise<PassengerProfile\[]>;

&#x20; async deleteProfile(id: string): Promise<void>;

&#x20; getBookingReadyData(id: string): Promise<BookingFormData>;

&#x20; 

&#x20; // Encryption using AES-256-GCM with key from .env

&#x20; private encrypt(data: string): string;

&#x20; private decrypt(encrypted: string): string;

}

```



\*\*Files to create:\*\*

1\. `src/modules/profile/types.ts`

2\. `src/modules/profile/ProfileManager.ts`

3\. `src/modules/profile/EncryptionService.ts`

4\. `src/modules/profile/\_\_tests\_\_/profile.test.ts`

5\. `src/data/profiles.json` - Encrypted storage



\---



\### Module 6: `NotificationEngine` (6 files)

\*\*Purpose:\*\* Multi-channel alerts



```typescript

// src/modules/notifications/types.ts

export type NotificationChannel = 'desktop' | 'discord' | 'slack' | 'email' | 'webhook';



export interface Alert {

&#x20; id: string;

&#x20; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

&#x20; title: string;

&#x20; message: string;

&#x20; timestamp: Date;

&#x20; route?: string;

&#x20; action?: string;

}



// src/modules/notifications/NotificationEngine.ts

export class NotificationEngine {

&#x20; async sendAlert(alert: Alert, channels: NotificationChannel\[]): Promise<void>;

&#x20; registerChannel(channel: NotificationChannel, config: ChannelConfig): void;

&#x20; testChannel(channel: NotificationChannel): Promise<boolean>;

}

```



\*\*Files to create:\*\*

1\. `src/modules/notifications/types.ts`

2\. `src/modules/notifications/NotificationEngine.ts`

3\. `src/modules/notifications/channels/DesktopNotifier.ts`

4\. `src/modules/notifications/channels/DiscordNotifier.ts`

5\. `src/modules/notifications/channels/SlackNotifier.ts`

6\. `src/modules/notifications/\_\_tests\_\_/notifications.test.ts`



\---



\### Module 7: `Dashboard API` (4 files)

\*\*Purpose:\*\* Serve the frontend with real-time data



```typescript

// src/server/routes/api.ts

export async function apiRoutes(fastify: FastifyInstance) {

&#x20; // Monitoring endpoints

&#x20; fastify.post('/api/monitor/start', startMonitoring);

&#x20; fastify.post('/api/monitor/stop', stopMonitoring);

&#x20; fastify.get('/api/monitor/status', getMonitorStatus);

&#x20; fastify.get('/api/monitor/history/:route', getHistory);

&#x20; 

&#x20; // Queue endpoints

&#x20; fastify.get('/api/queue/status', getQueueStatus);

&#x20; 

&#x20; // Profile endpoints

&#x20; fastify.post('/api/profiles', createProfile);

&#x20; fastify.get('/api/profiles', listProfiles);

&#x20; fastify.get('/api/profiles/:id/ready', getBookingReady);

&#x20; fastify.delete('/api/profiles/:id', deleteProfile);

&#x20; 

&#x20; // Alert endpoints

&#x20; fastify.put('/api/alerts/preferences', updateAlertPrefs);

&#x20; fastify.post('/api/alerts/test', testAlert);

&#x20; 

&#x20; // Health

&#x20; fastify.get('/api/health', healthCheck);

}



// src/server/websocket.ts

export function setupWebSocket(fastify: FastifyInstance) {

&#x20; fastify.get('/ws', { websocket: true }, (socket, req) => {

&#x20;   // Subscribe to EventBus events

&#x20;   eventBus.on('availability-changed', (data) => {

&#x20;     socket.send(JSON.stringify({ type: 'AVAILABILITY\_CHANGE', ...data }));

&#x20;   });

&#x20;   

&#x20;   eventBus.on('queue-updated', (data) => {

&#x20;     socket.send(JSON.stringify({ type: 'QUEUE\_UPDATE', ...data }));

&#x20;   });

&#x20;   

&#x20;   socket.on('close', () => {

&#x20;     // Cleanup subscriptions

&#x20;   });

&#x20; });

}

```



\*\*Files to create:\*\*

1\. `src/server/index.ts` - Fastify server setup

2\. `src/server/routes/api.ts` - All API routes

3\. `src/server/websocket.ts` - WebSocket handler

4\. `src/server/EventBus.ts` - Event system



\---



\### Module 8: `Frontend Dashboard` (10 files)

\*\*Purpose:\*\* User interface



```typescript

// src/frontend/app/page.tsx

export default function Dashboard() {

&#x20; return (

&#x20;   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">

&#x20;     <StatusCard />

&#x20;     <MonitoringPanel />

&#x20;     <QueuePanel />

&#x20;     <AlertsPanel />

&#x20;     <ProfilesPanel />

&#x20;     <HistoryPanel />

&#x20;   </div>

&#x20; );

}

```



\*\*Files to create:\*\*

1\. `src/frontend/app/layout.tsx`

2\. `src/frontend/app/page.tsx`

3\. `src/frontend/components/StatusCard.tsx`

4\. `src/frontend/components/MonitoringPanel.tsx`

5\. `src/frontend/components/QueuePanel.tsx`

6\. `src/frontend/components/AlertsPanel.tsx`

7\. `src/frontend/components/ProfilesPanel.tsx`

8\. `src/frontend/components/HistoryPanel.tsx`

9\. `src/frontend/hooks/useWebSocket.ts`

10\. `src/frontend/lib/api.ts`



\---



\## 📊 Data Schemas



\### Monitoring Configuration (`.env`)

```bash

\# Required

ENCRYPTION\_KEY=your-256-bit-key-here  # Generate: openssl rand -hex 32



\# Optional integrations

DISCORD\_WEBHOOK\_URL=

SLACK\_WEBHOOK\_URL=

EMAIL\_SMTP\_HOST=

EMAIL\_SMTP\_PORT=

EMAIL\_FROM=



\# Database (auto-detects SQLite if no PostgreSQL)

DATABASE\_URL=postgresql://localhost:5432/golions  # Optional



\# Redis (auto-detects in-memory if no Redis)

REDIS\_URL=redis://localhost:6379  # Optional

```



\### Monitor State Schema (`src/data/monitor-state.json`)

```json

{

&#x20; "activeMonitors": \[

&#x20;   {

&#x20;     "route": "CMN-IAH",

&#x20;     "date": "2026-07-04",

&#x20;     "interval": 60000,

&#x20;     "enabled": true,

&#x20;     "lastChecked": "2026-07-04T20:15:00Z",

&#x20;     "currentStatus": "NO\_FLIGHTS",

&#x20;     "flightsFound": 0

&#x20;   }

&#x20; ],

&#x20; "history": \[

&#x20;   {

&#x20;     "id": "uuid-here",

&#x20;     "timestamp": "2026-07-04T20:15:00Z",

&#x20;     "route": "CMN-IAH",

&#x20;     "date": "2026-07-04",

&#x20;     "status": "NO\_FLIGHTS",

&#x20;     "flightsFound": 0,

&#x20;     "responseTimeMs": 630

&#x20;   }

&#x20; ]

}

```



\---



\## 🔄 State Machine



```

&#x20;                   ┌──────────────┐

&#x20;                   │   INACTIVE   │  Campaign not started

&#x20;                   └──────┬───────┘

&#x20;                          │ campaign detected

&#x20;                          ▼

&#x20;                   ┌──────────────┐

&#x20;                   │  MONITORING  │  Checking every 60s

&#x20;                   └──────┬───────┘

&#x20;                          │

&#x20;             ┌────────────┼────────────┐

&#x20;             │            │            │

&#x20;             ▼            ▼            ▼

&#x20;       ┌──────────┐ ┌─────────┐ ┌──────────┐

&#x20;       │NO\_FLIGHTS│ │QUEUED   │ │ERROR     │

&#x20;       │(waiting) │ │(waiting)│ │(retry)   │

&#x20;       └────┬─────┘ └────┬────┘ └────┬─────┘

&#x20;            │            │           │

&#x20;            │            │           └──backoff──┘

&#x20;            │            │

&#x20;            ▼            ▼

&#x20;       ┌────────────────────────────┐

&#x20;       │   🚨 FLIGHTS AVAILABLE!    │

&#x20;       │   All alerts triggered     │

&#x20;       └────────────┬───────────────┘

&#x20;                    │

&#x20;                    ▼

&#x20;       ┌────────────────────────────┐

&#x20;       │   USER MANUAL BOOKING      │

&#x20;       │   (Toolkit role complete)  │

&#x20;       └────────────────────────────┘

```



\---



\## 🧪 Test Suite



\### Critical Tests (Must Pass Before Deployment)



```typescript

// src/\_\_tests\_\_/integration/critical-path.test.ts



describe('Availability Detection', () => {

&#x20; test('NO\_FLIGHTS → FLIGHTS\_AVAILABLE triggers CRITICAL alert within 500ms', async () => {

&#x20;   const startTime = Date.now();

&#x20;   

&#x20;   // Simulate previous state

&#x20;   await monitor.updateState({ status: 'NO\_FLIGHTS' });

&#x20;   

&#x20;   // Simulate new response with flights

&#x20;   const result = await monitor.processSearchResponse(mockFlightResponse);

&#x20;   

&#x20;   const alertTime = Date.now();

&#x20;   expect(result.changeDetected).toBe(true);

&#x20;   expect(result.severity).toBe('CRITICAL');

&#x20;   expect(alertTime - startTime).toBeLessThan(500);

&#x20;   expect(notificationEngine.lastAlert.severity).toBe('CRITICAL');

&#x20; });

});



describe('Rate Limiter', () => {

&#x20; test('Never exceeds 10 requests per minute', async () => {

&#x20;   const requests = Array(15).fill(null).map(() => 

&#x20;     rateLimiter.tryConsume()

&#x20;   );

&#x20;   

&#x20;   const results = await Promise.all(requests);

&#x20;   const allowed = results.filter(r => r).length;

&#x20;   

&#x20;   expect(allowed).toBeLessThanOrEqual(10);

&#x20; });

});



describe('Profile Encryption', () => {

&#x20; test('Profiles are encrypted at rest', async () => {

&#x20;   await profileManager.storeProfile(mockProfile);

&#x20;   const rawData = fs.readFileSync('src/data/profiles.json', 'utf8');

&#x20;   const parsed = JSON.parse(rawData);

&#x20;   

&#x20;   // Should not contain plain text passport

&#x20;   expect(rawData).not.toContain(mockProfile.passportNumber);

&#x20;   expect(parsed.profiles\[0].encrypted).toBe(true);

&#x20; });

});

```



\---



\## 📁 Project Structure



```

golions-toolkit/

├── .env.example

├── .env                          # Your secrets (gitignored)

├── package.json

├── tsconfig.json

├── next.config.js

├── tailwind.config.js

├── README.md

│

├── src/

│   ├── server/                   # Backend (Fastify)

│   │   ├── index.ts             # Entry point

│   │   ├── EventBus.ts          # Event system

│   │   ├── websocket.ts         # WebSocket handler

│   │   └── routes/

│   │       └── api.ts           # All API routes

│   │

│   ├── modules/                  # Business logic

│   │   ├── recon/               # Platform documentation

│   │   │   ├── ReconEngine.ts

│   │   │   ├── HARParser.ts

│   │   │   ├── types.ts

│   │   │   └── \_\_tests\_\_/

│   │   │

│   │   ├── monitor/             # Availability monitoring

│   │   │   ├── AvailabilityMonitor.ts

│   │   │   ├── DiffEngine.ts

│   │   │   ├── SearchExecutor.ts

│   │   │   ├── MonitorScheduler.ts

│   │   │   ├── types.ts

│   │   │   └── \_\_tests\_\_/

│   │   │

│   │   ├── ratelimit/           # Rate limiting

│   │   │   ├── TokenBucket.ts

│   │   │   ├── RateLimitGuard.ts

│   │   │   └── \_\_tests\_\_/

│   │   │

│   │   ├── queue/               # Queue observation

│   │   │   ├── QueueObserver.ts

│   │   │   ├── CookieAnalyzer.ts

│   │   │   ├── types.ts

│   │   │   └── \_\_tests\_\_/

│   │   │

│   │   ├── profile/             # Profile management

│   │   │   ├── ProfileManager.ts

│   │   │   ├── EncryptionService.ts

│   │   │   ├── types.ts

│   │   │   └── \_\_tests\_\_/

│   │   │

│   │   └── notifications/       # Alert system

│   │       ├── NotificationEngine.ts

│   │       ├── types.ts

│   │       ├── channels/

│   │       │   ├── DesktopNotifier.ts

│   │       │   ├── DiscordNotifier.ts

│   │       │   └── SlackNotifier.ts

│   │       └── \_\_tests\_\_/

│   │

│   ├── frontend/                 # Next.js dashboard

│   │   ├── app/

│   │   │   ├── layout.tsx

│   │   │   └── page.tsx

│   │   ├── components/

│   │   │   ├── StatusCard.tsx

│   │   │   ├── MonitoringPanel.tsx

│   │   │   ├── QueuePanel.tsx

│   │   │   ├── AlertsPanel.tsx

│   │   │   ├── ProfilesPanel.tsx

│   │   │   └── HistoryPanel.tsx

│   │   ├── hooks/

│   │   │   └── useWebSocket.ts

│   │   └── lib/

│   │       └── api.ts

│   │

│   ├── data/                     # Persistent storage

│   │   ├── endpoints-catalog.json

│   │   ├── monitor-state.json

│   │   ├── profiles.json        # Encrypted!

│   │   └── queue-patterns.json

│   │

│   └── \_\_tests\_\_/               # Integration tests

│       └── integration/

│           ├── critical-path.test.ts

│           └── fixtures/

│               └── sample-har.har

│

└── scripts/

&#x20;   └── generate-encryption-key.sh

```



\---



\## ⚡ Performance Constraints



| Metric | Target | Enforcement |

|--------|--------|-------------|

| Total requests to RAM | ≤ 10/minute | Token bucket hard limit |

| Alert latency | < 500ms from detection | EventEmitter synchronous dispatch |

| WebSocket latency | < 100ms | Local server, no network hops |

| Dashboard load time | < 2s | Next.js static generation |

| Memory usage | < 256MB | No heavy caching |

| Disk usage | < 100MB | Profile limit: 10 passengers |



\---



\## 🔒 Security Requirements



\### Hard Constraints

1\. \*\*Passenger data encrypted at rest\*\* using AES-256-GCM

2\. \*\*Encryption key only in `.env`\*\* (never committed, never logged)

3\. \*\*No automatic token refresh\*\* - Users manually provide session cookies

4\. \*\*No request forgery\*\* - All RAM requests identical to browser behavior

5\. \*\*Local-only storage\*\* - No cloud sync of profiles or monitoring data



\### What NOT to do

\- ❌ Never store RAM passwords or OAuth tokens

\- ❌ Never bypass Queue-It or manipulate queue position

\- ❌ Never automate form submission or booking confirmation

\- ❌ Never share monitoring data between users

\- ❌ Never exceed rate limits for any reason



\---



\## 🚀 Implementation Order (For Coding Agent)



\### Step 1: Project Scaffold (15 minutes)

```bash

npx create-next-app@latest golions-frontend --typescript --tailwind --app

mkdir -p src/{server,modules/{recon,monitor,ratelimit,queue,profile,notifications},data,\_\_tests\_\_}

npm install fastify @fastify/websocket @fastify/cors dotenv uuid

npm install -D @types/node vitest

```



\### Step 2: Core Infrastructure (30 minutes)

1\. Create `src/server/index.ts` with Fastify + WebSocket

2\. Create `src/server/EventBus.ts` (simple EventEmitter wrapper)

3\. Create `src/modules/ratelimit/TokenBucket.ts` and tests

4\. Create `.env.example` and validation



\### Step 3: Recon Engine (20 minutes)

1\. Create `src/modules/recon/HARParser.ts`

2\. Parse the provided HAR file

3\. Generate `src/data/endpoints-catalog.json`



\### Step 4: Availability Monitor (45 minutes)

1\. Create `SearchExecutor.ts` - Makes HTTP requests to RAM

2\. Create `DiffEngine.ts` - Change detection logic

3\. Create `AvailabilityMonitor.ts` - Main monitoring logic

4\. Wire to EventBus for real-time alerts



\### Step 5: Profile Manager (25 minutes)

1\. Create `EncryptionService.ts` 

2\. Create `ProfileManager.ts`

3\. Add API routes for CRUD operations



\### Step 6: Queue Observer (20 minutes)

1\. Create `CookieAnalyzer.ts` 

2\. Create `QueueObserver.ts`

3\. Document Queue-It patterns from HAR



\### Step 7: Notification Engine (25 minutes)

1\. Create `NotificationEngine.ts`

2\. Implement Discord and Slack channels

3\. Add desktop notification support



\### Step 8: Frontend Dashboard (45 minutes)

1\. Create all React components

2\. Implement WebSocket hook

3\. Wire to API endpoints



\### Step 9: Integration Tests (30 minutes)

1\. Critical path test: detection → alert

2\. Rate limiter compliance test

3\. Profile encryption test



\### Step 10: Polish \& Documentation (20 minutes)

1\. README with setup instructions

2\. Environment variable documentation

3\. Troubleshooting guide



\*\*Total estimated time:\*\* \~4.5 hours for an experienced developer



\---



\## 📝 API Reference



\### Start Monitoring

```http

POST /api/monitor/start

Content-Type: application/json



{

&#x20; "route": "CMN-IAH",

&#x20; "date": "2026-07-04",

&#x20; "interval": 60000

}



Response 200:

{

&#x20; "success": true,

&#x20; "monitorId": "uuid",

&#x20; "message": "Monitoring started for CMN→IAH on 2026-07-04"

}

```



\### Get Monitor Status

```http

GET /api/monitor/status



Response 200:

{

&#x20; "activeMonitors": 3,

&#x20; "monitors": \[

&#x20;   {

&#x20;     "route": "CMN-IAH",

&#x20;     "date": "2026-07-04",

&#x20;     "status": "NO\_FLIGHTS",

&#x20;     "lastChecked": "2026-07-04T20:15:00Z",

&#x20;     "nextCheck": "2026-07-04T20:16:00Z"

&#x20;   }

&#x20; ]

}

```



\### Store Profile

```http

POST /api/profiles

Content-Type: application/json



{

&#x20; "name": "Mohammed Example",

&#x20; "passportNumber": "AB1234567",

&#x20; "nationality": "MA",

&#x20; "dateOfBirth": "1990-01-15",

&#x20; "email": "mohammed@example.com",

&#x20; "phone": "+212600000000"

}



Response 201:

{

&#x20; "id": "uuid",

&#x20; "message": "Profile stored securely"

}

```



\---



\## 🎯 Success Criteria



\### Must Have (MVP)

\- \[ ] Monitor multiple routes simultaneously

\- \[ ] Detect inventory appearance within 60 seconds

\- \[ ] Alert via desktop notification + at least one webhook

\- \[ ] Store up to 10 passenger profiles securely

\- \[ ] Rate limiter prevents abuse

\- \[ ] Dashboard shows real-time status

\- \[ ] Works entirely locally (no cloud dependency)



\### Should Have (v1.1)

\- \[ ] Discord/Slack/Email notifications

\- \[ ] Search history with trends

\- \[ ] Campaign timeline visualization

\- \[ ] Mobile-responsive dashboard

\- \[ ] Queue-It wait time estimation



\### Nice to Have (v2.0)

\- \[ ] Multiple user support (family/friends)

\- \[ ] Flight price tracking

\- \[ ] Alternative route suggestions

\- \[ ] Browser extension for one-click monitoring



\---



\## ⚠️ Error Handling



\### Network Errors

```typescript

// Implemented in SearchExecutor.ts

const RETRY\_STRATEGY = {

&#x20; 429: { retries: 0, backoff: 60000 },     // Rate limited: stop immediately

&#x20; 502: { retries: 3, backoff: 5000 },      // Bad gateway: retry with backoff

&#x20; 503: { retries: 3, backoff: 10000 },     // Service unavailable

&#x20; default: { retries: 1, backoff: 2000 }   // Other errors

};

```



\### State Corruption Recovery

```typescript

// Monitor state auto-recovery

if (monitorState.lastChecked > 5 minutes ago) {

&#x20; logger.warn('Monitor appears stuck, resetting');

&#x20; await monitor.reset();

&#x20; await notificationEngine.send({

&#x20;   severity: 'MEDIUM',

&#x20;   message: 'Monitor auto-recovered from stuck state'

&#x20; });

}

```



\---



\## 📚 Dependencies



```json

{

&#x20; "dependencies": {

&#x20;   "fastify": "^4.26.0",

&#x20;   "@fastify/websocket": "^10.0.0",

&#x20;   "@fastify/cors": "^9.0.0",

&#x20;   "next": "^14.1.0",

&#x20;   "react": "^18.2.0",

&#x20;   "react-dom": "^18.2.0",

&#x20;   "uuid": "^9.0.0",

&#x20;   "dotenv": "^16.4.0",

&#x20;   "pino": "^8.18.0",

&#x20;   "pino-pretty": "^10.3.0"

&#x20; },

&#x20; "devDependencies": {

&#x20;   "@types/node": "^20.11.0",

&#x20;   "@types/uuid": "^9.0.0",

&#x20;   "typescript": "^5.3.0",

&#x20;   "vitest": "^1.2.0",

&#x20;   "tailwindcss": "^3.4.0",

&#x20;   "@testing-library/react": "^14.2.0"

&#x20; }

}

```



\---



\## 🏁 Final Checklist Before Running



\- \[ ] Generate encryption key: `openssl rand -hex 32`

\- \[ ] Add to `.env` file

\- \[ ] Ensure HAR file is in `src/data/` or `test/fixtures/`

\- \[ ] Run `npm install`

\- \[ ] Run `npm test` - all tests pass

\- \[ ] Run `npm run dev` - dashboard accessible at localhost:3000

\- \[ ] Add a test route, verify monitoring starts

\- \[ ] Test alert by simulating availability response

\- \[ ] Store a test profile, verify encryption



\---


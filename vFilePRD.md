# GO LIONS Booking Intelligence Toolkit
## Consolidated Product Requirements Document (PRD) & Specification v3.0

### Target System Architecture
* **Frontend Portal (Entry Point):** `golions.royalairmaroc.com`
* **Queue Protection:** Queue-It Waiting Room (`waitingroom.royalairmaroc.com`, `static.queue-it.net`, `assets.queue-it.net`)
* **Real Booking SPA Engine:** `digital.royalairmaroc.com` (Amadeus Digital Experience Platform / DES)
* **REST APIs Backend Gateway:** `api-des.royalairmaroc.com`

---

## 🎯 Mission Statement
Provide Moroccan supporters with a **locally-run booking intelligence dashboard and toolkit** that maximizes booking success for high-demand ticket campaigns by:
1. **Recon Engine & API Mapping:** Map and document observed endpoints, request/response structures, and session states.
2. **Availability Intelligence & Monitoring:** Watch availability endpoints legitimately, detect when flights appear or travel dates open, and distinguish actual availability from server errors (e.g. `7959: NO FLIGHTS FOUND`).
3. **Queue Intelligence:** Passively monitor Queue-It activation status, estimated wait times, session cookies, and life cycle without attempting to bypass or cheat the queue.
4. **Booking Readiness:** Securely store passenger passport information, contact info, and loyalty numbers locally to allow rapid autofill/preparation once booking opens.
5. **Ethical Limits & Performance Constraints:** Operate with clear rate limits (e.g., maximum 10 requests per minute total) to prevent overloading RAM's infrastructure.

---

## 🏗️ Architecture & Flow Overview

```
              golions.royalairmaroc.com (Go Lions Launcher)
                              │
                              ▼
            Queue-It Waiting Room (waitingroom.royalairmaroc.com)
                              │  (Legitimate queue clearance)
                              ▼
           Booking SPA Web App (digital.royalairmaroc.com)
                              │
               OAuth 2.0 Auth Flow (api-des.royalairmaroc.com/v1/security/oauth2/token)
                              │
             Flight Search API (airlines/AT/v2/search/air-calendars)
                              │
        Availability Intelligence Layer / Local Dashboard Toolkit
```

---

## 📦 Module Decomposition

### Module A: Recon Engine
**Purpose:** Continuously maps, documents, and stores the RAM/Amadeus platform API endpoints, structures, authentication details, and headers.

#### Key Types & Classes (`src/modules/recon/types.ts` & `ReconEngine.ts`)
```typescript
export interface EndpointCatalog {
  endpoints: Endpoint[];
  lastUpdated: Date;
  harFileHash: string;
}

export interface Endpoint {
  path: string;           // e.g., "/airlines/AT/v2/search/air-calendars"
  method: 'GET' | 'POST';
  requestSchema: object;
  responseSchema: object;
  headers: Record<string, string>;
  authentication: 'OAUTH' | 'NONE' | 'QUEUE_COOKIE';
}

export class ReconEngine {
  async loadFromHAR(harPath: string): Promise<EndpointCatalog>;
  async validateEndpoint(endpoint: Endpoint): Promise<boolean>;
  getSearchEndpoints(): Endpoint[];
  getAuthFlow(): AuthFlow;
}
```

* **Files to create:**
  1. `src/modules/recon/types.ts` - Type definitions
  2. `src/modules/recon/ReconEngine.ts` - Main parser and catalog manager
  3. `src/modules/recon/HARParser.ts` - Parses uploaded HAR captures
  4. `src/modules/recon/__tests__/recon.test.ts` - Test suite with sample HAR parser tests
  5. `src/data/endpoints-catalog.json` - Generated database of discovered APIs

---

### Module B: Availability & Flight Intelligence ⭐ CRITICAL
**Purpose:** Legitimately queries the search API using OAuth credentials and monitors for flight updates, calendar dates, and inventory changes.

#### Exact Search Payload Captured from HAR
```json
{
  "travelers": [
    {
      "passengerTypeCode": "ADT"
    }
  ],
  "itineraries": [
    {
      "originLocationCode": "CMN",
      "destinationLocationCode": "IAH",
      "departureDateTime": "2026-07-04T00:00:00.000",
      "isRequestedBound": true
    }
  ],
  "commercialFareFamilies": [
    "RAMNEWFF",
    "RAMNEWFFBS"
  ],
  "searchPreferences": {
    "showUnavailableEntries": false
  }
}
```

#### Expected Server Responses
* **No Flights Error:**
  ```json
  {
    "errors": [
      {
        "code": "7959",
        "title": "NO FLIGHTS FOUND",
        "detail": "NO AVAILABLE FLIGHT FOUND FOR THE REQUESTED SEGMENT 1"
      }
    ]
  }
  ```
* **Success:** Returns valid itineraries, schedule, or calendar mapping.

#### Key Types & Classes (`src/modules/monitor/types.ts` & `DiffEngine.ts`)
```typescript
export interface MonitorConfig {
  route: string;            // e.g. "CMN-IAH"
  date: string;             // "2026-07-04"
  interval: number;         // in milliseconds (default: 60000)
  enabled: boolean;
}

export interface FlightSearchResult {
  id: string;
  timestamp: Date;
  endpoint: string;
  status: 'NO_FLIGHTS' | 'FLIGHTS_AVAILABLE' | 'ERROR' | 'RATE_LIMITED';
  flightsFound: number;
  rawResponse: object;
  responseTimeMs: number;
  changeDetected: boolean;
  previousStatus?: string;
}

export class DiffEngine {
  static detectChange(current: FlightSearchResult, previous?: FlightSearchResult): ChangeDetection {
    if (!previous) return { changed: false, severity: 'NONE' };
    
    // Transition from NO_FLIGHTS to FLIGHTS_AVAILABLE is critical
    if (previous.status === 'NO_FLIGHTS' && current.status === 'FLIGHTS_AVAILABLE') {
      return { changed: true, severity: 'CRITICAL', type: 'INVENTORY_APPEARED' };
    }
    
    // Transition from FLIGHTS_AVAILABLE to NO_FLIGHTS is high
    if (previous.status === 'FLIGHTS_AVAILABLE' && current.status === 'NO_FLIGHTS') {
      return { changed: true, severity: 'HIGH', type: 'INVENTORY_SOLD_OUT' };
    }
    
    // Flight count differences
    if (current.status === 'FLIGHTS_AVAILABLE' && previous.status === 'FLIGHTS_AVAILABLE' && current.flightsFound !== previous.flightsFound) {
      return { changed: true, severity: 'MEDIUM', type: 'FLIGHT_COUNT_CHANGED' };
    }
    
    // Error state changes
    if (current.status === 'ERROR' && previous.status !== 'ERROR') {
      return { changed: true, severity: 'MEDIUM', type: 'ERROR_DETECTED' };
    }
    
    return { changed: false, severity: 'NONE' };
  }
}
```

* **Files to create:**
  1. `src/modules/monitor/types.ts`
  2. `src/modules/monitor/AvailabilityMonitor.ts`
  3. `src/modules/monitor/DiffEngine.ts`
  4. `src/modules/monitor/SearchExecutor.ts` - Makes authenticated POST / GET requests
  5. `src/modules/monitor/MonitorScheduler.ts` - Interval coordinator
  6. `src/modules/monitor/__tests__/monitor.test.ts`
  7. `src/modules/monitor/__tests__/diff.test.ts`
  8. `src/data/monitor-state.json` - Active schedules and history state

---

### Module C: Search Decoder
**Purpose:** Decodes structured inputs (origin, destination, date, passengers, campaign parameters) to capture search history, latencies, and performance metrics, creating a searchable dataset.

---

### Module D: Queue & Session Intelligence
**Purpose:** Passively monitors Queue-It waiting room status, active cookies, session expiration, and redirect lifecycles.
* **Ethics Rule:** Never bypass or manipulate queue positions.
* **Features:** Extract queue state (Queue ID, position, estimated wait times) to display inside the dashboard. Detect if OAuth tokens require browser session updates.
* **Authentication Questions to Answer:**
  1. Is the OAuth token (`POST /v1/security/oauth2/token`) anonymous?
  2. How long does the token live? Can it be refreshed?
  3. Is the token tied to a session or cookie?
  4. Does Queue-It control access to the OAuth token endpoint?

* **Files to create:**
  1. `src/modules/queue/types.ts`
  2. `src/modules/queue/QueueObserver.ts`
  3. `src/modules/queue/CookieAnalyzer.ts`
  4. `src/modules/queue/__tests__/queue.test.ts`
  5. `src/data/queue-patterns.json` - Common wait room domain list and pattern definitions

---

### Module E: Booking Readiness & Profile Manager
**Purpose:** Securely manages passenger data locally on the user's disk using AES-256-GCM encryption. Ensures passport details, emergency contacts, emails, and loyalty numbers are prefilled and ready for manual copy/autofill once booking opens.

```typescript
export interface PassengerProfile {
  id: string;
  name: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  loyaltyNumber?: string;
  encrypted: boolean;
  createdAt: Date;
}
```

* **Files to create:**
  1. `src/modules/profile/types.ts`
  2. `src/modules/profile/ProfileManager.ts` - Manages CRUD + local encryption
  3. `src/modules/profile/EncryptionService.ts` - AES-256-GCM service using `ENCRYPTION_KEY`
  4. `src/modules/profile/__tests__/profile.test.ts`
  5. `src/data/profiles.json` - Secure JSON storage file

---

### Module F: Rate Limiter & Compliance
**Purpose:** Protects the RAM and Amadeus backend APIs by enforcing a strict token bucket rate limit.
* **Default Rate Limit:** Max 10 requests per minute total to the target domain.

```typescript
export class TokenBucket {
  constructor(
    private maxTokens: number = 10,
    private refillRate: number = 1,
    private refillInterval: number = 6000 // Refill 1 token every 6 seconds
  ) {}
  
  async tryConsume(count: number = 1): Promise<boolean>;
  async waitForToken(): Promise<void>;
}
```

* **Files to create:**
  1. `src/modules/ratelimit/TokenBucket.ts`
  2. `src/modules/ratelimit/RateLimitGuard.ts` - Wrapper checking rate limits with logs
  3. `src/modules/ratelimit/__tests__/ratelimit.test.ts`

---

### Module G: Live Dashboard & Notifications
**Purpose:** Provides a premium, real-time UI showing campaign active status, API health, active monitors, queue status, and passenger readiness. Includes multi-channel alert delivery (Desktop, Discord, Slack, Email, Webhooks).

* **Premium Aesthetics:** Sleek dark-mode, neon/vibrant accent alerts, glassmorphic layout, micro-animations on inventory updates, state machines for monitors.
* **Notification Channels:**
  * **Desktop:** System level native alerts
  * **Discord / Slack:** Webhook integrations
  * **Email:** SMTP connection configuration
* **Files to create:**
  1. `src/modules/notifications/types.ts`
  2. `src/modules/notifications/NotificationEngine.ts`
  3. `src/modules/notifications/channels/DesktopNotifier.ts`
  4. `src/modules/notifications/channels/DiscordNotifier.ts`
  5. `src/modules/notifications/channels/SlackNotifier.ts`
  6. `src/modules/notifications/__tests__/notifications.test.ts`
  7. `src/server/index.ts` - Fastify HTTP API Backend
  8. `src/server/routes/api.ts` - API router endpoints
  9. `src/server/websocket.ts` - Subscribes event bus to frontend
  10. `src/server/EventBus.ts` - Local event emitter
  11. `src/frontend/...` - Next.js React Dashboard UI (using layout, page, status card, hook, panels)

---

## ⚡ Performance Constraints & Hard Limits
* **Maximum RAM API Traffic:** ≤ 10 requests / minute
* **Notification Latency:** < 500ms from detection
* **Storage Limit:** Up to 10 profiles max, saved entirely locally.
* **Security:** `ENCRYPTION_KEY` only lives in `.env`. No automatic token refresh without user providing active cookies.

---

## 🚀 Implementation Phases

### Phase 1: Scaffold & Reverse Engineering
* Set up workspace structure with typescript, vitest, next, fastify.
* Parse HAR capture file and construct `endpoints-catalog.json`.
* Answer OAuth token longevity and lifecycle questions.

### Phase 2: Core Monitors & Alerts
* Create the `TokenBucket` and `SearchExecutor` modules.
* Construct the `DiffEngine` and `AvailabilityMonitor`.
* Wire to the `NotificationEngine` for immediate webhook and desktop alerts.

### Phase 3: Booking readiness & Security
* Implement AES-256-GCM `EncryptionService`.
* Scaffold `ProfileManager` for CRUD operations on passenger files.
* Build passive `QueueObserver` parsing Queue-It cookies.

### Phase 4: Live Dashboard & Polish
* Assemble Fastify server & WebSocket routes.
* Construct premium Next.js Web UI showing all statistics, active monitors, and config fields.
* Perform comprehensive validation tests.

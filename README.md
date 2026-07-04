# GO LIONS Booking Intelligence Toolkit v3.0

The **GO LIONS Booking Intelligence Toolkit** is a premium, locally-run dashboard designed to help Moroccan supporters secure flight bookings during high-demand ticketing campaigns. 

It does **not** automate bookings or attempt to bypass virtual queues. Instead, it continuously monitors flight search APIs, provides real-time alerts, monitors waiting room metrics, and pre-prepares passenger information for split-second manual form submission.

---

## 🏗️ Target Architecture
* **Frontend Portal:** `golions.royalairmaroc.com`
* **Queue System:** Queue-It Waiting Room (`waitingroom.royalairmaroc.com`)
* **Booking SPA:** `digital.royalairmaroc.com` (Amadeus Digital Experience Suite)
* **API Gateway:** `api-des.royalairmaroc.com`

---

## ⚡ Key Features
1. **Dynamic Headers Session Bypass:** Since the Royal Air Maroc backend is protected by Akamai bot detection (`x-d-token`) and Imperva Incapsula (`x-incap-spa-info`), the toolkit allows you to copy-paste your active headers block directly into the dashboard. It will inherit these headers to run legitimate background checks.
2. **Passive Waiting Room Scraper:** Monitors your exact waiting room position and estimated wait times passively from your active session.
3. **Availability Watcher & Diff Engine:** Polls air calendar endpoints and immediately triggers native system audio and webhooks (Discord / Slack) if a status change is detected (e.g. `NO_FLIGHTS` &rarr; `FLIGHTS_AVAILABLE`).
4. **Encrypted passenger profile manager:** Securely encrypts passport numbers, loyalty data, and contacts on your local disk using AES-256-GCM.

---

## ⚙️ Quick Start (Local Setup)

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Configure Environment variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Ensure you have a 32-byte hexadecimal encryption key generated:
```bash
# To generate one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Place this key in the `ENCRYPTION_KEY` field in `.env`.

### 3. Run Test Suite
Verify that all toolkit modules are operating correctly:
```bash
npm test
```

### 4. Boot the Dashboard
Launch both Fastify server (:3001) and Next.js development server (:3000):
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to access the dashboard.

---

## 💡 How to Capture Session Headers from DevTools
Since API endpoints require browser-valid telemetry tokens, follow these steps to start monitoring:

1. Open your browser and navigate to the Royal Air Maroc booking search panel (or clear the Queue-It waiting room if active).
2. Press `F12` (or right-click &rarr; **Inspect**) and navigate to the **Network** tab.
3. Perform any flight search.
4. Locate the network request named `air-calendars` or `air-bounds` (type: `Fetch/XHR`).
5. Right-click the request:
   * Select **Copy** &rarr; **Copy request headers** (or **Copy as fetch**).
6. Go to the GO LIONS Dashboard (`http://localhost:3000`), paste the block into the **Active Session Headers** textarea, and click **Register Session Headers**.
7. Create your desired flight watchers!

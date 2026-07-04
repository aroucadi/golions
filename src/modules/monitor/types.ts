export interface MonitorConfig {
  route: string;            // e.g. "CMN-IAH"
  date: string;             // e.g. "2026-07-04"
  interval: number;         // in milliseconds (min: 10000)
  enabled: boolean;
}

export interface FlightSearchResult {
  id: string;
  timestamp: string;
  route: string;
  date: string;
  status: 'NO_FLIGHTS' | 'FLIGHTS_AVAILABLE' | 'ERROR' | 'RATE_LIMITED';
  flightsFound: number;
  rawResponse?: any;
  responseTimeMs: number;
  changeDetected: boolean;
  previousStatus?: string;
}

export interface ChangeDetection {
  changed: boolean;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type?: 'INVENTORY_APPEARED' | 'INVENTORY_SOLD_OUT' | 'FLIGHT_COUNT_CHANGED' | 'ERROR_DETECTED' | 'OTHER';
}

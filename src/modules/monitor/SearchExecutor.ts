import pino from 'pino';
import * as crypto from 'crypto';
import { MonitorConfig, FlightSearchResult } from './types';
import { rateLimitGuard } from '../ratelimit/RateLimitGuard';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class SearchExecutor {
  private activeToken: string | null = null;
  private activeCookies: string | null = null;
  private rawHeadersText: string | null = null;

  constructor() {}

  /**
   * Sets the active OAuth Bearer token and cookies.
   */
  public setCredentials(token: string | null, cookies: string | null): void {
    this.activeToken = token;
    this.activeCookies = cookies;
  }

  /**
   * Sets raw custom headers text copied directly from the browser.
   */
  public setRawHeaders(headersText: string | null): void {
    this.rawHeadersText = headersText;
  }

  /**
   * Checks if we currently have credentials or raw headers set.
   */
  public hasCredentials(): boolean {
    return !!this.activeToken || !!this.rawHeadersText;
  }

  /**
   * Parses the raw custom headers text into a key-value record.
   */
  private parseRawHeaders(text: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        // Skip browser-managed headers
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'content-length' || lowerKey === 'host' || lowerKey === 'accept-encoding') {
          continue;
        }
        headers[key] = value;
      }
    }
    return headers;
  }

  /**
   * Executes a search query using the Royal Air Maroc / Amadeus Search API.
   */
  /**
   * Automatically fetches a fresh OAuth token from the Amadeus serverless endpoint.
   */
  private async getFreshToken(): Promise<string | null> {
    try {
      const res = await fetch('https://api-des.royalairmaroc.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: new URLSearchParams({
          client_id: 'HAhyLShylWJE1AEXRvJ41cF7oqbI7Gch',
          client_secret: 'Wvd3imakms4XrKs7',
          grant_type: 'client_credentials',
          guest_office_id: 'CASAT08SC'
        }).toString(),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return data.access_token || null;
      }
    } catch (err) {
      logger.error('[SearchExecutor] Failed to auto-refresh OAuth token:', err);
    }
    return null;
  }

  /**
   * Executes a search query using the Royal Air Maroc / Amadeus Search API.
   */
  public async executeSearch(config: MonitorConfig): Promise<FlightSearchResult> {
    return rateLimitGuard.guard(async () => {
      const start = Date.now();
      const [origin, destination] = config.route.split('-');

      const searchPayload = {
        commercialFareFamilies: ['RAMNEWFF', 'RAMNEWFFBS'],
        itineraries: [
          {
            originLocationCode: origin || 'CMN',
            destinationLocationCode: destination || 'BOS',
            departureDateTime: `${config.date}T00:00:00.000`,
            isRequestedBound: true
          }
        ],
        travelers: [
          {
            passengerTypeCode: 'ADT'
          }
        ],
        searchPreferences: {
          showSoldOut: true
        }
      };

      const url = 'https://api-des.royalairmaroc.com/airlines/AT/v2/search/air-bounds?guestOfficeId=&language=en&useTest=false';
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://digital.royalairmaroc.com',
        'Referer': 'https://digital.royalairmaroc.com/',
        'x-spa': '1'
      };

      if (this.rawHeadersText) {
        const parsed = this.parseRawHeaders(this.rawHeadersText);
        headers = { ...headers, ...parsed };
      } else {
        if (this.activeToken) {
          headers['Authorization'] = this.activeToken.startsWith('Bearer ')
            ? this.activeToken
            : `Bearer ${this.activeToken}`;
        }
        if (this.activeCookies) {
          headers['Cookie'] = this.activeCookies;
        }
      }

      const searchId = crypto.randomUUID();

      const makeRequest = async (authHeader?: string) => {
        const requestHeaders = { ...headers };
        if (authHeader) {
          requestHeaders['Authorization'] = authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`;
        }
        
        return fetch(url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(searchPayload),
          signal: AbortSignal.timeout(10000)
        });
      };

      try {
        let response = await makeRequest();
        let elapsed = Date.now() - start;

        // Auto-heal on 401 Unauthorized (expired token)
        if (response.status === 401) {
          logger.info('[SearchExecutor] Detected 401 Unauthorized. Attempting automatic token refresh...');
          const freshToken = await this.getFreshToken();
          if (freshToken) {
            logger.info('[SearchExecutor] Fresh OAuth token obtained. Retrying search request...');
            // Cache the token locally
            this.activeToken = freshToken;
            response = await makeRequest(freshToken);
            elapsed = Date.now() - start;
          }
        }

        if (response.status === 429) {
          logger.warn(`[SearchExecutor] Rate limited by upstream server (429)`);
          return {
            id: searchId,
            timestamp: new Date().toISOString(),
            route: config.route,
            date: config.date,
            status: 'RATE_LIMITED',
            flightsFound: 0,
            responseTimeMs: elapsed,
            changeDetected: false
          };
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (data && Array.isArray(data.errors)) {
            const hasNoFlightsErr = data.errors.some(
              (err: any) => err.code === '7959' || (err.detail && err.detail.includes('NO AVAILABLE FLIGHT'))
            );
            if (hasNoFlightsErr) {
              return {
                id: searchId,
                timestamp: new Date().toISOString(),
                route: config.route,
                date: config.date,
                status: 'NO_FLIGHTS',
                flightsFound: 0,
                rawResponse: data,
                responseTimeMs: elapsed,
                changeDetected: false
              };
            }
          }

          logger.error(`[SearchExecutor] Request failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
          return {
            id: searchId,
            timestamp: new Date().toISOString(),
            route: config.route,
            date: config.date,
            status: 'ERROR',
            rawResponse: data || { error: `HTTP ${response.status}` },
            flightsFound: 0,
            responseTimeMs: elapsed,
            changeDetected: false
          };
        }

        let flightsFound = 0;
        if (data && data.airCalendarBounds) {
          flightsFound = Array.isArray(data.airCalendarBounds) ? data.airCalendarBounds.length : 0;
        } else if (data && data.itineraries) {
          flightsFound = Array.isArray(data.itineraries) ? data.itineraries.length : 0;
        } else if (data) {
          flightsFound = 1;
        }

        const status = flightsFound > 0 ? 'FLIGHTS_AVAILABLE' : 'NO_FLIGHTS';

        return {
          id: searchId,
          timestamp: new Date().toISOString(),
          route: config.route,
          date: config.date,
          status,
          flightsFound,
          rawResponse: data,
          responseTimeMs: elapsed,
          changeDetected: false
        };
      } catch (err: any) {
        const elapsed = Date.now() - start;
        logger.error(`[SearchExecutor] Connection error executing search for ${config.route} on ${config.date}:`, err);
        return {
          id: searchId,
          timestamp: new Date().toISOString(),
          route: config.route,
          date: config.date,
          status: 'ERROR',
          flightsFound: 0,
          rawResponse: { error: err.message || 'Connection failed' },
          responseTimeMs: elapsed,
          changeDetected: false
        };
      }
    });
  }
}

export const searchExecutor = new SearchExecutor();
export default searchExecutor;

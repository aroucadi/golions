import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { HARParser } from '../HARParser';
import { ReconEngine } from '../ReconEngine';

const mockHarPath = path.join(__dirname, 'mock-capture.har');
const testCatalogPath = path.join(__dirname, 'test-catalog.json');

const mockHarData = {
  log: {
    entries: [
      {
        request: {
          url: 'https://api-des.royalairmaroc.com/v1/security/oauth2/token',
          method: 'POST',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Authorization', value: 'Basic abc123def456' }
          ],
          postData: {
            text: JSON.stringify({ grant_type: 'client_credentials' })
          }
        },
        response: {
          content: {
            text: JSON.stringify({ access_token: 'mock_token', expires_in: 1800 })
          }
        }
      },
      {
        request: {
          url: 'https://api-des.royalairmaroc.com/airlines/AT/v2/search/air-calendars',
          method: 'POST',
          headers: [
            { name: 'Authorization', value: 'Bearer mock_token' },
            { name: 'Cookie', value: 'JSESSIONID=12345; queueit=true' }
          ],
          postData: {
            text: JSON.stringify({ itineraries: [{ originLocationCode: 'CMN' }] })
          }
        },
        response: {
          content: {
            text: JSON.stringify({ success: true })
          }
        }
      }
    ]
  }
};

describe('ReconEngine & HARParser', () => {
  beforeAll(() => {
    fs.writeFileSync(mockHarPath, JSON.stringify(mockHarData), 'utf8');
  });

  afterAll(() => {
    if (fs.existsSync(mockHarPath)) fs.unlinkSync(mockHarPath);
    if (fs.existsSync(testCatalogPath)) fs.unlinkSync(testCatalogPath);
  });

  test('HARParser should extract OAuth and flight search endpoints correctly', () => {
    const { catalog, authFlow } = HARParser.parse(mockHarPath);

    expect(catalog.endpoints).toHaveLength(2);
    expect(authFlow).toBeDefined();
    expect(authFlow?.tokenUrl).toBe('https://api-des.royalairmaroc.com/v1/security/oauth2/token');

    const searchEp = catalog.endpoints.find(ep => ep.path === '/airlines/AT/v2/search/air-calendars');
    expect(searchEp).toBeDefined();
    expect(searchEp?.method).toBe('POST');
    expect(searchEp?.authentication).toBe('OAUTH');
    expect(searchEp?.headers['Authorization']).toBe('Bearer [REDACTED]');
    expect(searchEp?.headers['Cookie']).toBe('[REDACTED]');
  });

  test('ReconEngine should build catalog file on disk', async () => {
    const engine = new ReconEngine(testCatalogPath);
    const catalog = await engine.loadFromHAR(mockHarPath);

    expect(fs.existsSync(testCatalogPath)).toBe(true);
    expect(catalog.endpoints.length).toBe(2);

    const auth = engine.getAuthFlow();
    expect(auth).not.toBeNull();
    expect(auth?.tokenUrl).toContain('/oauth2/token');
  });
});

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { SearchExecutor } from '../SearchExecutor';
import { MonitorConfig } from '../types';

describe('SearchExecutor', () => {
  test('should parse raw headers text correctly', () => {
    const executor = new SearchExecutor() as any;
    const rawText = `
Host: api-des.royalairmaroc.com
User-Agent: Mozilla/5.0
Accept-Encoding: gzip, deflate
Authorization: Bearer my_token
x-d-token: test-token-123
x-incap-spa-info: test-incap-info
    `;

    const parsed = executor.parseRawHeaders(rawText);

    // Host and Accept-Encoding should be skipped
    expect(parsed['Host']).toBeUndefined();
    expect(parsed['Accept-Encoding']).toBeUndefined();

    // Custom headers should be captured
    expect(parsed['User-Agent']).toBe('Mozilla/5.0');
    expect(parsed['Authorization']).toBe('Bearer my_token');
    expect(parsed['x-d-token']).toBe('test-token-123');
    expect(parsed['x-incap-spa-info']).toBe('test-incap-info');
  });

  test('should detect credentials status correctly', () => {
    const executor = new SearchExecutor();
    expect(executor.hasCredentials()).toBe(false);

    executor.setCredentials('token', null);
    expect(executor.hasCredentials()).toBe(true);

    executor.setCredentials(null, null);
    expect(executor.hasCredentials()).toBe(false);

    executor.setRawHeaders('Authorization: Bearer token');
    expect(executor.hasCredentials()).toBe(true);
  });
});

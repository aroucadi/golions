import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueObserver } from '../QueueObserver';

describe('QueueObserver', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return {
        text: async () => '<html><body>Queue-it mock page with queueId = "mock-id" and usersInLineAheadOfYou = 100</body></html>',
        ok: true
      };
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should detect Queue-It from cookies', async () => {
    const observer = new QueueObserver();
    const cookieText = 'someCookie=123; QueueITToken=mock-token-abc; other=abc';
    
    const state = await observer.analyzeSession(cookieText);
    expect(state.detected).toBe(true);
    expect(state.provider).toBe('QUEUE_IT');
  });

  test('should return negative detection if no queue cookies exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      return {
        text: async () => '<html><body>Normal landing page</body></html>',
        ok: true
      };
    }));

    const observer = new QueueObserver();
    const cookieText = 'JSESSIONID=12345; otherCookie=abc';
    const state = await observer.analyzeSession(cookieText);
    expect(state.detected).toBe(false);
    expect(state.provider).toBe('NONE');
  });
});

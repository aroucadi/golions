import { describe, test, expect, vi } from 'vitest';
import { QueueObserver } from '../QueueObserver';

describe('QueueObserver', () => {
  test('should detect Queue-It from cookies', async () => {
    const observer = new QueueObserver();
    const cookieText = 'someCookie=123; QueueITToken=mock-token-abc; other=abc';
    
    // We expect it to make a network request, but if it fails/falls back, it should still extract from cookies
    const state = await observer.analyzeSession(cookieText);
    expect(state.detected).toBe(true);
    expect(state.provider).toBe('QUEUE_IT');
    expect(state.queueId).toBe('mock-token-abc');
  });

  test('should return negative detection if no queue cookies exist', async () => {
    const observer = new QueueObserver();
    const cookieText = 'JSESSIONID=12345; otherCookie=abc';
    const state = await observer.analyzeSession(cookieText);
    expect(state.detected).toBe(false);
    expect(state.provider).toBe('NONE');
  });
});

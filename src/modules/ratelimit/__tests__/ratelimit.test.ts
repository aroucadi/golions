import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TokenBucket } from '../TokenBucket';

describe('TokenBucket Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('should initialize with maximum tokens', () => {
    const bucket = new TokenBucket(10, 1, 6000);
    expect(bucket.getTokens()).toBe(10);
  });

  test('should consume tokens successfully', () => {
    const bucket = new TokenBucket(10, 1, 6000);
    expect(bucket.tryConsume(3)).toBe(true);
    expect(bucket.getTokens()).toBe(7);
  });

  test('should fail to consume more tokens than available', () => {
    const bucket = new TokenBucket(10, 1, 6000);
    expect(bucket.tryConsume(11)).toBe(false);
    expect(bucket.getTokens()).toBe(10);
  });

  test('should refill tokens over time', () => {
    const bucket = new TokenBucket(10, 1, 6000);
    expect(bucket.tryConsume(5)).toBe(true);
    expect(bucket.getTokens()).toBe(5);

    // Fast-forward time by 6 seconds (1 refill interval)
    vi.advanceTimersByTime(6000);
    expect(bucket.getTokens()).toBe(6);

    // Fast-forward by 18 seconds (3 refill intervals)
    vi.advanceTimersByTime(18000);
    expect(bucket.getTokens()).toBe(9);

    // Fast-forward by 24 seconds (more than needed to reach max)
    vi.advanceTimersByTime(24000);
    expect(bucket.getTokens()).toBe(10);
  });

  test('should block and wait for token when calling waitForToken', async () => {
    const bucket = new TokenBucket(1, 1, 6000);
    expect(bucket.tryConsume(1)).toBe(true);

    const waitPromise = bucket.waitForToken();

    // The promise should not be resolved yet
    let resolved = false;
    waitPromise.then(() => {
      resolved = true;
    });

    // Run tick timers
    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toBe(false);

    // Run remaining refill interval time
    await vi.advanceTimersByTimeAsync(5000);
    await waitPromise;
    expect(resolved).toBe(true);
  });
});

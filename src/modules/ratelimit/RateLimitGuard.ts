import { TokenBucket } from './TokenBucket';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

export class RateLimitGuard {
  private bucket: TokenBucket;

  constructor(bucket?: TokenBucket) {
    // Default bucket: Max 10 tokens, refill 1 token every 6 seconds
    this.bucket = bucket || new TokenBucket(10, 1, 6000);
  }

  /**
   * Executes the provided async function, ensuring that the rate limit is respected.
   * If tokens are exhausted, it blocks and waits until a token is available.
   */
  public async guard<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const available = this.bucket.getTokens();

    if (available < 1) {
      logger.warn('[RateLimitGuard] Rate limit threshold reached. Delaying outbound request...');
      await this.bucket.waitForToken();
      logger.info(`[RateLimitGuard] Resuming request after waiting ${Date.now() - start}ms for token.`);
    } else {
      this.bucket.tryConsume(1);
    }

    return fn();
  }

  /**
   * Gets the remaining tokens in the bucket.
   */
  public getRemainingTokens(): number {
    return this.bucket.getTokens();
  }
}

export const rateLimitGuard = new RateLimitGuard();
export default rateLimitGuard;

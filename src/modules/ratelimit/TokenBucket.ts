export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 10,
    private refillRate: number = 1,
    private refillIntervalMs: number = 6000 // 6 seconds per token (10 per minute)
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refills tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs) * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      
      // Update lastRefill to the boundary of the refilled interval
      this.lastRefill = now - (elapsed % this.refillIntervalMs);
    }
  }

  /**
   * Tries to consume the specified number of tokens.
   * Returns true if successful, false otherwise.
   */
  public tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /**
   * Waits until a token is available and consumes it.
   */
  public async waitForToken(): Promise<void> {
    while (!this.tryConsume(1)) {
      // Sleep for 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Gets the current number of tokens available in the bucket.
   */
  public getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

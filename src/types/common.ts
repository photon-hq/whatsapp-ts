/** Options for automatic retry with exponential back-off. */
export interface RetryOptions {
  /** Initial delay in milliseconds before the first retry. */
  readonly initialDelay?: number;
  /** Maximum number of attempts, including the initial call. */
  readonly maxAttempts?: number;
  /** Maximum delay in milliseconds between attempts. */
  readonly maxDelay?: number;
}

/** Shared options for write methods. */
export interface WriteOptions {
  /**
   * Stable id for one logical write.
   *
   * Reuse the same value only when retrying that exact write. Do not share one
   * value across different messages, reactions, polls, votes, or unvotes.
   */
  readonly clientMessageId?: string;
}

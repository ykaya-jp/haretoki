/**
 * Shared types for rate-limit backends. The public API in
 * `src/lib/rate-limit.ts` re-exports these so callers don't need to know
 * which backend (in-memory or Redis) is currently active.
 */

export interface RateLimitOptions {
  /** Maximum hits allowed inside `windowMs`. */
  limit: number;
  /** Sliding window in milliseconds. */
  windowMs: number;
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAtMs: number }
  | {
      allowed: false;
      retryAfterMs: number;
      retryAfterSec: number;
      limit: number;
      windowMs: number;
    };

/**
 * A rate-limit backend. Implementations MUST atomically (or near-
 * atomically) increment + check, to avoid the race where two concurrent
 * requests both see "under limit" and both succeed past the cap.
 *
 * Redis backends use a sorted-set + pipeline; in-memory backend is
 * single-threaded inside one V8 instance so trivially atomic.
 */
export interface RateLimitBackend {
  /**
   * Check + record a single hit. Returns the verdict; callers decide
   * whether to short-circuit on `allowed: false`.
   *
   * The `now` parameter is exposed for tests (so they can drive a
   * deterministic clock); production callers leave it default.
   */
  check(
    key: string,
    opts: RateLimitOptions,
    now?: number,
  ): Promise<RateLimitResult>;

  /** Test-only: clear all state so specs don't bleed into each other. */
  reset(): Promise<void>;

  /** Diagnostic — which backend is active. Used by ops doc / debug pages. */
  readonly name: "in-memory" | "redis";
}

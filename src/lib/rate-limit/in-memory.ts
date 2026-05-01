/**
 * In-memory rate-limit backend. Single function instance, sliding window.
 *
 * Scope caveat: serverless function instances do NOT share state, so the
 * effective limit is "per-instance" and a sufficiently busy app may
 * cluster traffic across N instances and let through N × limit.
 *
 * For local dev, CI, and Vercel deployments without an Upstash Redis
 * provisioned this is the active backend. Production with
 * `UPSTASH_REDIS_REST_URL` set falls through to the Redis backend
 * (`./redis.ts`) instead.
 */

import type {
  RateLimitBackend,
  RateLimitOptions,
  RateLimitResult,
} from "./types";

interface KeyState {
  timestamps: number[];
  lastTouchedMs: number;
}

const store = new Map<string, KeyState>();
const MAX_KEYS = 10_000;

function pruneIfNeeded(): void {
  if (store.size <= MAX_KEYS) return;
  // LRU drop the bottom 10% by lastTouchedMs. Cheap O(N log N) sort
  // amortised over rare resize events.
  const entries = Array.from(store.entries()).sort(
    (a, b) => a[1].lastTouchedMs - b[1].lastTouchedMs,
  );
  const drop = Math.floor(MAX_KEYS * 0.1);
  for (let i = 0; i < drop; i++) {
    store.delete(entries[i][0]);
  }
}

export const inMemoryBackend: RateLimitBackend = {
  name: "in-memory",

  async check(
    key: string,
    opts: RateLimitOptions,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    if (!key || opts.limit <= 0 || opts.windowMs <= 0) {
      return { allowed: true, remaining: opts.limit, resetAtMs: now };
    }

    pruneIfNeeded();

    const cutoff = now - opts.windowMs;
    const existing = store.get(key);
    const recent = existing
      ? existing.timestamps.filter((t) => t > cutoff)
      : [];

    if (recent.length >= opts.limit) {
      const oldest = recent[0];
      const retryAfterMs = Math.max(0, oldest + opts.windowMs - now);
      // Touch lastTouchedMs even on rejection so we don't preferentially
      // evict an active (but throttled) key in the LRU pass.
      store.set(key, {
        timestamps: recent,
        lastTouchedMs: now,
      });
      return {
        allowed: false,
        retryAfterMs,
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
        limit: opts.limit,
        windowMs: opts.windowMs,
      };
    }

    recent.push(now);
    store.set(key, { timestamps: recent, lastTouchedMs: now });
    const resetAtMs = recent[0] + opts.windowMs;
    return {
      allowed: true,
      remaining: Math.max(0, opts.limit - recent.length),
      resetAtMs,
    };
  },

  async reset(): Promise<void> {
    store.clear();
  },
};

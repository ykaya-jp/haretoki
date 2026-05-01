/**
 * Generic rate limiter — sliding-window, in-memory.
 *
 * Two callers feed into this:
 *
 *   - hot Server Actions that hit Claude (sendCoachMessage,
 *     addVenueFromUrl, analyzeEstimatePdf) — protect upstream cost +
 *     prevent a single user from monopolising the project's quota
 *
 *   - any future Server Action that needs per-user / per-IP throttling
 *     (no separate ad-hoc Map+minute counter — replace those with this
 *     module so the eviction policy lives in one place)
 *
 * Eviction:
 *   - per-key timestamp list, kept under windowMs by drop-on-check
 *   - bounded by MAX_KEYS (LRU-on-access) so a flood of unique keys
 *     can't OOM the function instance
 *
 * Scope caveat:
 *   - serverless function instances do NOT share state, so the effective
 *     limit is "per-instance" and a sufficiently busy app may cluster
 *     traffic across N instances and let through N × limit. For Phase 2
 *     this is acceptable (the threat model is "single user spamming",
 *     not "coordinated DoS"); a Redis-backed sink (Upstash) is the
 *     P3 upgrade path. Both implementations should expose the same
 *     `checkRateLimit(key, opts)` so swapping is a one-line edit at the
 *     callsite.
 */

interface KeyState {
  timestamps: number[];
  lastTouchedMs: number;
}

const store = new Map<string, KeyState>();
const MAX_KEYS = 10_000;

export interface RateLimitOptions {
  /** Maximum hits allowed inside windowMs. */
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
 * Check + record a hit. Returns `{allowed:true}` after recording, or
 * `{allowed:false}` without recording when the window is full.
 *
 * Important: this both **checks AND records** in one call. Callers should
 * invoke once per request, ideally as the first thing after auth — calling
 * it twice double-counts and starves the user out.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  if (!key || opts.limit <= 0 || opts.windowMs <= 0) {
    // Misconfigured — don't block the user, but log so it's visible.
    return { allowed: true, remaining: opts.limit, resetAtMs: now };
  }

  pruneIfNeeded();

  const cutoff = now - opts.windowMs;
  const existing = store.get(key);
  const recent = existing
    ? existing.timestamps.filter((t) => t > cutoff)
    : [];

  if (recent.length >= opts.limit) {
    // Compute how long until the oldest in-window timestamp falls off.
    // recent[0] is the oldest; its expiry = recent[0] + windowMs.
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
}

/**
 * Convenience wrapper: returns a Server-Action-friendly result object the
 * caller can return verbatim from a `{ ok: false, error }` shape.
 */
export function rateLimitErrorMessage(
  result: RateLimitResult,
  noun: string = "操作",
): string | null {
  if (result.allowed) return null;
  const sec = result.retryAfterSec;
  return `${noun}の頻度が高すぎます。${sec}秒後に再度お試しください。`;
}

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

/** Test-only — clears all state so specs don't bleed into each other. */
export function _resetRateLimitStore(): void {
  store.clear();
}

/**
 * Recommended per-action presets. Callers SHOULD use these constants so a
 * limit change is one edit here, not a hunt across server actions.
 *
 * Tuning rationale (per-user, per-60s):
 *   - coach chat: high engagement is normal; cap at 30/min stops a tab
 *     from holding the cursor on send
 *   - URL import: each call does multi-page fetch + Claude extraction;
 *     5/min is generous for genuine browsing-and-pasting flow
 *   - PDF analysis: each call holds Claude for up to 55s on document-block;
 *     3/min keeps a function instance from queuing up >3 long-runnings
 */
export const RATE_LIMITS = {
  COACH_MESSAGE: { limit: 30, windowMs: 60_000 },
  URL_IMPORT: { limit: 5, windowMs: 60_000 },
  PDF_ANALYZE: { limit: 3, windowMs: 60_000 },
} as const;

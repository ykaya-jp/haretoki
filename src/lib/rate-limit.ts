/**
 * Generic rate limiter — public API.
 *
 * Two backends behind a single interface:
 *
 *  - **in-memory** (default, `src/lib/rate-limit/in-memory.ts`): single
 *    function instance, sliding window. Used for local dev, CI, and any
 *    Vercel deployment without an Upstash Redis attached. Cheap, zero
 *    infra, but per-instance — N concurrent function instances each get
 *    their own bucket.
 *
 *  - **redis** (`src/lib/rate-limit/redis.ts`): cluster-wide sliding
 *    window via Upstash Redis (`@upstash/redis`). Solves the per-instance
 *    leak. Activated when both `UPSTASH_REDIS_REST_URL` and
 *    `UPSTASH_REDIS_REST_TOKEN` are set.
 *
 * The `checkRateLimit` API stays IDENTICAL across backends so call sites
 * (`src/server/actions/coach.ts`, `src/server/actions/venues.ts`, etc.)
 * don't change when ops swaps backends.
 *
 * Note: the public function is now `async` (was sync in the in-memory-
 * only version). Existing call sites already `await` the result, so this
 * is a no-op migration on the client side.
 *
 * Tests opt into the in-memory backend by leaving the Upstash env vars
 * unset; production opts into Redis by setting them via Vercel
 * Marketplace's Upstash integration.
 */

import { inMemoryBackend } from "./rate-limit/in-memory";
import { redisBackend } from "./rate-limit/redis";
import type {
  RateLimitBackend,
  RateLimitOptions,
  RateLimitResult,
} from "./rate-limit/types";

export type { RateLimitOptions, RateLimitResult } from "./rate-limit/types";

/**
 * Pick the active backend based on env. Re-evaluated on every call so
 * tests can flip env vars between specs without re-importing the module.
 * The cost is negligible — env lookup is O(1).
 */
function activeBackend(): RateLimitBackend {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redisBackend : inMemoryBackend;
}

/**
 * Check + record a hit. Returns `{allowed:true}` after recording, or
 * `{allowed:false}` without recording when the window is full.
 *
 * Important: this both **checks AND records** in one call. Callers should
 * invoke once per request, ideally as the first thing after auth — calling
 * it twice double-counts and starves the user out.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  return activeBackend().check(key, opts, now);
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

/** Diagnostic — used by ops doc / debug pages. */
export function activeBackendName(): "in-memory" | "redis" {
  return activeBackend().name;
}

/** Test-only — clears all state so specs don't bleed into each other. */
export async function _resetRateLimitStore(): Promise<void> {
  await activeBackend().reset();
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

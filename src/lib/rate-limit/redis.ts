/**
 * Upstash Redis rate-limit backend. Cluster-wide sliding window —
 * solves the "per-instance" leak inherent to the in-memory backend.
 *
 * Algorithm (sorted-set sliding window):
 *
 *   1. ZREMRANGEBYSCORE key 0 (now - windowMs)   — drop expired entries
 *   2. ZCARD key                                 — count remaining
 *   3a. If count >= limit: ZRANGE key 0 0 WITHSCORES → compute retry
 *   3b. Else: ZADD key <now> <member>            — record the new hit
 *   4. EXPIRE key (windowMs/1000 + 60)           — auto-cleanup keys
 *
 * Steps 1+2 run as a single pipeline so the read is a consistent
 * snapshot of the cleared set; ZADD + EXPIRE are then issued together.
 * That's not strictly atomic (between step 2 and step 3b another caller
 * could slip in), but the sliding window absorbs single-step races: the
 * worst case is one extra hit through the cap, not unbounded leakage.
 *
 * Member format: `<now>:<random>` so ZADD entries don't collide on
 * identical timestamps from concurrent callers (which would cause one
 * hit to silently disappear into an existing score-only entry).
 */

import { Redis } from "@upstash/redis";
import type {
  RateLimitBackend,
  RateLimitOptions,
  RateLimitResult,
} from "./types";

let cachedClient: Redis | null = null;

/**
 * Lazy singleton — Vercel function cold start may not have the env var
 * available at module load time, and tests can swap it before import.
 */
function getClient(): Redis {
  if (cachedClient) return cachedClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set when using the Redis rate-limit backend",
    );
  }
  cachedClient = new Redis({ url, token });
  return cachedClient;
}

/** Test-only: drop the cached client so a re-import with new env wires fresh. */
export function _resetRedisClient(): void {
  cachedClient = null;
}

const KEY_PREFIX = "rl:";

function keyOf(scope: string): string {
  return `${KEY_PREFIX}${scope}`;
}

function makeMember(now: number): string {
  // 6-byte random suffix is enough to dedupe within a single millisecond
  // even under heavy burst — collision probability < 2^-48 per pair.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${now}:${rand}`;
}

export const redisBackend: RateLimitBackend = {
  name: "redis",

  async check(
    rawKey: string,
    opts: RateLimitOptions,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    if (!rawKey || opts.limit <= 0 || opts.windowMs <= 0) {
      return { allowed: true, remaining: opts.limit, resetAtMs: now };
    }

    const key = keyOf(rawKey);
    const cutoff = now - opts.windowMs;
    const client = getClient();

    // Pipeline: prune expired + count remaining in one round-trip.
    const [, count] = (await client
      .pipeline()
      .zremrangebyscore(key, 0, cutoff)
      .zcard(key)
      .exec()) as [number, number];

    if (count >= opts.limit) {
      // Inspect the oldest in-window timestamp so we can compute a
      // precise retryAfter rather than just `windowMs`.
      const oldest = (await client.zrange(key, 0, 0, {
        withScores: true,
      })) as Array<string | number>;
      // zrange WITHSCORES returns [member, score, member, score, ...].
      const oldestScore = typeof oldest[1] === "number" ? oldest[1] : Number(oldest[1]);
      const retryAfterMs = Number.isFinite(oldestScore)
        ? Math.max(0, oldestScore + opts.windowMs - now)
        : opts.windowMs;
      return {
        allowed: false,
        retryAfterMs,
        retryAfterSec: Math.ceil(retryAfterMs / 1000),
        limit: opts.limit,
        windowMs: opts.windowMs,
      };
    }

    // Under the limit: record the hit + bump TTL so the key auto-cleans
    // when traffic stops. TTL slack of 60s keeps a single late retry
    // from creating a brand-new key after the previous one expired
    // mid-flight.
    const ttlSec = Math.ceil(opts.windowMs / 1000) + 60;
    await client
      .pipeline()
      .zadd(key, { score: now, member: makeMember(now) })
      .expire(key, ttlSec)
      .exec();

    // resetAtMs is approximate — the new oldest entry is now+0 if this
    // was the first hit, otherwise the prior oldest. We took the prior
    // oldest in step 1 indirectly via count; re-querying would be a
    // wasted round-trip. The calculated resetAtMs feeds a "next reset
    // hint" for callers, never strict math, so approximating is fine.
    const resetAtMs = now + opts.windowMs;
    return {
      allowed: true,
      remaining: Math.max(0, opts.limit - (count + 1)),
      resetAtMs,
    };
  },

  async reset(): Promise<void> {
    // Tests don't get a real Redis — they mock the module. This method
    // exists so production diagnostics can wipe a key namespace if
    // needed; intentionally NOT exposed via the public API to prevent
    // accidental cluster-wide flush.
    if (process.env.NODE_ENV === "test") return;
    throw new Error(
      "redisBackend.reset() is intentionally restricted; use Upstash console for prod cleanup",
    );
  },
};

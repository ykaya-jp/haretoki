/**
 * F1 quota counter — per-project soft cap for paid third-party APIs.
 *
 * Two roles:
 *   1. `canCallPlaces(projectId)` — check BEFORE the paid call. Returns
 *      `{ allowed: false }` when the project has exhausted its monthly
 *      Places Autocomplete budget, so the caller degrades to Tier 3 only.
 *   2. `incrementPlacesCounter(projectId, by=1)` — bump AFTER a successful
 *      paid call. Failed calls are NOT counted (we don't bill the user
 *      for our network hiccup).
 *
 * The cap is `PLACES_AUTOCOMPLETE_MONTHLY_CAP` env var (default 3000),
 * matching the design's soft-cap spec.
 *
 * Rate-limit (per-project, per-minute) is intentionally in-memory:
 * Supabase row churn per keystroke is wasteful and the counter doesn't
 * need cross-instance accuracy — an occasional 5% over-throttle is fine.
 */

import { prisma } from "@/server/db";

/** Rate-limit bucket. `minuteKey` resets via the natural minute boundary. */
interface RateBucket {
  minuteKey: string;
  count: number;
}

const rateBuckets = new Map<string, RateBucket>();

function currentMinuteKey(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
}

function currentYearMonth(now: number = Date.now()): string {
  const d = new Date(now);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}`;
}

/** Per-project per-minute limit. Soft fail = `{ throttled: true }`. */
export function checkRateLimit(projectId: string, now: number = Date.now()):
  | { ok: true }
  | { ok: false } {
  const key = currentMinuteKey(now);
  const cap = Number(process.env.NAME_SEARCH_RATE_LIMIT_PER_MIN ?? "20");
  const bucket = rateBuckets.get(projectId);
  if (!bucket || bucket.minuteKey !== key) {
    rateBuckets.set(projectId, { minuteKey: key, count: 1 });
    return { ok: true };
  }
  if (bucket.count >= cap) return { ok: false };
  bucket.count += 1;
  return { ok: true };
}

/** Test-only escape hatch. */
export function _resetRateBuckets() {
  rateBuckets.clear();
}

/**
 * Can the project still call Places Autocomplete this month?
 * Returns `{ allowed, used, cap }` so callers can log the breach without
 * re-querying.
 */
export async function canCallPlaces(
  projectId: string,
  now: number = Date.now(),
): Promise<{ allowed: boolean; used: number; cap: number }> {
  const cap = Number(process.env.PLACES_AUTOCOMPLETE_MONTHLY_CAP ?? "3000");
  const yearMonth = currentYearMonth(now);
  const row = await prisma.apiUsageCounter.findUnique({
    where: {
      projectId_yearMonth: { projectId, yearMonth },
    },
  });
  const used = row?.placesAutocompleteCount ?? 0;
  return { allowed: used < cap, used, cap };
}

/**
 * Bump the counter AFTER a successful paid call.
 * Upsert is idempotent on (projectId, yearMonth).
 */
export async function incrementPlacesCounter(
  projectId: string,
  by: number = 1,
  now: number = Date.now(),
): Promise<void> {
  const yearMonth = currentYearMonth(now);
  await prisma.apiUsageCounter.upsert({
    where: { projectId_yearMonth: { projectId, yearMonth } },
    create: {
      projectId,
      yearMonth,
      placesAutocompleteCount: by,
    },
    update: {
      placesAutocompleteCount: { increment: by },
    },
  });
}

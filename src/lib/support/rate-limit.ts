/**
 * Per-user in-memory rate limit for the /support contact form.
 *
 * Intentional over a Redis bucket: the cap is small (5 / hour) and the
 * form is not high-volume, so cross-instance drift is acceptable — at
 * worst a couple gets to send 6 in an hour by hitting two cold
 * serverless instances. A separate file keeps the test-only reset hook
 * out of the "use server" boundary so it cannot leak as a callable
 * server action.
 */

interface SupportBucket {
  /** Hour-resolution key — switches over a natural hour boundary. */
  hourKey: string;
  count: number;
}

const supportBuckets = new Map<string, SupportBucket>();

const SUPPORT_RATE_LIMIT_PER_HOUR = Number(
  process.env.SUPPORT_RATE_LIMIT_PER_HOUR ?? "5",
);

function currentHourKey(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
}

export function checkSupportRateLimit(
  userId: string,
  now: number = Date.now(),
): { ok: true } | { ok: false } {
  const key = currentHourKey(now);
  const bucket = supportBuckets.get(userId);
  if (!bucket || bucket.hourKey !== key) {
    supportBuckets.set(userId, { hourKey: key, count: 1 });
    return { ok: true };
  }
  if (bucket.count >= SUPPORT_RATE_LIMIT_PER_HOUR) return { ok: false };
  bucket.count += 1;
  return { ok: true };
}

/** Test-only escape hatch. Plain (non-async) export so it cannot be
 *  reached as a Server Action from client code. */
export function _resetSupportRateBuckets() {
  supportBuckets.clear();
}

/**
 * Visit reminder scheduling — daily-cron edition (Hobby-plan compatible).
 *
 * Three phases run as separate Vercel cron entries:
 * - `day_before` fires at 19:00 JST → notifies couples whose visit lands
 *   on the next JST calendar day. Evening lead-time matches the
 *   "夜にメール届いて翌日の予定確認" ergonomics.
 * - `morning_of` fires at 08:00 JST → notifies couples whose visit lands
 *   today (JST). Morning lead-time covers final prep + departure.
 * - `way_home`   fires at 22:00 JST → reminds couples whose visit was
 *   earlier today (JST) to leave a memo while impressions are fresh.
 *   Track B-2 addition; the candidate filter switches to "scheduled
 *   today AND already past" instead of "future today".
 *
 * The earlier hourly design also offered `before_departure` (~2h before
 * the visit start). That tier is dropped here because Vercel Hobby cron
 * only accepts daily granularity, and a 2h-before window can't be served
 * accurately by a once-per-day fire. Re-introducing it requires a Pro
 * plan upgrade or a self-hosted scheduler — neither is in scope for the
 * daily-only baseline.
 */

export type VisitReminderPhase = "day_before" | "morning_of" | "way_home";

const HOUR_MS = 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * HOUR_MS;

/**
 * Convert a UTC instant to its "JST calendar date" key (YYYY-MM-DD). The
 * caller compares two such keys to decide whether a visit lands today /
 * tomorrow / etc. — pure string equality after this normalisation, no
 * Date arithmetic needed in the call site.
 */
export function jstDateKey(utc: Date): string {
  const shifted = new Date(utc.getTime() + JST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** JST date key for the day after the given instant. */
export function jstTomorrowDateKey(utc: Date): string {
  return jstDateKey(new Date(utc.getTime() + 24 * HOUR_MS));
}

export interface ClassifyInput {
  scheduledAt: Date;
  now: Date;
}

/**
 * Decide whether the (visit, now) pair matches the given phase. Each cron
 * endpoint pins the phase explicitly (so the cron schedule itself encodes
 * intent) and uses this helper only for the per-visit eligibility check —
 * "is this visit one we should notify about *now*?".
 *
 * Returns false for past visits (deltaMs <= 0) regardless of phase, so the
 * caller doesn't have to special-case "scheduled in the past but
 * status=scheduled" data anomalies.
 */
export function isVisitInPhaseWindow(
  phase: VisitReminderPhase,
  input: ClassifyInput,
): boolean {
  const deltaMs = input.scheduledAt.getTime() - input.now.getTime();
  const visitKey = jstDateKey(input.scheduledAt);

  if (phase === "way_home") {
    // Memo nudge: the visit was earlier *today* (JST). Past-only — a
    // visit later this evening shouldn't fire the recap nudge yet.
    if (deltaMs >= 0) return false;
    return visitKey === jstDateKey(input.now);
  }

  // day_before / morning_of are forward-looking; past visits are noise.
  if (deltaMs <= 0) return false;

  if (phase === "day_before") {
    return visitKey === jstTomorrowDateKey(input.now);
  }
  // phase === "morning_of"
  return visitKey === jstDateKey(input.now);
}

/**
 * Notification.type marker used for per-user dedupe. Format is shared with
 * the future inbox UI so the same string can mean both "mark this visit
 * notified" and "show this badge in the inbox".
 */
export function visitReminderType(
  phase: VisitReminderPhase,
  visitId: string,
): string {
  return `visit_reminder_${phase}:${visitId}`;
}

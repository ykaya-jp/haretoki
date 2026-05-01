/**
 * Visit reminder scheduling — pure classification helpers.
 *
 * Phase classification deliberately lives in a pure function (no DB, no I/O)
 * so the cron handler stays a thin orchestrator and the time-window logic
 * can be exercised by unit tests without spinning up Prisma / Resend.
 *
 * The cron fires hourly (`0 * * * *`). Each invocation evaluates every
 * upcoming visit against `classifyVisitReminderPhase` and dispatches the
 * matching reminder — or skips when no phase applies for the current
 * (visit, now) pair.
 */

export type VisitReminderPhase =
  | "day_before"
  | "morning_of"
  | "before_departure";

export interface ClassifyInput {
  /** Visit's scheduled start (UTC Date object — same as Prisma returns). */
  scheduledAt: Date;
  /** Cron run time (UTC Date object). Tests inject a fixed instant. */
  now: Date;
}

const HOUR_MS = 60 * 60 * 1000;

/** JST offset in ms (+09:00, no DST). */
const JST_OFFSET_MS = 9 * HOUR_MS;

/** Convert a UTC Date to a "JST calendar parts" view without mutating. */
function jstParts(d: Date): { ymd: string; hour: number } {
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return { ymd: `${y}-${m}-${day}`, hour: shifted.getUTCHours() };
}

/** JST YYYY-MM-DD string for the day after the given date. */
function tomorrowJstYmd(d: Date): string {
  const tomorrow = new Date(d.getTime() + 24 * HOUR_MS);
  return jstParts(tomorrow).ymd;
}

/**
 * Classify which reminder phase (if any) should fire for this (visit, now)
 * pair. Returns `null` when no phase matches — the caller skips this visit
 * for this cron tick.
 *
 * Window choices:
 * - day_before: visit is tomorrow JST AND it is currently 18:00-20:59 JST.
 *   Three eligible cron ticks (18 / 19 / 20) per visit, dedupe handles the
 *   second and third. Evening window matches "夜にメール届いて翌日の予定確認"
 *   ergonomics; firing at 9am the previous day would feel premature.
 * - morning_of: visit is today JST, more than 3h away, AND now is 7:00-9:59
 *   JST. Three eligible ticks; dedupe collapses to one notification.
 *   3h floor avoids overlapping with `before_departure` for early visits
 *   (e.g. 10:00 visit would otherwise fire both at 7am).
 * - before_departure: visit is 1.5-2.5h away in real time, regardless of
 *   wall clock. Two cron ticks are eligible; dedupe collapses to one.
 *   1.5h floor leaves the user enough time to actually leave; 2.5h ceiling
 *   keeps the message from feeling disconnected from departure.
 */
export function classifyVisitReminderPhase(
  input: ClassifyInput,
): VisitReminderPhase | null {
  const { scheduledAt, now } = input;
  const deltaMs = scheduledAt.getTime() - now.getTime();

  // Past or in-progress visits never get reminders.
  if (deltaMs <= 0) return null;

  const hoursUntil = deltaMs / HOUR_MS;
  const visitYmd = jstParts(scheduledAt).ymd;
  const nowParts = jstParts(now);
  const tomorrowYmd = tomorrowJstYmd(now);

  // 1. before_departure has the tightest window — check first so we don't
  //    accidentally skip an early-morning visit through the morning_of
  //    branch (3h floor) only to miss before_departure as well.
  if (hoursUntil >= 1.5 && hoursUntil <= 2.5) {
    return "before_departure";
  }

  // 2. day_before: visit is tomorrow JST, evening window now.
  if (visitYmd === tomorrowYmd && nowParts.hour >= 18 && nowParts.hour <= 20) {
    return "day_before";
  }

  // 3. morning_of: visit is today JST, morning window now, comfortable
  //    runway (> 3h) so the user has time to act on the reminder.
  if (
    visitYmd === nowParts.ymd &&
    nowParts.hour >= 7 &&
    nowParts.hour <= 9 &&
    hoursUntil > 3
  ) {
    return "morning_of";
  }

  return null;
}

/**
 * The Notification.type marker used for per-user dedupe. Keeping the format
 * inline-documented here (rather than only in the cron route) so any future
 * inbox / settings UI that needs to recognise these can reuse the same
 * shape.
 */
export function visitReminderType(
  phase: VisitReminderPhase,
  visitId: string,
): string {
  return `visit_reminder_${phase}:${visitId}`;
}

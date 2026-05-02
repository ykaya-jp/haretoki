/**
 * Track C-2 wedding-day countdown — pure helpers.
 *
 * No Prisma / framework deps so spec runners can import directly.
 * Date arithmetic is done in JST (UTC+9) so the countdown advances
 * exactly at midnight JST regardless of the server's timezone or the
 * UTC date boundary — a couple looking at "あと 152 日" at 23:30 JST
 * shouldn't see it tick to 151 just because UTC has rolled over.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const JST_OFFSET_MS = 9 * HOUR_MS;

export type WeddingCountdownState =
  /** No `Decision.weddingDate` set yet — UI shows the "set date" CTA. */
  | { state: "no-date" }
  /** Wedding is later today (JST). UI shows "今日が晴れの日" copy. */
  | { state: "today"; daysUntil: 0 }
  /** Future wedding. UI renders the big number + next-step todo. */
  | { state: "future"; daysUntil: number }
  /** Wedding is in the past. UI shows "ありがとうございました" copy. */
  | { state: "past"; daysSince: number };

/**
 * JST midnight epoch for the given instant. Used as the canonical
 * date-only anchor on both sides of the subtraction so we get a clean
 * integer day delta regardless of what time of day the call lands.
 *
 * Internal helper — exported so the spec can pin the conversion.
 */
export function jstMidnightEpoch(d: Date): number {
  const shifted = d.getTime() + JST_OFFSET_MS;
  // Floor to the JST calendar day, then translate back to a real epoch
  // by undoing the shift. The result is the UTC instant equal to JST
  // 00:00 of `d`'s JST date.
  const jstDayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return jstDayStartShifted - JST_OFFSET_MS;
}

export interface CountdownInput {
  /** Decision.weddingDate value, or null when never set. */
  weddingDate: Date | null | undefined;
  /** Defaults to `new Date()`. Injectable for tests. */
  now?: Date;
}

/**
 * Project the (weddingDate, now) pair onto one of the four UI branches.
 * `daysUntil` is the JST calendar-day delta — same JST date as `now`
 * yields 0 (= "today"), one JST date later yields 1, etc.
 *
 * Past + same-day-but-already-decided rendering is the caller's choice;
 * we report the math, the component renders the copy.
 */
export function weddingCountdownState(
  input: CountdownInput,
): WeddingCountdownState {
  if (!input.weddingDate) return { state: "no-date" };

  const now = input.now ?? new Date();
  const target = jstMidnightEpoch(input.weddingDate);
  const today = jstMidnightEpoch(now);
  const daysDelta = Math.round((target - today) / DAY_MS);

  if (daysDelta === 0) return { state: "today", daysUntil: 0 };
  if (daysDelta < 0) return { state: "past", daysSince: -daysDelta };
  return { state: "future", daysUntil: daysDelta };
}

/**
 * Format a JST month/day label (e.g. "5月16日") for the wedding date
 * caption. Year intentionally dropped — the countdown is the lead
 * affordance and the year is noise alongside "あと N 日".
 */
export function formatWeddingDateLabel(d: Date): string {
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  return `${shifted.getUTCMonth() + 1}月${shifted.getUTCDate()}日`;
}

/**
 * Strict ISO-date guard for the server action. Accepts only
 * `YYYY-MM-DD` — the HTML <input type="date"> default — and rejects
 * anything else (full ISO timestamps, locale strings, garbage).
 *
 * Returning a Date constructed at JST midnight ensures the persisted
 * value lines up with the JST midnight anchor used everywhere else in
 * this module. A naive `new Date("2027-05-16")` parses as UTC midnight
 * which would tick the countdown a day early for users observing JST.
 */
export function parseWeddingDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [yearStr, monthStr, dayStr] = raw.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // UTC midnight − JST offset = JST midnight expressed as a UTC instant.
  const jstMidnightUtc = Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
  const result = new Date(jstMidnightUtc);
  // Guard against parser leniency (e.g. "2026-02-31" → "2026-03-03").
  // We re-derive the JST date from the resulting epoch and require it
  // to round-trip.
  const shifted = new Date(result.getTime() + JST_OFFSET_MS);
  if (
    shifted.getUTCFullYear() !== year ||
    shifted.getUTCMonth() !== month - 1 ||
    shifted.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format amount in ¥万 (man-yen) notation for large values,
 * or ¥N,NNN for smaller values.
 */
export function formatYen(amount: number): string {
  if (amount >= 10000) {
    return `¥${Math.round(amount / 10000)}万`;
  }
  return `¥${amount.toLocaleString()}`;
}

/**
 * Format amount as full yen with comma separators: ¥3,800,000
 */
export function formatYenFull(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * Staleness threshold: venue data older than this is flagged as
 * potentially out of date. Chosen to match typical wedding-industry
 * pricing refresh cadence (monthly plan / campaign updates).
 */
export const VENUE_STALE_DAYS = 30;

/**
 * Compute whole-day difference between `from` and `now` (floor). Negative
 * values mean `from` is in the future, which we treat as 0.
 */
export function daysAgo(from: Date | string, now: Date = new Date()): number {
  const then = typeof from === "string" ? new Date(from) : from;
  const diffMs = now.getTime() - then.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Produce a short Japanese relative-time label for the given timestamp.
 * Used by the venue freshness chip ("3日前に更新", "1時間前に更新"). Falls
 * back to a YYYY/M/D stamp once we're past ~2 months so the label
 * doesn't read "67日前".
 */
export function formatRelativeJa(
  from: Date | string,
  now: Date = new Date(),
): string {
  const then = typeof from === "string" ? new Date(from) : from;
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return "たった今";
  if (min < 60) return `${min}分前`;
  if (hour < 24) return `${hour}時間前`;
  if (day < 60) return `${day}日前`;
  // Older than ~2 months — show an absolute date instead.
  const y = then.getFullYear();
  const m = then.getMonth() + 1;
  const d = then.getDate();
  return `${y}/${m}/${d}`;
}

/**
 * Venue freshness classification — drives the color / copy of the
 * freshness chip on the venue detail page. `fresh` means updated within
 * the last {@link VENUE_STALE_DAYS}, `stale` means beyond that window.
 */
export function venueFreshness(
  updatedAt: Date | string,
  now: Date = new Date(),
): { state: "fresh" | "stale"; daysOld: number } {
  const daysOld = daysAgo(updatedAt, now);
  return {
    state: daysOld >= VENUE_STALE_DAYS ? "stale" : "fresh",
    daysOld,
  };
}

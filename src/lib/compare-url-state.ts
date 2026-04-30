/**
 * W21-9: pure URL <-> state helpers for /compare so the mobile snapper
 * can persist its currently-focused venue across the back-from-PDP flow.
 *
 * These are extracted from `comparison-mobile-snapper.tsx` so the URL
 * shape can be unit-tested without booting React / next/navigation.
 *
 * Convention: `?focused=<venueId>` — the venueId of the card the couple
 * was looking at on mobile. Absence of the param means "first card", so
 * we never write `?focused=` for index 0; that keeps the URL clean for
 * the common case (entering /compare fresh, not returning from a venue).
 */

const FOCUSED_PARAM = "focused";

/** Read `?focused=...` from a URLSearchParams-compatible bag. */
export function parseFocusedVenueId(
  searchParams: URLSearchParams | { get(name: string): string | null },
): string | null {
  const raw = searchParams.get(FOCUSED_PARAM);
  if (!raw || typeof raw !== "string") return null;
  // venueIds in this project are uuids — keep the parser strict so a
  // hand-typed `?focused=foo` doesn't trigger the restore path. Length
  // check is enough; full uuid validation is the caller's job.
  if (raw.length < 8 || raw.length > 64) return null;
  return raw;
}

/**
 * Resolve the index of a focused venueId within the current venue list.
 * Returns -1 if not found, 0 means "first card" — the same as no
 * `?focused` param at all, so callers should treat both as a no-op.
 */
export function indexOfFocusedVenue(
  focusedId: string | null,
  venueIds: ReadonlyArray<string>,
): number {
  if (!focusedId) return -1;
  return venueIds.indexOf(focusedId);
}

/**
 * Build the next URL search-string for the current focus state. Returns
 * the QS without leading `?`; an empty string means "no params, clean
 * pathname".
 *
 * Rules:
 * - `focusedId === null` (or first-card) → drop the `focused` param
 * - any other id → set/replace it
 * - all other params (e.g. `?venueIds=`) are preserved verbatim
 */
export function buildFocusedSearchString(
  current: URLSearchParams | { toString(): string },
  focusedId: string | null,
): string {
  const next = new URLSearchParams(current.toString());
  if (focusedId) {
    next.set(FOCUSED_PARAM, focusedId);
  } else {
    next.delete(FOCUSED_PARAM);
  }
  return next.toString();
}

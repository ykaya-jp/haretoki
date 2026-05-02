/**
 * Pure computation helpers for the compare matrix "advantage" cues and
 * partner-opinion-diff sort. Kept framework-free so the unit tests can
 * exercise the thresholds without spinning up React / Prisma.
 *
 * Two separate features land here:
 *   1. {@link classifyAdvantage} — given two scores (Left / Right) for
 *      the same dimension, decide which side is ahead and how strongly.
 *      Drives the arrow indicator on the compare board (exactly 2
 *      venues selected).
 *   2. {@link computePartnerOpinionDiff} — given owner / partner scores
 *      for a single venue, return |Δ| per dimension (used to rank
 *      dimensions by how split the couple is).
 */

/** Discriminated union describing the A-vs-B advantage outcome. */
export type Advantage =
  | { kind: "left-strong"; delta: number }
  | { kind: "left"; delta: number }
  | { kind: "tie"; delta: number }
  | { kind: "right"; delta: number }
  | { kind: "right-strong"; delta: number }
  | { kind: "unknown" };

/** Thresholds are picked so "ほぼ同じ" (< 0.5) matches the existing
 *  `hasMeaningfulDiff` gate in compare-redesigned.tsx, and the "明確に
 *  優勢" band kicks in at a full point. Keeping them in one place so the
 *  UI and the unit tests agree. */
export const ADVANTAGE_TIE_MAX = 0.5;
export const ADVANTAGE_STRONG_MIN = 1.0;

/**
 * Classify the head-to-head gap for a single dimension row.
 *
 * - `left`  = score of the venue shown in the left / first column
 * - `right` = score of the venue shown in the right / second column
 *
 * Either side may be `null` (not rated yet) — returns "unknown" so the
 * UI can render a quiet "—" rather than guessing a winner. `delta` is
 * always `left - right` so the consumer can also show a numeric hint.
 */
export function classifyAdvantage(
  left: number | null,
  right: number | null,
): Advantage {
  if (left === null || right === null) return { kind: "unknown" };
  const delta = left - right;
  const abs = Math.abs(delta);
  if (abs < ADVANTAGE_TIE_MAX) return { kind: "tie", delta };
  const strong = abs >= ADVANTAGE_STRONG_MIN;
  if (delta > 0) return { kind: strong ? "left-strong" : "left", delta };
  return { kind: strong ? "right-strong" : "right", delta };
}

/** Per-dimension |owner - partner| magnitude. `null` when either side
 *  hasn't rated that dimension yet — the caller treats null as "0
 *  disagreement" for sort so un-rated rows fall to the bottom. */
export interface PartnerOpinionDiff {
  dimensionId: string;
  ownerScore: number | null;
  partnerScore: number | null;
  /** |owner - partner|, or null when we can't compute it. */
  magnitude: number | null;
}

/**
 * For a given venue and the set of dimensions the UI renders, compute
 * how far apart the two partners are on each one.
 *
 * Implementation note: `ownerRatings` / `partnerRatings` are keyed by
 * dimension id in the same shape `getCoupleRatings` returns
 * (`ownRatings.ratings` / `otherRatings.ratings`), so the client can
 * pass them through without reshaping. The parameter names are
 * historical (predate the round-23 viewer-aware rename) — the function
 * is symmetric in its two args (`|a − b|`), so passing
 * (own, other) works identically to (owner, partner).
 */
export function computePartnerOpinionDiff(
  dimensionIds: readonly string[],
  ownerRatings: Record<string, number> | null,
  partnerRatings: Record<string, number> | null,
): PartnerOpinionDiff[] {
  return dimensionIds.map((dimensionId) => {
    const ownerScore = ownerRatings?.[dimensionId] ?? null;
    const partnerScore = partnerRatings?.[dimensionId] ?? null;
    const magnitude =
      ownerScore !== null && partnerScore !== null
        ? Math.abs(ownerScore - partnerScore)
        : null;
    return { dimensionId, ownerScore, partnerScore, magnitude };
  });
}

/**
 * Aggregate |owner - partner| across multiple venues for the same
 * dimension. Used when the compare matrix has N venues and we still
 * need one "split score" per dimension to sort by.
 *
 * Strategy: take the MAX magnitude across venues. A dimension where
 * one venue has a 2.0 split rises above a dimension where every venue
 * has a 0.5 split — the former is where the couple most needs to
 * actually talk. `null` inputs are treated as 0 (no evidence of
 * disagreement) so a dimension nobody has rated doesn't rise to the
 * top.
 */
export function aggregatePartnerDiffAcrossVenues(
  perVenue: ReadonlyArray<readonly PartnerOpinionDiff[]>,
  dimensionId: string,
): number {
  let max = 0;
  for (const venue of perVenue) {
    const row = venue.find((r) => r.dimensionId === dimensionId);
    if (row?.magnitude !== null && row?.magnitude !== undefined) {
      if (row.magnitude > max) max = row.magnitude;
    }
  }
  return max;
}

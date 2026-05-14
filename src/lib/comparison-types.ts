/**
 * Comparison matrix types — kept in a plain module (not "use server") so
 * client components and constants can live alongside type exports without
 * tripping Next.js's rule that server-action files expose only async fns.
 *
 * The action itself lives in `src/server/actions/checklist.ts` and
 * re-exports these so existing imports stay stable.
 */

import type { ReviewAggregate } from "@/lib/review-aggregations";

export type { ReviewAggregate } from "@/lib/review-aggregations";

/**
 * Maximum number of venues the comparison board can display at once.
 *
 * Rationale: at ~160px per column (grid template), 10 columns + the 160px
 * label gutter = 1760px of total horizontal scroll. Booking.com / Agoda
 * both cap at 4-5 for desktop-first flows, but our mobile-first design
 * uses scroll-snap-x-mandatory (one venue per viewport), so 10 stays
 * legible. Going beyond 10 makes the "which is best?" judgement noisy.
 */
export const COMPARE_MAX_VENUES = 10;

export interface ComparisonVenue {
  id: string;
  name: string;
  location: string | null;
  accessInfo: string | null;
  photoUrls: string[];
  scores: Array<{ dimension: string; score: number; source: string }>;

  /** Basic facts */
  costMin: number | null;
  costMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];

  /** Deep extraction — external review signal */
  externalRatingValue: number | null;
  externalReviewCount: number | null;

  /** Deep extraction — location detail */
  postalCode: string | null;
  streetAddress: string | null;

  /** Deep extraction — facilities */
  hasParking: boolean | null;
  parkingCapacity: number | null;
  hasShuttle: boolean | null;
  hasAccommodation: boolean | null;
  acceptsSecondParty: boolean | null;
  barrierFree: boolean | null;

  /** Deep extraction — cost breakdown */
  ceremonyFeeExact: number | null;
  productionFeeMin: number | null;
  productionFeeMax: number | null;
  serviceFeeRate: number | null;

  /** Deep extraction — operating */
  operatingHours: string | null;
  closedDays: string[];

  /** Deep extraction — cuisine */
  cuisineTypes: string[];
  chefCredentials: string | null;

  /**
   * R2 — cross-venue review summary surfaced on /compare. Optional so
   * callers (= getComparisonMatrix in checklist.ts and any future
   * matrix builder) can populate it without breaking older callers
   * that don't compute it. `undefined` = "not fetched"; the helper
   * `aggregateReviewsForVenue` always returns a populated object so a
   * `summary === null` + `count === 0` field reads as "no reviews
   * yet" in the UI.
   */
  reviewSummary?: ReviewAggregate;

  /**
   * PR #5: child checklist answer scores for this venue. Keyed by the
   * `ProjectChecklist.itemId` (= preset id or CustomChecklistItem cuid).
   * Empty when the couple hasn't graded any children. The comparison
   * field registry's "あなたの評価" rows fold this into per-dimension
   * means via `aggregateChildScoresToDimensions` and prefer the
   * resulting score over the legacy `user_rating` stored value when
   * any child has been rated.
   *
   * Optional so callers (legacy fixtures, tests) that don't pre-load
   * children still type-check — accessor treats `undefined` as "no
   * children", same as an empty record.
   */
  childScores?: Record<string, number | null>;
}

export interface ComparisonAnswer {
  status: string | null;
  memo: string | null;
  numberValue: number | null;
  /** PR #5: 0.5–5.0 user grade for this child item on this venue, or
   *  null when the user hasn't graded it. Aggregated into the parent
   *  dimension mean by `aggregateChildScoresToDimensions`. */
  numericScore: number | null;
  photoUrls: string[];
}

export interface ComparisonMatrix {
  venues: ComparisonVenue[];
  items: Array<{ id: string; category: string; subcategory?: string; question: string; type: string }>;
  answers: Record<string, Record<string, ComparisonAnswer>>; // [itemId][venueId] = answer
}

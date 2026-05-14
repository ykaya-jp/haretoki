/**
 * Aggregator: child checklist scores → parent Tier-1 dimension scores.
 *
 * Mental model (= v3 plan §1.1):
 *   - Each checklist answer can carry a 0.5–5.0 `numericScore` (added in
 *     PR #2 migration `20260515000000_*`).
 *   - The parent dimension score (e.g. "挙式会場") is the **arithmetic
 *     mean** of its rated child items' scores.
 *   - An unrated child item (numericScore = null) contributes nothing —
 *     it doesn't pull the average down.
 *
 * Why mean, not sum: a dimension with 5 mapped items vs 12 mapped items
 * should produce numbers on the same 1–5 scale. Mean gives that
 * invariance; sum would silently penalise dimensions with fewer items.
 *
 * Why this util, not inlined in the server action: the aggregator is
 * pure (input → output), unit-testable without a DB, and reused by
 * both the read path (loading the comparison board) and the write path
 * (after a child score update, the parent recomputes). Keeping it
 * dependency-free lets test fixtures drive it without Prisma.
 *
 * Custom items (CustomChecklistItem table, also new in PR #2) carry
 * their own category string. Pass them in via `customDimensionByItemId`
 * so the aggregator can map them just like preset items — the caller
 * (the comparison fetcher) is the only place that knows about the
 * custom→Tier-1 mapping, which keeps this file dimension-aware but
 * preset-source-agnostic.
 */

import {
  TIER1_DIMENSIONS,
  type Tier1Dimension,
} from "@/lib/constants";
import { ITEM_TO_DIMENSION } from "@/lib/dimension-checklist-map";

/** One child answer row from `venue_checklist_answers` (or equivalent
 *  in-memory shape). `itemId` is either a preset id or a custom item
 *  cuid; `numericScore` may be null for "not graded yet". */
export interface ChildAnswer {
  itemId: string;
  numericScore: number | null | undefined;
}

/** Optional override map: custom item id → Tier-1 dimension. Provided by
 *  the caller after it has resolved CustomChecklistItem rows for the
 *  current project. Items not present in either this map or
 *  ITEM_TO_DIMENSION fall back to "overall" (treated as a generic
 *  catch-all, identical to `getDimensionForPreset`'s fallback). */
export type CustomDimensionLookup = Record<string, Tier1Dimension>;

/**
 * Resolve a single child item's parent dimension.
 *
 * Preset items use the static `ITEM_TO_DIMENSION` table. Custom items
 * use the caller-supplied lookup. Unknown ids degrade to "overall" so a
 * one-off DB row (e.g. a half-migrated legacy id) doesn't crash the
 * aggregator — the parent "overall" dimension absorbs it.
 */
export function resolveDimension(
  itemId: string,
  customLookup: CustomDimensionLookup = {},
): Tier1Dimension {
  return (
    ITEM_TO_DIMENSION[itemId] ?? customLookup[itemId] ?? "overall"
  );
}

/** Per-dimension aggregation result. */
export interface DimensionAggregate {
  /** Arithmetic mean of the rated child scores, rounded to 1 decimal.
   *  Null when no child item under this dimension has a finite score. */
  score: number | null;
  /** Number of rated children that contributed (= the divisor of the mean). */
  ratedCount: number;
  /** Total number of children mapped to this dimension that appeared in
   *  the input (including null-score / not-yet-rated ones). Useful for
   *  "4 of 5 questions answered" affordances. */
  totalCount: number;
}

/** Full aggregation: every Tier-1 dimension present in the input. */
export type DimensionAggregateMap = Record<Tier1Dimension, DimensionAggregate>;

/**
 * Build the per-dimension aggregate map from a flat list of child answers.
 *
 * Idempotent + pure: the same input always yields the same output. No
 * Prisma, no I/O, no global state.
 *
 * @param answers — every checklist answer for the venue (across ALL
 *   dimensions). Items with null/undefined `numericScore` are counted in
 *   `totalCount` but not in `score` / `ratedCount`.
 * @param customLookup — optional mapping for custom item ids; see type.
 */
export function aggregateChildScoresToDimensions(
  answers: ReadonlyArray<ChildAnswer>,
  customLookup: CustomDimensionLookup = {},
): DimensionAggregateMap {
  // Initialise every Tier-1 dim to an empty bucket so callers don't have
  // to defensively check `aggregate.cuisine ?? defaults`.
  const buckets: DimensionAggregateMap = {} as DimensionAggregateMap;
  for (const dim of TIER1_DIMENSIONS) {
    buckets[dim] = { score: null, ratedCount: 0, totalCount: 0 };
  }

  const sums = new Map<Tier1Dimension, number>();

  for (const answer of answers) {
    const dim = resolveDimension(answer.itemId, customLookup);
    buckets[dim].totalCount += 1;

    const raw = answer.numericScore;
    if (raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;

    sums.set(dim, (sums.get(dim) ?? 0) + n);
    buckets[dim].ratedCount += 1;
  }

  for (const dim of TIER1_DIMENSIONS) {
    const count = buckets[dim].ratedCount;
    if (count === 0) continue;
    const sum = sums.get(dim) ?? 0;
    // Round to 1 decimal — matches the VisitRating column's Decimal(2,1)
    // and the legacy `computeCompositeScore` rounding contract so callers
    // can substitute aggregator output for that function without a
    // visual jitter on the UI.
    buckets[dim].score = Math.round((sum / count) * 10) / 10;
  }

  return buckets;
}

/**
 * Convenience: composite over all dimensions, mirroring the contract of
 * `computeCompositeScore` so callers can swap one for the other.
 *
 * Algorithm: mean of dimensions' means. Dimensions with no rated children
 * are dropped (= they don't pull the composite toward zero).
 *
 * Returns null when no dimension has any rated child.
 */
export function compositeFromChildScores(
  answers: ReadonlyArray<ChildAnswer>,
  customLookup: CustomDimensionLookup = {},
): number | null {
  const map = aggregateChildScoresToDimensions(answers, customLookup);
  let sum = 0;
  let count = 0;
  for (const dim of TIER1_DIMENSIONS) {
    const v = map[dim].score;
    if (v === null) continue;
    sum += v;
    count += 1;
  }
  if (count === 0) return null;
  return Math.round((sum / count) * 10) / 10;
}

/**
 * W12-1: per-member weighted composite score.
 *
 * Design:
 * - Users live on a 1-5 weight scale (1 = "どうでもいい", 3 = neutral,
 *   5 = "超重視"). We pick 1-5 rather than 0-100% because it matches the
 *   1-5 star rating couples already use across `VenueScore` — less new
 *   cognitive load, same radix.
 * - Default is 3 on every dimension. A missing / null / undefined weight
 *   MUST be treated as 3 so pre-W12-1 favorites keep ranking identically
 *   until the user explicitly moves a slider. `computeWeighted(... , null)`
 *   therefore returns the simple arithmetic mean of the input dim scores.
 * - Output is normalised into the same 1-5 range as the raw scores so the
 *   VenueCard's ★ badge and comparison column header stay visually
 *   interchangeable whether or not weights are active. We do this by
 *   computing a weighted arithmetic mean — NOT sum — of the per-dimension
 *   scores. (weighted sum would inflate the number to 25+ and break every
 *   downstream colour-by-score threshold.)
 *
 * Input shape:
 *   scoreByDim — already-aggregated per-dimension score (typically
 *     `computeCompositeScore` run per-dimension across sources, OR a
 *     `MatrixVenue.scoresByDimension`). null entries are skipped.
 *   weights    — partial Record<Dimension, 1..5>. Missing keys default
 *     to 3. Out-of-range values are clamped into [1, 5] so a bad DB row
 *     can never crash the UI.
 */

import { TIER1_DIMENSIONS, type Tier1Dimension } from "@/lib/constants";

/** Valid weight scale used by the UI sliders. */
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 5;
export const WEIGHT_DEFAULT = 3;

/** Partial map — callers may only have set a subset. */
export type DimensionWeights = Partial<Record<Tier1Dimension, number>>;

/** Full map with every Tier1 dimension filled in — what the DB stores and
 *  what `coerceWeights()` / `defaultWeights()` return. */
export type Weights = Record<Tier1Dimension, number>;

/** Dimension-keyed score table. null = no score known for that dimension. */
export type ScoreByDimension = Partial<Record<string, number | null>>;

/**
 * Clamp a raw weight value into [WEIGHT_MIN, WEIGHT_MAX]. Non-finite or
 * missing inputs fall back to WEIGHT_DEFAULT (3 = neutral), matching the
 * "untouched slider" expectation.
 */
export function normalizeWeight(raw: unknown): number {
  // Explicit null/undefined check — Number(null) === 0 would otherwise
  // clamp to WEIGHT_MIN (1) and silently downgrade an unset weight below
  // the neutral default (3), making ranking drift after an accidental
  // undefined write.
  if (raw === null || raw === undefined) return WEIGHT_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return WEIGHT_DEFAULT;
  if (n < WEIGHT_MIN) return WEIGHT_MIN;
  if (n > WEIGHT_MAX) return WEIGHT_MAX;
  return n;
}

/**
 * Fully-populated weights map with defaults filled in for every dimension.
 * Accepts null / undefined / unknown (e.g. raw JSON from Prisma) and always
 * returns a safe Record — the UI slider reducer uses this to initialise.
 */
export function defaultWeights(): Record<Tier1Dimension, number> {
  const out = {} as Record<Tier1Dimension, number>;
  for (const dim of TIER1_DIMENSIONS) out[dim] = WEIGHT_DEFAULT;
  return out;
}

/**
 * Coerce arbitrary input (DB JSON, form payload) into a fully-populated,
 * clamped weights map. Unknown dimensions in the input are dropped.
 */
export function coerceWeights(
  raw: unknown,
): Record<Tier1Dimension, number> {
  const result = defaultWeights();
  if (raw === null || raw === undefined) return result;
  if (typeof raw !== "object") return result;
  const source = raw as Record<string, unknown>;
  for (const dim of TIER1_DIMENSIONS) {
    if (dim in source) result[dim] = normalizeWeight(source[dim]);
  }
  return result;
}

/**
 * Compute the weighted composite score from per-dimension scores.
 *
 * Algorithm: weighted arithmetic mean, ignoring dimensions with no score.
 *   composite = Σ (score_i × weight_i)  /  Σ weight_i
 *   (summed only over dimensions with a finite score)
 *
 * Returns null when no dimension has a finite score — same contract as
 * computeCompositeScore() so callers can substitute one for the other.
 *
 * @param scoreByDim map: dimension id → finite score (1-5) or null
 * @param weights partial weight map; null / undefined → all defaults (=3),
 *                which makes the result equal to a plain arithmetic mean
 *                of the input scores (backwards compat with unweighted
 *                callers).
 */
export function computeWeighted(
  scoreByDim: ScoreByDimension,
  weights: DimensionWeights | null | undefined,
): number | null {
  const safeWeights = coerceWeights(weights ?? undefined);

  let weightedSum = 0;
  let weightTotal = 0;

  for (const dim of TIER1_DIMENSIONS) {
    const raw = scoreByDim[dim];
    if (raw === null || raw === undefined) continue;
    const score = Number(raw);
    if (!Number.isFinite(score)) continue;
    const w = safeWeights[dim];
    weightedSum += score * w;
    weightTotal += w;
  }

  if (weightTotal === 0) return null;
  return Math.round((weightedSum / weightTotal) * 10) / 10;
}

/**
 * Aggregate a flat VenueScore[] into a per-dimension score table using the
 * same source-weighted average that `computeCompositeScore` uses internally.
 * Kept here so `computeWeighted` can consume the same raw input shape the
 * listing / comparison callers already fetch from Prisma, without having
 * to import venue-score.ts into the UI layer.
 *
 * Source weights intentionally mirror SCORE_SOURCE_WEIGHTS in venue-score.ts
 * — duplicated (not re-exported) so this file stays a leaf utility with no
 * import cycles. If the canonical table moves, update both in the same PR.
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  user_rating: 1.0,
  checklist_derived: 0.6,
  zexy: 0.5,
  wedding_park: 0.5,
  hanayume: 0.4,
  mynavi: 0.3,
  ai_analysis: 0.4,
};

export function aggregateScoresByDimension(
  scores: ReadonlyArray<{ dimension: string; score: unknown; source: string }>,
): ScoreByDimension {
  const byDim = new Map<
    string,
    { weightedSum: number; weightTotal: number }
  >();
  for (const s of scores) {
    const n = Number(s.score);
    if (!Number.isFinite(n)) continue;
    const w = SOURCE_WEIGHTS[s.source] ?? 0.3;
    const bucket = byDim.get(s.dimension) ?? {
      weightedSum: 0,
      weightTotal: 0,
    };
    bucket.weightedSum += n * w;
    bucket.weightTotal += w;
    byDim.set(s.dimension, bucket);
  }
  const result: ScoreByDimension = {};
  for (const [dim, { weightedSum, weightTotal }] of byDim) {
    if (weightTotal > 0) result[dim] = weightedSum / weightTotal;
  }
  return result;
}

/**
 * End-to-end convenience: flat Prisma scores + user weights → single
 * rounded number (or null). This is what VenueCard / comparison columns
 * will actually call.
 */
export function computeWeightedComposite(
  scores: ReadonlyArray<{ dimension: string; score: unknown; source: string }>,
  weights: DimensionWeights | null | undefined,
): number | null {
  if (!scores.length) return null;
  const byDim = aggregateScoresByDimension(scores);
  return computeWeighted(byDim, weights);
}

/**
 * W13-1: synthesize a "couple weights" map from the two members' personal
 * weights. We use an **arithmetic mean** per dimension.
 *
 * Why mean (not max-respect)?
 * - Symmetric: neither voice silently outranks the other, matching the
 *   product stance "2人の好みは違って当たり前 — どちらも尊重".
 * - Max-respect would let whoever pushed more sliders to 5 dominate,
 *   which creates a perverse incentive to "inflate" everything. A mean
 *   keeps the ranking honest.
 * - Commutative + associative — easier to reason about in tests.
 *
 * Either / both arguments may be null / undefined (partner hasn't set
 * weights, or the caller hasn't fetched yet) — null falls back to
 * `defaultWeights()` (all 3s, neutral), so a couple mode with an unset
 * partner still produces a sane ranking that equals the mine-only result
 * shifted halfway toward neutral. The UI surfaces this with a "パートナー
 * はまだ重みを設定していません" chip so couples know the mix is lopsided.
 *
 * Result is fully-populated and clamped into [WEIGHT_MIN, WEIGHT_MAX] —
 * safe to pass directly into `computeWeighted()` / `computeWeightedComposite()`.
 */
export function computeCoupleWeights(
  mine: DimensionWeights | null | undefined,
  partner: DimensionWeights | null | undefined,
): Weights {
  const a = coerceWeights(mine ?? undefined);
  const b = coerceWeights(partner ?? undefined);
  const out = defaultWeights();
  for (const dim of TIER1_DIMENSIONS) {
    const avg = (a[dim] + b[dim]) / 2;
    // Explicit clamp belt-and-suspenders — coerceWeights already did it,
    // but arithmetic could produce fractional values at the edges and we
    // want the result to stay in the documented range.
    out[dim] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, avg));
  }
  return out;
}

/**
 * W13-1: 0-100 "opinion alignment" score between two members' weights.
 *
 * Formula: cosine similarity between the two weight vectors, re-mapped
 * from [-1, 1] to [0, 100]. In practice weights are all positive (1-5),
 * so the cosine stays in [0, 1] — but we use the full symmetric mapping
 * so future changes (e.g. preference vectors with negatives) don't
 * break the contract.
 *
 * Why cosine (not absolute-diff)?
 * - Cosine captures **relative priority shape**: two people who both
 *   rank "cuisine > cost > space" are treated as aligned even if one
 *   uses (5,3,2) and the other (4,3,2). That matches couples' lived
 *   experience — agreeing on what matters more matters more than
 *   agreeing on the absolute volume knob.
 * - Absolute-diff would flag (3,3,3) vs (3,3,3) and (5,5,5) vs (5,5,5)
 *   identically — both "perfect agreement" — but in the second pair
 *   the couple actually cares a lot about everything, which is a more
 *   fragile agreement. Cosine still returns 100 (direction matches),
 *   but combined with a "話し合い要" threshold tuned on real couples
 *   it's the right primitive.
 *
 * Edge case: if either vector is the zero vector (impossible with 1-5
 * clamping, but defensive), return 50 (neutral — neither aligned nor
 * opposed) so a degenerate DB row can't force the UI into a misleading
 * "perfect match" state.
 *
 * @returns integer 0-100. 100 = identical priority shape, 50 = orthogonal,
 *          0 = opposite.
 */
export function opinionAlignmentScore(
  mine: DimensionWeights | null | undefined,
  partner: DimensionWeights | null | undefined,
): number {
  const a = coerceWeights(mine ?? undefined);
  const b = coerceWeights(partner ?? undefined);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const dim of TIER1_DIMENSIONS) {
    dot += a[dim] * b[dim];
    normA += a[dim] * a[dim];
    normB += b[dim] * b[dim];
  }

  if (normA === 0 || normB === 0) return 50;

  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  // Map [-1, 1] → [0, 100]. Clamp against floating-point drift that can
  // nudge cosine to 1.0000000002 and trip downstream >= comparisons.
  const mapped = Math.round(((cosine + 1) / 2) * 100);
  return Math.max(0, Math.min(100, mapped));
}

/**
 * W13-1: classify an alignment score into a UI-level bucket so the badge
 * renderer doesn't need to know the thresholds.
 *
 * Thresholds (tunable):
 *  - aligned:     >= 92  → gold chip "ふたりの視点がぴったり"
 *  - close:       >= 78  → subtle chip "おおむね一致"
 *  - discuss:     <  78  → neutral chip "話し合いの余地"
 *
 * The 92 threshold is deliberately tight: for 8-dim vectors drawn from
 * {1..5}, two slider shifts of ±2 already drops cosine below 0.98 → 99%
 * mapped, so "ぴったり" really means "ほぼ同じ向き". The 78 floor comes
 * from the case where one partner maxes cuisine (5) and the other zeros
 * it (1) — that single disagreement should land in "話し合いの余地".
 */
export type AlignmentBucket = "aligned" | "close" | "discuss";

export function alignmentBucket(score: number): AlignmentBucket {
  if (score >= 92) return "aligned";
  if (score >= 78) return "close";
  return "discuss";
}

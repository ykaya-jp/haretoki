/**
 * Unified scoring module — consolidates `venue-score.ts` and `weighted-score.ts`
 * into a single source of truth so `SCORE_SOURCE_WEIGHTS` is no longer
 * duplicated across two files (a footgun called out in the prior
 * weighted-score.ts comment).
 *
 * Pure refactor: behaviour-preserving merge of the two legacy files.
 *
 * Layout:
 *   1. SOURCE_WEIGHTS (per-source confidence) + computeCompositeScore
 *      (legacy venue-score.ts surface)
 *   2. Weight scale (1..5), coerceWeights, normalizeWeight, defaultWeights
 *      (legacy weighted-score.ts surface)
 *   3. Score aggregation: aggregateScoresByDimension, computeWeighted,
 *      computeWeightedComposite
 *   4. Couple-level: computeCoupleWeights, opinionAlignmentScore,
 *      alignmentBucket
 *   5. NEW transparency helper: getScoreCoverage — H1 in the v3 plan
 *      ("composite-score の分母が venue で variable") was about callers
 *      not being able to *see* the coverage; the helper exposes
 *      (covered, total, dimensions) so the UI can render "6/8 dimensions
 *      で算出" without re-doing the bookkeeping per call site.
 */

import { TIER1_DIMENSIONS, type Tier1Dimension } from "@/lib/constants";

// ─── (1) per-source weights & composite ──────────────────────────────────

/**
 * Source weights for composite score calculation. user_rating is highest
 * priority. Frozen so a stray runtime write (test pollution, plugin code)
 * can't silently shift every venue's ranking — the legacy implementation
 * kept this constant private to its module, so the public re-export keeps
 * the same effective immutability.
 */
export const SCORE_SOURCE_WEIGHTS: Readonly<Record<string, number>> =
  Object.freeze({
    user_rating: 1.0,
    checklist_derived: 0.6,
    zexy: 0.5,
    wedding_park: 0.5,
    hanayume: 0.4,
    mynavi: 0.3,
    ai_analysis: 0.4,
  });

interface ScoreEntry {
  source: string;
  dimension: string;
  score: unknown;
}

/**
 * Compute weighted composite score across all sources.
 * For each dimension, compute a weighted average across sources,
 * then average the dimension scores for the overall total.
 * Returns null when no scores exist or total weight is 0.
 */
export function computeCompositeScore(scores: ScoreEntry[]): number | null {
  if (scores.length === 0) return null;

  // Group by dimension
  const byDimension = new Map<
    string,
    Array<{ source: string; score: number }>
  >();
  for (const s of scores) {
    const score = Number(s.score);
    if (!isFinite(score)) continue;
    const entries = byDimension.get(s.dimension) ?? [];
    entries.push({ source: s.source, score });
    byDimension.set(s.dimension, entries);
  }

  if (byDimension.size === 0) return null;

  // For each dimension, compute weighted average across sources
  const dimAverages: number[] = [];
  for (const entries of byDimension.values()) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const { source, score } of entries) {
      const w = SCORE_SOURCE_WEIGHTS[source] ?? 0.3;
      weightedSum += score * w;
      totalWeight += w;
    }
    if (totalWeight > 0) {
      dimAverages.push(weightedSum / totalWeight);
    }
  }

  if (dimAverages.length === 0) return null;

  const total =
    dimAverages.reduce((a, b) => a + b, 0) / dimAverages.length;
  // Round to 1 decimal
  return Math.round(total * 10) / 10;
}

// ─── (2) weight scale & coercion ─────────────────────────────────────────

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

// ─── (3) aggregation across sources & weighted composite ─────────────────

/**
 * Aggregate a flat VenueScore[] into a per-dimension score table using the
 * same source-weighted average that `computeCompositeScore` uses internally.
 *
 * Pre-consolidation this constant was duplicated here (callers commented:
 * "If the canonical table moves, update both in the same PR"). Now there is
 * one canonical SCORE_SOURCE_WEIGHTS shared with `computeCompositeScore`.
 */
export function aggregateScoresByDimension(
  scores: ReadonlyArray<{
    dimension: string;
    score: unknown;
    source: string;
  }>,
): ScoreByDimension {
  const byDim = new Map<
    string,
    { weightedSum: number; weightTotal: number }
  >();
  for (const s of scores) {
    const n = Number(s.score);
    if (!Number.isFinite(n)) continue;
    const w = SCORE_SOURCE_WEIGHTS[s.source] ?? 0.3;
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
 * End-to-end convenience: flat Prisma scores + user weights → single
 * rounded number (or null). This is what VenueCard / comparison columns
 * will actually call.
 */
export function computeWeightedComposite(
  scores: ReadonlyArray<{
    dimension: string;
    score: unknown;
    source: string;
  }>,
  weights: DimensionWeights | null | undefined,
): number | null {
  if (!scores.length) return null;
  const byDim = aggregateScoresByDimension(scores);
  return computeWeighted(byDim, weights);
}

// ─── (4) couple-level alignment ──────────────────────────────────────────

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

// ─── (5) coverage transparency — new in PR #1 ────────────────────────────

/**
 * H1 transparency helper. Given a flat VenueScore[] (raw shape from
 * Prisma), report how many distinct Tier-1 dimensions actually have a
 * finite score for this venue, plus the total Tier-1 surface.
 *
 * The v3 plan's H1 concern was that `computeCompositeScore` divides by
 * "the number of scored dimensions", so a venue with scores in 3 of 8
 * dimensions gets a composite that isn't directly comparable to a venue
 * with 7-of-8 coverage. Rather than change the math (which would alter
 * every existing rank silently), this PR keeps the math intact but
 * surfaces the coverage so the UI can render "6 of 8 軸で算出" alongside
 * the number. That makes the limitation legible to the couple instead of
 * pretending it doesn't exist.
 *
 * Returns:
 *   covered    — number of distinct dimensions with at least one finite score
 *   total      — number of Tier-1 dimensions (currently 8)
 *   dimensions — sorted unique dimension IDs that contributed
 *
 * Pure function. No I/O. Cheap to call on every render — O(scores.length).
 */
export interface ScoreCoverage {
  covered: number;
  total: number;
  dimensions: string[];
}

export function getScoreCoverage(
  scores: ReadonlyArray<{ dimension: string; score: unknown }>,
): ScoreCoverage {
  const seen = new Set<string>();
  for (const s of scores) {
    // Explicit null / undefined skip — Number(null) === 0 is finite and would
    // otherwise silently count a missing rating as "covered". The DB returns
    // null for the absence of a score, so treating it as 0 is wrong.
    if (s.score === null || s.score === undefined) continue;
    const n = Number(s.score);
    if (Number.isFinite(n)) seen.add(s.dimension);
  }
  return {
    covered: seen.size,
    total: TIER1_DIMENSIONS.length,
    // Sort for stable test snapshots; UI doesn't rely on order but tests do.
    dimensions: Array.from(seen).sort(),
  };
}

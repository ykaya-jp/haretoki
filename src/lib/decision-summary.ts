/**
 * DecisionSummary — per-venue "この式場を選ぶなら" card data.
 *
 * Given one target venue + the full shortlist, produce the comparison
 * beats that help a couple commit: price delta vs the most expensive
 * candidate, top 1–2 strengths (dimensions where target beats the
 * shortlist average), top 1–2 compromises (dimensions where it lags),
 * and a one-line emotional framing.
 *
 * Design decisions (why pure function):
 *   - Runs client-side. favorites on /candidates already carry scores +
 *     cost, so there's no reason to pay a round-trip for static math.
 *   - Pure + typed in isolation makes it trivial to unit-test edge cases
 *     (single candidate, all scores equal, missing prices).
 *
 * Noise suppression:
 *   - Dimension diffs < STRENGTH_THRESHOLD are dropped — a 0.2-point
 *     edge on a 1–5 scale is within rating noise and not worth surfacing.
 *   - Price diffs < PRICE_THRESHOLD_YEN are also dropped so we don't
 *     shout "1 万円節約" at people.
 */

import { DIMENSION_LABELS, TIER1_DIMENSIONS } from "./constants";
import { SCORE_SOURCE_WEIGHTS } from "./scoring";

/** Minimum dimension score gap (0-5 scale) to mention. */
export const STRENGTH_THRESHOLD = 0.4;

/** Minimum price delta (yen) to surface — 10 万円. */
export const PRICE_THRESHOLD_YEN = 100_000;

/** Max strengths / compromises to list per card. */
const MAX_STRENGTHS = 2;
const MAX_COMPROMISES = 2;

export interface SummaryVenueInput {
  id: string;
  name: string;
  costMin: number | null;
  costMax: number | null;
  /** Optional latest-estimate total (yen). Preferred over cost{Min,Max}. */
  estimateTotal?: number | null;
  scores: Array<{ dimension: string; score: number; source: string }>;
}

export interface DimensionDelta {
  dimension: string;
  label: string;
  diff: number;
}

export interface PriceDelta {
  /** +N yen cheaper than `comparedWith` venue; negative = costlier. */
  savingsYen: number;
  /** Name of the most expensive candidate used as the reference. */
  comparedWith: string;
  /** Human label "N 万円節約" / "N 万円多い" — empty when under threshold. */
  label: string;
  /** "cheaper" / "costlier" / "tied". */
  direction: "cheaper" | "costlier" | "tied";
}

export interface DecisionSummary {
  venueId: string;
  price: PriceDelta | null;
  strengths: DimensionDelta[];
  compromises: DimensionDelta[];
  /** One-line framing shown when collapsed. */
  headline: string;
  /** "この式場を選ぶなら" — longer form shown when expanded. */
  rationale: string;
}

/** Pick the best per-dimension score for a venue, weighting sources. */
function weightedDimensionScore(
  scores: SummaryVenueInput["scores"],
  dimension: string,
): number | null {
  const entries = scores.filter((s) => s.dimension === dimension);
  if (entries.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { source, score } of entries) {
    if (!Number.isFinite(score)) continue;
    const w = SCORE_SOURCE_WEIGHTS[source] ?? 0.3;
    weightedSum += score * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/** Resolve the price used for comparisons. */
function resolvePrice(v: SummaryVenueInput): number | null {
  if (typeof v.estimateTotal === "number" && v.estimateTotal > 0) {
    return v.estimateTotal;
  }
  if (v.costMax && v.costMin) {
    return (v.costMax + v.costMin) / 2;
  }
  return v.costMax ?? v.costMin ?? null;
}

function formatManYen(yen: number): string {
  return `${Math.round(yen / 10_000)}`;
}

/**
 * Build a summary card for a single target venue against the shortlist.
 * Returns `null` when shortlist has < 2 venues (nothing to compare).
 */
export function buildDecisionSummary(
  targetId: string,
  shortlist: SummaryVenueInput[],
): DecisionSummary | null {
  if (shortlist.length < 2) return null;
  const target = shortlist.find((v) => v.id === targetId);
  if (!target) return null;
  const others = shortlist.filter((v) => v.id !== targetId);
  if (others.length === 0) return null;

  // --- Price delta vs the most expensive candidate ---
  const targetPrice = resolvePrice(target);
  const priced = shortlist
    .map((v) => ({ v, price: resolvePrice(v) }))
    .filter((x): x is { v: SummaryVenueInput; price: number } => x.price !== null);

  let price: PriceDelta | null = null;
  if (priced.length >= 2 && targetPrice !== null) {
    const maxEntry = priced.reduce((acc, cur) => (cur.price > acc.price ? cur : acc));
    const minEntry = priced.reduce((acc, cur) => (cur.price < acc.price ? cur : acc));
    // Compare against max when target isn't the max; otherwise frame as
    // "candidate max — N 万円多い" against the cheapest.
    const isTopPrice = maxEntry.v.id === target.id;
    const reference = isTopPrice ? minEntry : maxEntry;
    const savings = reference.price - targetPrice;
    const absYen = Math.abs(savings);
    const direction: PriceDelta["direction"] =
      absYen < PRICE_THRESHOLD_YEN ? "tied" : savings > 0 ? "cheaper" : "costlier";
    let label = "";
    if (direction === "cheaper") {
      label = `候補内で${formatManYen(absYen)}万円 節約`;
    } else if (direction === "costlier") {
      label = `候補内で${formatManYen(absYen)}万円 多い`;
    }
    price = {
      savingsYen: savings,
      comparedWith: reference.v.name,
      label,
      direction,
    };
  }

  // --- Dimension deltas vs the average of the others ---
  const deltas: DimensionDelta[] = [];
  for (const dim of TIER1_DIMENSIONS) {
    const targetScore = weightedDimensionScore(target.scores, dim);
    if (targetScore === null) continue;
    const otherScores = others
      .map((o) => weightedDimensionScore(o.scores, dim))
      .filter((s): s is number => s !== null);
    if (otherScores.length === 0) continue;
    const othersAvg = otherScores.reduce((a, b) => a + b, 0) / otherScores.length;
    const diff = Math.round((targetScore - othersAvg) * 10) / 10;
    if (Math.abs(diff) < STRENGTH_THRESHOLD) continue;
    deltas.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim] ?? dim,
      diff,
    });
  }

  const strengths = deltas
    .filter((d) => d.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, MAX_STRENGTHS);
  const compromises = deltas
    .filter((d) => d.diff < 0)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, MAX_COMPROMISES);

  const headline = buildHeadline({ price, strengths, compromises });
  const rationale = buildRationale({ price, strengths, compromises });

  return {
    venueId: target.id,
    price,
    strengths,
    compromises,
    headline,
    rationale,
  };
}

function buildHeadline(parts: {
  price: PriceDelta | null;
  strengths: DimensionDelta[];
  compromises: DimensionDelta[];
}): string {
  const { price, strengths, compromises } = parts;
  const hasPriceWin = price?.direction === "cheaper";
  const hasStrength = strengths.length > 0;
  const hasCompromise = compromises.length > 0;

  if (hasPriceWin && hasStrength) {
    return `価格と「${strengths[0].label}」で優位です`;
  }
  if (hasPriceWin) {
    return "価格を取るなら、この選択が有力です";
  }
  if (hasStrength && !hasCompromise) {
    return `「${strengths[0].label}」で頭ひとつ抜けています`;
  }
  if (hasStrength && hasCompromise) {
    return `「${strengths[0].label}」を取り、「${compromises[0].label}」を譲る選択`;
  }
  if (price?.direction === "costlier" && !hasStrength) {
    return "価格は高めでも、感覚で選びたい選択肢";
  }
  return "候補の中でバランスの良い選択です";
}

function buildRationale(parts: {
  price: PriceDelta | null;
  strengths: DimensionDelta[];
  compromises: DimensionDelta[];
}): string {
  const { price, strengths, compromises } = parts;
  const beats: string[] = [];
  if (price?.direction === "cheaper") {
    beats.push(
      `${price.comparedWith}より${Math.round(Math.abs(price.savingsYen) / 10_000)}万円抑えられます`,
    );
  }
  if (strengths.length > 0) {
    beats.push(
      `${strengths.map((s) => s.label).join("・")}で他の候補より優れています`,
    );
  }
  if (compromises.length > 0) {
    beats.push(
      `一方で${compromises.map((c) => c.label).join("・")}は他に譲ります`,
    );
  }
  if (price?.direction === "costlier" && strengths.length === 0) {
    beats.push(
      `${price.comparedWith}より${Math.round(Math.abs(price.savingsYen) / 10_000)}万円多くかかります`,
    );
  }
  if (beats.length === 0) {
    return "候補同士に大きな差はありません。感覚で選んでも大きく外れない距離感です。";
  }
  return beats.join("。") + "。";
}

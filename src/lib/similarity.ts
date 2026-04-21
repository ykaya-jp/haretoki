/**
 * Venue similarity primitives — pure, side-effect-free helpers used by
 * `getSimilarVenues` to rank a project's other venues by resemblance to
 * a given reference venue. No Claude / Prisma imports so the file is
 * trivially unit-testable.
 *
 * Why pure-maths-only (no AI): similarity here is a nudge ("candidates
 * in the same budget/style neighbourhood") — not a marketing decision.
 * Calling Claude for every venue detail page would rack up cost for a
 * feature that's fundamentally set algebra + interval overlap.
 *
 * Scoring recipe (see `computeVenueSimilarity`):
 *   ceremonyStyles  Jaccard × 3
 *   vibeTags        Jaccard × 3
 *   location prefix (prefecture + ward) × 2
 *   cost range overlap × 2
 *   capacity range overlap × 1
 *
 * Score 0 → caller should exclude (no signal at all).
 */

/**
 * Jaccard index — |A ∩ B| / |A ∪ B|. Returns 0 when both sets are empty
 * (zero-signal case; we deliberately do NOT return 1 for vacuous match,
 * otherwise every empty-metadata venue would look "perfectly similar").
 */
export function jaccard<T>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined): number {
  const aArr = a ?? [];
  const bArr = b ?? [];
  if (aArr.length === 0 && bArr.length === 0) return 0;

  // Lowercase strings for case-insensitive comparison of tag-like data.
  // Non-string values pass through unchanged.
  const norm = (v: T): T | string => (typeof v === "string" ? v.toLowerCase().trim() : v);
  const setA = new Set(aArr.map(norm));
  const setB = new Set(bArr.map(norm));

  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Interval overlap ratio ∈ [0, 1].
 * Returns |A ∩ B| / |A ∪ B| treating min/max as a closed interval.
 *
 * Nullability rules:
 *  - Either interval fully missing (both bounds null) → 0 (no signal)
 *  - Partial bounds are filled from the other side so a "cost_min: 3M,
 *    cost_max: null" still produces a meaningful overlap against a
 *    venue whose range is [3M, 5M]. Default to treating a one-sided
 *    bound as a point when both endpoints can't be inferred.
 *  - Zero-width interval matching exactly → 1.0
 */
export function rangeOverlap(
  aMin: number | null | undefined,
  aMax: number | null | undefined,
  bMin: number | null | undefined,
  bMax: number | null | undefined,
): number {
  const aLo = aMin ?? aMax;
  const aHi = aMax ?? aMin;
  const bLo = bMin ?? bMax;
  const bHi = bMax ?? bMin;

  if (aLo == null || aHi == null || bLo == null || bHi == null) return 0;

  const lo1 = Math.min(aLo, aHi);
  const hi1 = Math.max(aLo, aHi);
  const lo2 = Math.min(bLo, bHi);
  const hi2 = Math.max(bLo, bHi);

  const interLo = Math.max(lo1, lo2);
  const interHi = Math.min(hi1, hi2);
  const intersection = Math.max(0, interHi - interLo);

  const unionLo = Math.min(lo1, lo2);
  const unionHi = Math.max(hi1, hi2);
  const union = unionHi - unionLo;

  // Both ranges collapsed to the same point → treat as a full match.
  if (union === 0) {
    return lo1 === lo2 ? 1 : 0;
  }
  return intersection / union;
}

/**
 * Location prefix similarity. Compares leading address segments so
 * "東京都渋谷区神宮前" and "東京都渋谷区恵比寿" score higher than
 * "東京都渋谷区" vs "神奈川県横浜市".
 *
 * Strategy: split each location by common address delimiters (都/道/
 * 府/県 boundary, 市/区/郡 boundary, whitespace). Count leading
 * matching segments. Return {0, 0.5, 1}:
 *   - 0 if the prefecture differs (or either side is empty)
 *   - 0.5 if prefecture matches but ward/city differs
 *   - 1 if prefecture + ward both match
 */
export function locationPrefixMatch(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;

  const segmentsA = splitJapaneseAddress(a);
  const segmentsB = splitJapaneseAddress(b);
  if (segmentsA.length === 0 || segmentsB.length === 0) return 0;

  // Prefecture (first segment) must match.
  if (segmentsA[0] !== segmentsB[0]) return 0;

  // Ward / city (second segment) — weight 0.5 alone.
  if (segmentsA[1] && segmentsB[1] && segmentsA[1] === segmentsB[1]) return 1;
  return 0.5;
}

/**
 * Split an address like "東京都渋谷区神宮前1-1" into
 * ["東京都", "渋谷区", "神宮前1-1"]. Only the first two segments matter
 * for similarity, so we stop extracting after that to keep the helper
 * cheap.
 */
function splitJapaneseAddress(s: string): string[] {
  const trimmed = s.trim();
  if (trimmed.length === 0) return [];

  // Prefecture boundary: 都 / 道 / 府 / 県.
  const prefMatch = trimmed.match(/^(.+?[都道府県])(.*)$/);
  if (!prefMatch) {
    // Non-prefecture format — fall back to whitespace/comma split.
    return trimmed.split(/[\s,、]+/).filter(Boolean);
  }
  const prefecture = prefMatch[1];
  const rest = prefMatch[2];

  // Ward / city boundary: 市 / 区 / 郡 / 町 / 村.
  const wardMatch = rest.match(/^(.+?[市区郡町村])(.*)$/);
  if (!wardMatch) {
    return [prefecture, rest].filter(Boolean);
  }
  return [prefecture, wardMatch[1], wardMatch[2]].filter(Boolean);
}

/** Weights for each similarity dimension. Sum defines the theoretical max. */
export const SIMILARITY_WEIGHTS = {
  ceremonyStyles: 3,
  vibeTags: 3,
  location: 2,
  cost: 2,
  capacity: 1,
} as const;

/** Subset of Venue fields used by the similarity computation. */
export type VenueSimilarityShape = {
  id: string;
  ceremonyStyles?: readonly string[] | null;
  vibeTags?: readonly string[] | null;
  location?: string | null;
  costMin?: number | null;
  costMax?: number | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
};

/**
 * Combined similarity score between two venues.
 * Range: [0, Σ weights] = [0, 11]. Higher = more similar.
 * Returns 0 when neither venue has any populated field — caller excludes
 * zero-score candidates.
 */
export function computeVenueSimilarity(
  a: VenueSimilarityShape,
  b: VenueSimilarityShape,
): number {
  const ceremony = jaccard(a.ceremonyStyles, b.ceremonyStyles) * SIMILARITY_WEIGHTS.ceremonyStyles;
  const vibe = jaccard(a.vibeTags, b.vibeTags) * SIMILARITY_WEIGHTS.vibeTags;
  const location = locationPrefixMatch(a.location, b.location) * SIMILARITY_WEIGHTS.location;
  const cost = rangeOverlap(a.costMin, a.costMax, b.costMin, b.costMax) * SIMILARITY_WEIGHTS.cost;
  const capacity =
    rangeOverlap(a.capacityMin, a.capacityMax, b.capacityMin, b.capacityMax) *
    SIMILARITY_WEIGHTS.capacity;

  return ceremony + vibe + location + cost + capacity;
}

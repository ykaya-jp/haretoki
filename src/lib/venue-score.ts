/** Source weights for composite score calculation. user_rating is highest priority. */
export const SCORE_SOURCE_WEIGHTS: Record<string, number> = {
  user_rating: 1.0,
  zexy: 0.5,
  wedding_park: 0.5,
  hanayume: 0.4,
  mynavi: 0.3,
  ai_analysis: 0.4,
};

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
  const byDimension = new Map<string, Array<{ source: string; score: number }>>();
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

  const total = dimAverages.reduce((a, b) => a + b, 0) / dimAverages.length;
  // Round to 1 decimal
  return Math.round(total * 10) / 10;
}

import { DIMENSION_LABELS } from "@/lib/constants";

/**
 * Derive Pros (top-2) / Cons (bottom-2) dimensions for a single venue
 * from its 6-dimension score map. Pure function — no AI call, deterministic.
 *
 * Threshold: pros require score ≥ 4.0 (clearly good), cons score ≤ 2.5
 * (clearly weak). Middle scores (2.5–4.0) are treated as "neither
 * standout strong nor weak" and excluded — surfacing them as pros/cons
 * would mislead the couple ("3.0 = pro?" reads as endorsement that
 * doesn't match the felt experience).
 *
 * Returns at most 2 pros and 2 cons, sorted by absolute strength.
 */
export interface VenueProsCons {
  pros: Array<{ dim: string; label: string; score: number }>;
  cons: Array<{ dim: string; label: string; score: number }>;
}

const PRO_THRESHOLD = 4.0;
const CON_THRESHOLD = 2.5;

/** Convert ComparisonVenue.scores array → dimension→score map.
 *  Prefers user_rating over ai_analysis (matches matrix.ts logic). */
export function scoresToMap(
  scores: Array<{ dimension: string; score: number; source: string }>,
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const s of scores) {
    const existing = map[s.dimension];
    // user_rating wins over ai_analysis if both exist
    if (existing == null || s.source === "user_rating") {
      map[s.dimension] = s.score;
    }
  }
  return map;
}

export function deriveProsCons(
  scoresByDimension: Record<string, number | null>,
): VenueProsCons {
  const entries = Object.entries(scoresByDimension)
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([dim, score]) => ({
      dim,
      label: DIMENSION_LABELS[dim] ?? dim,
      score,
    }));

  const pros = entries
    .filter((e) => e.score >= PRO_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const cons = entries
    .filter((e) => e.score <= CON_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return { pros, cons };
}

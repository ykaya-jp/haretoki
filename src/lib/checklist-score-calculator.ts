import type { Tier1Dimension } from "./constants";
import { CHECKLIST_PRESETS } from "./checklist-presets";
import { ITEM_TO_DIMENSION } from "./dimension-checklist-map";

/**
 * Calculate a dimension score (1.0-5.0) from checklist answers.
 *
 * Only yesno-type items contribute to scoring:
 * - yes = 1.0, unknown = 0.5, no = 0.0, null = excluded
 *
 * Score = (weighted sum / answered count) * 4 + 1 → rounded to 0.5 steps
 * Returns null if fewer than 2 yesno items have been answered.
 */
export function calculateDimensionScore(
  dimension: Tier1Dimension,
  answers: Map<string, string | null>, // itemId → status (yes/no/unknown/null)
): number | null {
  // Get all yesno preset items mapped to this dimension
  const yesnoItems = CHECKLIST_PRESETS.filter(
    (p) => p.type === "yesno" && ITEM_TO_DIMENSION[p.id] === dimension,
  );

  let weightedSum = 0;
  let answeredCount = 0;

  for (const item of yesnoItems) {
    const status = answers.get(item.id);
    if (status === "yes") {
      weightedSum += 1.0;
      answeredCount++;
    } else if (status === "no") {
      weightedSum += 0.0;
      answeredCount++;
    } else if (status === "unknown") {
      weightedSum += 0.5;
      answeredCount++;
    }
    // null or not in map → skip
  }

  // Minimum threshold: need at least 2 answered yesno items
  if (answeredCount < 2) return null;

  // Normalize to 1.0-5.0 range, round to 0.5 steps
  const raw = (weightedSum / answeredCount) * 4 + 1;
  return Math.round(raw * 2) / 2;
}

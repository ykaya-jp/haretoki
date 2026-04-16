/** Maps the 6 score dimensions (TIER1_DIMENSIONS) to checklist preset categories/subcategories */

import { Tier1Dimension } from "./constants";
import { ChecklistPresetItem, ChecklistCategory, CHECKLIST_PRESETS } from "./checklist-presets";

export interface DimensionMapping {
  /** Checklist categories included for this dimension */
  categories: ChecklistCategory[];
  /** If set, only items whose subcategory is in this list are included */
  onlySubcategories?: string[];
  /** Pre-computed preset IDs (populated at module load time) */
  presetIds: string[];
}

/** Dimension → preset category mapping config (before resolving IDs) */
const MAPPING_CONFIG: Record<
  Tier1Dimension,
  { categories: ChecklistCategory[]; onlySubcategories?: string[] }
> = {
  atmosphere: { categories: ["chapel", "banquet"] },
  hospitality: { categories: ["staff_estimate"], onlySubcategories: ["スタッフ"] },
  cuisine: { categories: ["cuisine_drink"] },
  cost: { categories: ["staff_estimate"], onlySubcategories: ["見積り"] },
  access: { categories: ["facility"] },
  reviews: { categories: [] },
};

/** Resolve preset IDs for a mapping config entry */
function resolvePresetIds(
  categories: ChecklistCategory[],
  onlySubcategories?: string[],
): string[] {
  return CHECKLIST_PRESETS.filter((item) => {
    if (!categories.includes(item.category)) return false;
    if (onlySubcategories && onlySubcategories.length > 0) {
      return item.subcategory != null && onlySubcategories.includes(item.subcategory);
    }
    return true;
  }).map((item) => item.id);
}

/** Full mapping with resolved preset IDs */
export const DIMENSION_CHECKLIST_MAP: Record<Tier1Dimension, DimensionMapping> = (
  Object.entries(MAPPING_CONFIG) as [
    Tier1Dimension,
    { categories: ChecklistCategory[]; onlySubcategories?: string[] },
  ][]
).reduce(
  (acc, [dim, config]) => {
    acc[dim] = {
      ...config,
      presetIds: resolvePresetIds(config.categories, config.onlySubcategories),
    };
    return acc;
  },
  {} as Record<Tier1Dimension, DimensionMapping>,
);

/** Build reverse lookup: presetId → dimension */
const PRESET_TO_DIMENSION: Map<string, Tier1Dimension> = new Map();
for (const [dim, mapping] of Object.entries(DIMENSION_CHECKLIST_MAP) as [
  Tier1Dimension,
  DimensionMapping,
][]) {
  for (const id of mapping.presetIds) {
    PRESET_TO_DIMENSION.set(id, dim);
  }
}

/** Returns all ChecklistPresetItems mapped to a given dimension */
export function getChecklistItemsForDimension(dimension: Tier1Dimension): ChecklistPresetItem[] {
  const mapping = DIMENSION_CHECKLIST_MAP[dimension];
  if (!mapping || mapping.presetIds.length === 0) return [];
  const idSet = new Set(mapping.presetIds);
  return CHECKLIST_PRESETS.filter((item) => idSet.has(item.id));
}

/** Reverse lookup: returns the dimension for a preset ID, falls back to "atmosphere" */
export function getDimensionForPreset(presetId: string): Tier1Dimension {
  return PRESET_TO_DIMENSION.get(presetId) ?? "atmosphere";
}

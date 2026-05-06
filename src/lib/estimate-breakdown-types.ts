/**
 * Pure type + constant module for estimate breakdown comparison.
 *
 * Lives outside the `"use server"` boundary so it can be imported from
 * UI components and unit tests without the "Server Actions must be
 * async" compile error.
 */

export type EstimateCategory =
  | "attire"
  | "cuisine"
  | "photo_video"
  | "flowers"
  | "performance"
  | "av_equipment"
  | "venue_fee"
  | "other";

export const ESTIMATE_CATEGORY_LABELS: Record<EstimateCategory, string> = {
  attire: "衣裳",
  cuisine: "料理・飲み物",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・照明",
  venue_fee: "会場費",
  other: "その他",
};

export const ESTIMATE_CATEGORY_ORDER: EstimateCategory[] = [
  "venue_fee",
  "cuisine",
  "attire",
  "flowers",
  "photo_video",
  "performance",
  "av_equipment",
  "other",
];

export interface EstimateItemCell {
  amount: number;
  tier: "minimum" | "standard" | "premium" | "unknown";
  isCheapest: boolean;
}

export interface EstimateItemRow {
  category: EstimateCategory;
  itemName: string;
  cellsByVenueId: Record<string, EstimateItemCell | null>;
}

export interface EstimateGroup {
  category: EstimateCategory;
  label: string;
  rows: EstimateItemRow[];
  /** Subtotal per venue (sum of items in this category). */
  subtotalByVenueId: Record<string, number>;
  /** Venue id with the lowest non-zero subtotal, or null when tied / empty */
  cheapestSubtotalVenueId: string | null;
}

export interface EstimateBreakdownComparison {
  /** Venues that have at least one estimate item — others are filtered
   *  so the UI doesn't render empty columns. */
  venueIds: string[];
  groups: EstimateGroup[];
  /** Grand total per venue (sum of every item) */
  grandTotalByVenueId: Record<string, number>;
}

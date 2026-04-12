"use client";

import { useState } from "react";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { ScoreBadge } from "./score-badge";
import { formatYen } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  venue_fee: "会場費",
  cuisine: "料理",
  attire: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・映像設備",
  other: "その他",
};

// Ordered category keys for consistent display
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

export type CategoryEstimate = {
  category: string;
  total: number;
};

export type VenueData = {
  id: string;
  name: string;
  scores: Partial<Record<string, number>>;
  estimateTotal: number | null;
  estimatePredicted: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  status: string;
  categoryEstimates?: CategoryEstimate[];
};

function formatYenMan(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `¥${Math.round(value / 10000)}万`;
}

function formatCapacity(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${min}〜${max}名`;
  if (max !== null) return `〜${max}名`;
  return `${min}名〜`;
}

/**
 * Find the category with the biggest absolute difference across venues.
 */
function findBiggestDiffCategory(
  venues: VenueData[]
): string | null {
  const categoryTotals = new Map<string, number[]>();

  for (const venue of venues) {
    if (!venue.categoryEstimates) continue;
    for (const ce of venue.categoryEstimates) {
      const arr = categoryTotals.get(ce.category) ?? [];
      arr.push(ce.total);
      categoryTotals.set(ce.category, arr);
    }
  }

  let maxDiff = 0;
  let maxCategory: string | null = null;

  for (const [category, values] of categoryTotals) {
    if (values.length < 2) continue;
    const diff = Math.max(...values) - Math.min(...values);
    if (diff > maxDiff) {
      maxDiff = diff;
      maxCategory = category;
    }
  }

  return maxCategory;
}

export function ComparisonMatrix({ venues }: { venues: VenueData[] }) {
  const [showCategoryDetail, setShowCategoryDetail] = useState(false);

  // Check if any venue has category estimates
  const hasCategoryData = venues.some(
    (v) => v.categoryEstimates && v.categoryEstimates.length > 0
  );

  const biggestDiffCategory = hasCategoryData
    ? findBiggestDiffCategory(venues)
    : null;

  // Collect all categories present across venues
  const allCategories = new Set<string>();
  for (const venue of venues) {
    if (venue.categoryEstimates) {
      for (const ce of venue.categoryEstimates) {
        allCategories.add(ce.category);
      }
    }
  }
  const sortedCategories = CATEGORY_ORDER.filter((c) => allCategories.has(c));

  function getCategoryTotal(
    venue: VenueData,
    category: string
  ): number | null {
    const ce = venue.categoryEstimates?.find((c) => c.category === category);
    return ce?.total ?? null;
  }

  return (
    <div className="overflow-x-auto -mx-0">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground min-w-[80px]">
              項目
            </th>
            {venues.map((venue) => (
              <th
                key={venue.id}
                className="min-w-[100px] px-3 py-2 text-center font-medium"
              >
                {venue.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Tier 1 dimension rows */}
          {TIER1_DIMENSIONS.map((dim) => (
            <tr key={dim} className="border-t border-border/50">
              <td className="sticky left-0 z-10 bg-card px-3 py-2 text-muted-foreground">
                {DIMENSION_LABELS[dim] ?? dim}
              </td>
              {venues.map((venue) => (
                <td key={venue.id} className="px-3 py-2 text-center">
                  <ScoreBadge score={venue.scores[dim] ?? null} />
                </td>
              ))}
            </tr>
          ))}

          {/* Estimate total row */}
          <tr className="border-t border-border/50">
            <td className="sticky left-0 z-10 bg-card px-3 py-2 text-muted-foreground">
              初期見積もり
            </td>
            {venues.map((venue) => (
              <td key={venue.id} className="px-3 py-2 text-center tabular-nums">
                {formatYenMan(venue.estimateTotal)}
              </td>
            ))}
          </tr>

          {/* Predicted final row (amber/gold background) */}
          <tr className="border-t border-border/50 bg-amber-50 dark:bg-amber-950/30">
            <td className="sticky left-0 z-10 bg-amber-50 px-3 py-2 font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              最終予測額
            </td>
            {venues.map((venue) => (
              <td
                key={venue.id}
                className="px-3 py-2 text-center font-medium tabular-nums text-amber-800 dark:text-amber-200"
              >
                {formatYenMan(venue.estimatePredicted)}
              </td>
            ))}
          </tr>

          {/* Expandable category detail section */}
          {hasCategoryData && (
            <>
              <tr className="border-t border-border/50">
                <td
                  colSpan={venues.length + 1}
                  className="px-0 py-0"
                >
                  <button
                    type="button"
                    onClick={() => setShowCategoryDetail(!showCategoryDetail)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 active:bg-muted min-h-[44px]"
                  >
                    <span>見積もり詳細</span>
                    {showCategoryDetail ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </td>
              </tr>

              {showCategoryDetail &&
                sortedCategories.map((category) => (
                  <tr
                    key={category}
                    className={`border-t border-border/30 ${
                      category === biggestDiffCategory
                        ? "bg-amber-50/50 dark:bg-amber-950/20"
                        : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 pl-6 text-xs text-muted-foreground">
                      {CATEGORY_LABELS[category] ?? category}
                      {category === biggestDiffCategory && (
                        <span className="ml-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          差額大
                        </span>
                      )}
                    </td>
                    {venues.map((venue) => {
                      const total = getCategoryTotal(venue, category);
                      return (
                        <td
                          key={venue.id}
                          className={`px-3 py-1.5 text-center text-xs tabular-nums ${
                            category === biggestDiffCategory
                              ? "font-medium text-amber-800 dark:text-amber-200"
                              : "text-muted-foreground"
                          }`}
                        >
                          {total !== null ? formatYen(total) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </>
          )}

          {/* Capacity row */}
          <tr className="border-t border-border/50">
            <td className="sticky left-0 z-10 bg-card px-3 py-2 text-muted-foreground">
              収容人数
            </td>
            {venues.map((venue) => (
              <td key={venue.id} className="px-3 py-2 text-center">
                {formatCapacity(venue.capacityMin, venue.capacityMax)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

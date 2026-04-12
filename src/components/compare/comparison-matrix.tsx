import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { ScoreBadge } from "./score-badge";

export type VenueData = {
  id: string;
  name: string;
  scores: Partial<Record<string, number>>;
  estimateTotal: number | null;
  estimatePredicted: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  status: string;
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

export function ComparisonMatrix({ venues }: { venues: VenueData[] }) {
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

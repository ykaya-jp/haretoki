"use client";

import { Sparkles, ThumbsUp, AlertCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonVenue } from "@/lib/comparison-types";

/**
 * R2 — desktop /compare row that surfaces the rolled-up review summary
 * for each venue side-by-side. Contract:
 *
 *   - One label cell ("口コミ要約") in column 1.
 *   - One cell per venue with: top 1 strength + top 1 concern + total
 *     count badge. The 220-char `summary` lives in the mobile snapper
 *     collapsible — too noisy to wedge into a 160px-wide column.
 *   - Cell stays empty (DashCell) when the venue has no reviewSummary
 *     OR the summary has count=0 — both render as "口コミなし".
 *
 * Why top-1 (not top-3) here: the desktop grid already has 30+ rows.
 * Squeezing 3 strengths × 3 concerns × N venues blows up vertical
 * height and forces side scrolling. Mobile owns the deep dive.
 *
 * The whole row is hidden by the parent grid when *every* venue lacks
 * a populated reviewSummary — see comparison-grid.tsx slot generation.
 */

interface ComparisonReviewRowProps {
  venues: ComparisonVenue[];
  rowIndex: number;
}

function DashCell() {
  return (
    <span className="inline-flex items-center text-muted-foreground/40">
      <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
    </span>
  );
}

export function ComparisonReviewRow({
  venues,
  rowIndex,
}: ComparisonReviewRowProps) {
  const rowStyle = { gridRow: rowIndex };

  return (
    <>
      {/* Label cell — always column 1 */}
      <div
        style={{ ...rowStyle, gridColumn: 1 }}
        className="sticky left-0 z-10 flex items-start gap-1.5 border-b border-border/20 bg-background px-3 py-2.5"
      >
        <p className="text-[11px] font-medium leading-snug text-muted-foreground">
          口コミ要約
        </p>
      </div>

      {venues.map((venue, i) => {
        const summary = venue.reviewSummary;
        const hasContent =
          summary !== undefined &&
          summary.count > 0 &&
          (summary.summary !== null ||
            summary.strengths.length > 0 ||
            summary.concerns.length > 0);

        return (
          <div
            key={venue.id}
            style={{ ...rowStyle, gridColumn: i + 2 }}
            className={cn(
              "flex items-start border-b border-l border-border/20 px-3 py-2.5",
            )}
          >
            {!hasContent ? (
              <DashCell />
            ) : (
              <div className="min-w-0 flex-1 space-y-1.5">
                {summary.strengths[0] && (
                  <div className="flex items-start gap-1">
                    <ThumbsUp
                      className="mt-0.5 h-3 w-3 shrink-0 text-[var(--gold-warm)]"
                      strokeWidth={2}
                      aria-label="強み"
                    />
                    <p className="text-[11px] leading-snug text-foreground line-clamp-2">
                      {summary.strengths[0]}
                    </p>
                  </div>
                )}
                {summary.concerns[0] && (
                  <div className="flex items-start gap-1">
                    <AlertCircle
                      className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                      aria-label="気になる点"
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                      {summary.concerns[0]}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 pt-0.5">
                  <Sparkles
                    className="h-2.5 w-2.5 text-[var(--gold-warm)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    口コミ {summary.count.toLocaleString("ja-JP")} 件
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

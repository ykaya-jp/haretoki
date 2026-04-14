"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Check } from "lucide-react";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { generateRatingComparison } from "@/server/actions/rating-comparison";
import { cn } from "@/lib/utils";

interface PartnerComparisonSummaryProps {
  venueId: string;
  myRatings: Record<string, number>;
  partnerRatings: Record<string, number>;
}

export function PartnerComparisonSummary({
  venueId,
  myRatings,
  partnerRatings,
}: PartnerComparisonSummaryProps) {
  const [aiComment, setAiComment] = useState<string | null>(null);

  useEffect(() => {
    generateRatingComparison(venueId).then(({ comment }) => setAiComment(comment));
  }, [venueId]);

  const dimensions = TIER1_DIMENSIONS.filter(
    (dim) => myRatings[dim] !== undefined || partnerRatings[dim] !== undefined
  );

  if (dimensions.length === 0) return null;

  const agreementCount = dimensions.filter((dim) => {
    const my = myRatings[dim] ?? 0;
    const partner = partnerRatings[dim] ?? 0;
    return my > 0 && partner > 0 && Math.abs(my - partner) <= 1;
  }).length;

  const ratedDimensions = dimensions.filter(
    (dim) => (myRatings[dim] ?? 0) > 0 && (partnerRatings[dim] ?? 0) > 0
  );
  const agreementPct = ratedDimensions.length > 0
    ? Math.round((agreementCount / ratedDimensions.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">二人の評価比較</h3>
        {ratedDimensions.length > 0 && (
          <span className="text-xs text-muted-foreground">一致度 <span className="tabular-nums">{agreementPct}%</span></span>
        )}
      </div>

      <div className="space-y-2">
        {dimensions.map((dim) => {
          const my = myRatings[dim] ?? 0;
          const partner = partnerRatings[dim] ?? 0;
          const diff = Math.abs(my - partner);
          const isAgreed = my > 0 && partner > 0 && diff <= 1;
          const isDisagreed = my > 0 && partner > 0 && diff >= 2;

          return (
            <div
              key={dim}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2",
                isAgreed && "border-l-2 border-l-[var(--success)] bg-[var(--success)]/5",
                isDisagreed && "border-l-2 border-l-amber-500 bg-amber-50"
              )}
            >
              <div className="w-20 text-xs">{DIMENSION_LABELS[dim]}</div>
              <div className="flex flex-1 items-center gap-2">
                {/* My rating bar */}
                <div className="flex-1">
                  <div
                    className="h-2 rounded-full bg-[var(--gold-warm)]"
                    style={{ width: `${(my / 5) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums">{my || "-"}</span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{ width: `${(partner / 5) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums">{partner || "-"}</span>
              </div>
              {isAgreed && <Check className="h-4 w-4 text-[var(--success)]" />}
              {isDisagreed && <MessageCircle className="h-4 w-4 text-amber-500" />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="h-2 w-4 rounded-full bg-[var(--gold-warm)]" /> 自分
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-4 rounded-full bg-secondary" /> パートナー
        </span>
      </div>

      {/* AI comment */}
      {aiComment && (
        <div className="rounded-lg bg-[var(--gold-subtle)] p-3 text-sm">
          <p>{aiComment}</p>
        </div>
      )}
    </div>
  );
}

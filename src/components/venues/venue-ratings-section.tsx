"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { StarRating } from "@/components/ratings/star-rating";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_HELP,
} from "@/lib/constants";
import { saveDirectRatings } from "@/server/actions/ratings";
import { cn } from "@/lib/utils";

interface PartnerRatingData {
  name: string;
  ratings: Record<string, number>;
}

interface VenueRatingsSectionProps {
  venueId: string;
  /** Existing scores keyed by dimension name (source "user_rating") */
  initialScores: Record<string, number>;
  /** Owner rating data for side-by-side display */
  ownerRatings?: PartnerRatingData | null;
  /** Partner rating data for side-by-side display */
  partnerRatings?: PartnerRatingData | null;
}

/** Check if ratings diverge by >= 2 stars */
function isDivergent(
  ownerScore: number | undefined,
  partnerScore: number | undefined,
): boolean {
  if (ownerScore == null || partnerScore == null) return false;
  return Math.abs(ownerScore - partnerScore) >= 2;
}

export function VenueRatingsSection({
  venueId,
  initialScores,
  ownerRatings,
  partnerRatings,
}: VenueRatingsSectionProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    // Initialize from existing scores, rounding to nearest int for star display
    const initial: Record<string, number> = {};
    for (const [dim, score] of Object.entries(initialScores)) {
      initial[dim] = Math.round(score);
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPartner = !!partnerRatings;

  const doSave = useCallback(
    (currentRatings: Record<string, number>) => {
      if (Object.keys(currentRatings).length === 0) return;

      setSaveStatus("saving");
      startTransition(async () => {
        const result = await saveDirectRatings(venueId, {
          ratings: currentRatings,
        });
        if (result.success) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
        }
      });
    },
    [venueId, startTransition],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(dimension: string, value: number) {
    const next = { ...ratings, [dimension]: value };
    setRatings(next);
    setSaveStatus("idle");

    // Debounced auto-save after 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(next), 500);
  }

  return (
    <div className="space-y-4">
      {/* Column headers when partner exists */}
      {hasPartner && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex-1" />
          <span className="w-24 text-center">{ownerRatings?.name ?? "あなた"}</span>
          <span className="w-24 text-center">{partnerRatings.name}</span>
        </div>
      )}

      {TIER1_DIMENSIONS.map((dimension) => {
        const ownerScore = ownerRatings?.ratings[dimension];
        const partnerScore = partnerRatings?.ratings[dimension];
        const divergent = isDivergent(ownerScore, partnerScore);

        return (
          <div
            key={dimension}
            className={cn(
              "space-y-0.5 rounded-lg p-2 -mx-2",
              divergent && "bg-amber-50 dark:bg-amber-950/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">
                  {DIMENSION_LABELS[dimension]}
                </span>
                {divergent && (
                  <span className="ml-2 inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                    意見が分かれています
                  </span>
                )}
              </div>
              {hasPartner ? (
                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <StarRating
                      value={ratings[dimension] ?? 0}
                      onChange={(value) => handleChange(dimension, value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="w-24">
                    <StarRating
                      value={partnerScore ?? 0}
                      onChange={() => {}}
                      disabled
                    />
                  </div>
                </div>
              ) : (
                <StarRating
                  value={ratings[dimension] ?? 0}
                  onChange={(value) => handleChange(dimension, value)}
                  disabled={isPending}
                />
              )}
            </div>
            {DIMENSION_HELP[dimension] && (
              <p className="text-xs text-muted-foreground">
                {DIMENSION_HELP[dimension]}
              </p>
            )}
          </div>
        );
      })}

      <div className="h-5 text-center text-xs">
        {saveStatus === "saving" && (
          <span className="text-muted-foreground">保存中...</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-green-600 dark:text-green-400">
            印象を記録しました ✨
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-destructive">
            保存に失敗しました。もう一度お試しください。
          </span>
        )}
      </div>
    </div>
  );
}

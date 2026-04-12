"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { StarRating } from "@/components/ratings/star-rating";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_HELP,
} from "@/lib/constants";
import { saveDirectRatings } from "@/server/actions/ratings";

interface VenueRatingsSectionProps {
  venueId: string;
  /** Existing scores keyed by dimension name (source "user_rating") */
  initialScores: Record<string, number>;
}

export function VenueRatingsSection({
  venueId,
  initialScores,
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
      {TIER1_DIMENSIONS.map((dimension) => (
        <div key={dimension} className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {DIMENSION_LABELS[dimension]}
            </span>
            <StarRating
              value={ratings[dimension] ?? 0}
              onChange={(value) => handleChange(dimension, value)}
              disabled={isPending}
            />
          </div>
          {DIMENSION_HELP[dimension] && (
            <p className="text-xs text-muted-foreground">
              {DIMENSION_HELP[dimension]}
            </p>
          )}
        </div>
      ))}

      <div className="h-5 text-center text-xs">
        {saveStatus === "saving" && (
          <span className="text-muted-foreground">保存中...</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-green-600 dark:text-green-400">
            保存しました
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

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ratings/star-rating";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
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
  const [ratings, setRatings] = useState<Record<string, number>>(
    () => {
      // Initialize from existing scores, rounding to nearest int for star display
      const initial: Record<string, number> = {};
      for (const [dim, score] of Object.entries(initialScores)) {
        initial[dim] = Math.round(score);
      }
      return initial;
    },
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleChange(dimension: string, value: number) {
    setRatings((prev) => ({ ...prev, [dimension]: value }));
    // Clear message when user makes changes
    setMessage(null);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveDirectRatings(venueId, { ratings });
      if (result.success) {
        setMessage({ type: "success", text: "評価を保存しました" });
        // Auto-clear success message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: "保存に失敗しました。もう一度お試しください。",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {TIER1_DIMENSIONS.map((dimension) => (
        <div key={dimension} className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {DIMENSION_LABELS[dimension]}
          </span>
          <StarRating
            value={ratings[dimension] ?? 0}
            onChange={(value) => handleChange(dimension, value)}
            disabled={isPending}
          />
        </div>
      ))}

      {message && (
        <p
          className={
            message.type === "success"
              ? "text-sm text-green-600 dark:text-green-400"
              : "text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={isPending || Object.keys(ratings).length === 0}
        className="w-full"
      >
        {isPending ? "保存中..." : "評価を保存"}
      </Button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ratings/star-rating";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { saveRatings } from "@/server/actions/ratings";

interface DimensionRatingsProps {
  venueId: string;
  visitId: string;
  initialRatings?: Record<string, number>;
}

export function DimensionRatings({
  venueId,
  visitId,
  initialRatings,
}: DimensionRatingsProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(
    initialRatings ?? {},
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(dimension: string, value: number) {
    setRatings((prev) => ({ ...prev, [dimension]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveRatings(venueId, visitId, { ratings });
      if (!result.success) {
        setError("保存に失敗しました。もう一度お試しください。");
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

      {error && <p className="text-sm text-destructive">{error}</p>}

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

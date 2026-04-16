"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { StarRating } from "@/components/ratings/star-rating";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_HELP,
} from "@/lib/constants";
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
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const doSave = useCallback(
    (currentRatings: Record<string, number>) => {
      if (Object.keys(currentRatings).length === 0) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setSaveStatus("saving");
      startTransition(async () => {
        try {
          const result = await saveRatings(venueId, visitId, {
            ratings: currentRatings,
          });
          if (result.success) {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          } else {
            setSaveStatus("error");
          }
        } finally {
          inFlightRef.current = false;
        }
      });
    },
    [venueId, visitId, startTransition],
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
          <span className="text-muted-foreground">いま残しています…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]">
            残しました
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-destructive">
            うまく残せませんでした。もう一度お試しください。
          </span>
        )}
      </div>
    </div>
  );
}

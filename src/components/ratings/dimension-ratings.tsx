"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { StarRating } from "@/components/ratings/star-rating";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_HELP,
} from "@/lib/constants";
import { saveRatings } from "@/server/actions/ratings";
import {
  getSuggestedScores,
  acceptSuggestedScore,
  type SuggestedScore,
} from "@/server/actions/checklist";

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
  const [suggestions, setSuggestions] = useState<SuggestedScore[]>([]);
  const [dismissedDims, setDismissedDims] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  // Fetch checklist-based suggestions on mount
  useEffect(() => {
    getSuggestedScores(venueId).then(setSuggestions).catch(() => {});
  }, [venueId]);

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
    // Dismiss suggestion for this dimension since user set it manually
    setDismissedDims((prev) => new Set(prev).add(dimension));
    setSaveStatus("idle");

    // Debounced auto-save after 500ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(next), 500);
  }

  function handleAcceptSuggestion(dimension: string, score: number) {
    // Optimistically update the rating
    const next = { ...ratings, [dimension]: score };
    setRatings(next);
    setDismissedDims((prev) => new Set(prev).add(dimension));

    startTransition(async () => {
      await acceptSuggestedScore(venueId, dimension, score);
      doSave(next);
    });
  }

  function handleDismissSuggestion(dimension: string) {
    setDismissedDims((prev) => new Set(prev).add(dimension));
  }

  return (
    <div className="space-y-4">
      {TIER1_DIMENSIONS.map((dimension) => {
        const suggestion = suggestions.find(
          (s) => s.dimension === dimension && !dismissedDims.has(dimension),
        );

        return (
          <div key={dimension} className="space-y-1">
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
            {/* Suggestion card from checklist answers */}
            {suggestion && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--gold-warm)]/20 bg-[var(--gold-subtle)] px-3 py-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--gold-warm)]" strokeWidth={1.5} />
                <p className="min-w-0 flex-1 text-[11px] leading-snug text-foreground/80">
                  チェックリストの回答からは
                  <span className="mx-0.5 font-medium tabular-nums text-[var(--gold-warm)]">
                    ★{suggestion.suggestedScore.toFixed(1)}
                  </span>
                  くらいかも
                  <span className="text-muted-foreground">
                    （{suggestion.answeredCount}/{suggestion.totalYesnoItems}項目）
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => handleAcceptSuggestion(dimension, suggestion.suggestedScore)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold-warm)]/10 text-[var(--gold-warm)] transition-colors active:bg-[var(--gold-warm)]/20"
                  aria-label="提案を反映"
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissSuggestion(dimension)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                  aria-label="提案を閉じる"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        );
      })}

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

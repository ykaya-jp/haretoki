"use client";

import { useState, useTransition, useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { upsertVisitRating } from "@/server/actions/visits";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const STAR_LABELS: Record<number, string> = {
  1: "あまり…",
  2: "もう少し",
  3: "まあまあ",
  4: "よかった",
  5: "心から好き",
};

interface VisitRatingFormProps {
  visitId: string;
  venueId: string;
  existingRatings?: Record<string, number>;
  onSaved?: () => void;
}

export function VisitRatingForm({
  visitId,
  venueId: _venueId, // eslint-disable-line @typescript-eslint/no-unused-vars
  existingRatings = {},
  onSaved,
}: VisitRatingFormProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(existingRatings);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function handleChange(
    dimension: (typeof TIER1_DIMENSIONS)[number],
    score: number,
  ) {
    const next = { ...ratings, [dimension]: score };
    setRatings(next);
    setSaveStatus("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setSaveStatus("saving");
        const result = await upsertVisitRating(visitId, dimension, score);
        if (result.success) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
          onSaved?.();
          router.refresh();
        } else {
          setSaveStatus("error");
          toast.error(result.error ?? "うまく残せませんでした");
        }
      });
    }, 400);
  }

  return (
    <div className="space-y-3">
      {TIER1_DIMENSIONS.map((dimension) => {
        const value = ratings[dimension] ?? 0;
        return (
          <div key={dimension} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-light text-foreground/80">
                {DIMENSION_LABELS[dimension]}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= value;
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${DIMENSION_LABELS[dimension]} ${star}点`}
                      aria-pressed={filled ? "true" : "false"}
                      disabled={isPending}
                      onClick={() => handleChange(dimension, star)}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90",
                        isPending && "cursor-wait opacity-60",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          filled ? "fill-accent text-accent" : "fill-none text-border",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            {value > 0 && (
              <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                {STAR_LABELS[value]}
              </p>
            )}
          </div>
        );
      })}

      <div className="h-4 text-center text-xs">
        {saveStatus === "saving" && (
          <span className="text-muted-foreground">いま残しています…</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]">
            残しました
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-destructive">うまく残せませんでした</span>
        )}
      </div>
    </div>
  );
}

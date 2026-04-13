"use client";

import { useState, useRef, useCallback } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TIER1_DIMENSIONS, DIMENSION_LABELS, DIMENSION_HELP } from "@/lib/constants";
import { saveDirectRatings } from "@/server/actions/ratings";

const EMOTION_LABELS: Record<number, string> = {
  1: "期待はずれ",
  2: "いまいち",
  3: "普通",
  4: "良い",
  5: "感動!",
};

interface RatingSectionProps {
  venueId: string;
  initialRatings: Record<string, number>;
  partnerRatings?: Record<string, number>;
}

export function RatingSection({
  venueId,
  initialRatings,
  partnerRatings,
}: RatingSectionProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (newRatings: Record<string, number>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const result = await saveDirectRatings(venueId, { ratings: newRatings });
          if (!result.success) {
            toast.error("評価の保存に失敗しました");
          }
        } catch {
          toast.error("評価の保存に失敗しました");
        }
      }, 500);
    },
    [venueId],
  );

  const handleRate = (dimension: string, score: number) => {
    const newRatings = { ...ratings, [dimension]: score };
    setRatings(newRatings);
    debouncedSave(newRatings);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base">評価</h2>
      {TIER1_DIMENSIONS.map((dim) => {
        const value = ratings[dim] ?? 0;
        const partnerValue = partnerRatings?.[dim];
        return (
          <div key={dim} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{DIMENSION_LABELS[dim]}</span>
              {value > 0 && (
                <span className="text-xs text-muted-foreground">
                  {EMOTION_LABELS[value]}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{DIMENSION_HELP[dim]}</p>
            <div
              role="radiogroup"
              aria-label={`${DIMENSION_LABELS[dim]}の評価`}
              className="flex gap-2"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={value === n}
                  aria-label={`${n}点`}
                  onClick={() => handleRate(dim, n)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    className={cn(
                      "h-[48px] w-[48px]",
                      n <= value
                        ? "fill-[var(--gold-warm)] text-[var(--gold-warm)]"
                        : "text-border",
                    )}
                  />
                </button>
              ))}
            </div>
            {partnerValue !== undefined && partnerValue > 0 && (
              <div className="flex items-center gap-1 pl-1">
                <span className="text-xs text-muted-foreground">パートナー:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "h-4 w-4",
                        n <= partnerValue
                          ? "fill-secondary text-secondary"
                          : "text-border",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

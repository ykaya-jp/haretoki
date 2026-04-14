"use client";

import { useState, useRef, useCallback } from "react";
import { Star, Check } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
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
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (newRatings: Record<string, number>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const result = await saveDirectRatings(venueId, { ratings: newRatings });
          if (!result.success) {
            toast.error("評価の保存に失敗しました");
            return;
          }
          setJustSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setJustSaved(false), 1000);
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
    <section className="relative space-y-4">
      <h2 className="text-base">評価</h2>
      <AnimatePresence>
        {justSaved && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-0 right-0 text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
            aria-live="polite"
          >
            <Check className="h-3 w-3" /> 保存しました
          </motion.span>
        )}
      </AnimatePresence>
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
                  tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
                  onClick={() => handleRate(dim, n)}
                  onKeyDown={(e) => {
                    // Arrow keys / Home / End navigate within the radio group
                    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                      e.preventDefault();
                      handleRate(dim, Math.min(5, (value || 0) + 1 || n + 1));
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                      e.preventDefault();
                      handleRate(dim, Math.max(1, (value || n) - 1));
                    } else if (e.key === "Home") {
                      e.preventDefault();
                      handleRate(dim, 1);
                    } else if (e.key === "End") {
                      e.preventDefault();
                      handleRate(dim, 5);
                    }
                  }}
                  className="rounded transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)] focus-visible:ring-offset-2"
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

"use client";

import { useCallback, useRef, useState } from "react";
import { Check } from "lucide-react";
import { showToast } from "@/lib/toast";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TIER1_DIMENSIONS, DIMENSION_LABELS, DIMENSION_HELP } from "@/lib/constants";
import { saveDirectRatings } from "@/server/actions/ratings";

const HALF_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

function scoreToLabel(score: number): string {
  if (score >= 4.5) return "感動!";
  if (score >= 4.0) return "良い";
  if (score >= 3.0) return "普通";
  if (score >= 2.0) return "いまいち";
  return "期待はずれ";
}

interface RatingBarProps {
  value: number;
  onChange: (score: number) => void;
  label: string;
}

/** Horizontal tap/drag rating bar with 0.5-step snapping. */
function RatingBar({ value, onChange, label }: RatingBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  function getScoreFromX(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const raw = ratio * 5;
    // Snap to nearest 0.5
    return Math.round(raw * 2) / 2 || 0.5;
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    onChange(getScoreFromX(e.clientX));
  }

  function handleTouch(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches[0]) {
      onChange(getScoreFromX(e.touches[0].clientX));
    }
  }

  const fillPct = (value / 5) * 100;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={value > 0 ? `${value}点 ${scoreToLabel(value)}` : "未評価"}
      tabIndex={0}
      onClick={handleClick}
      onTouchStart={handleTouch}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(5, (value || 0) + 0.5));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(Math.max(0.5, (value || 0.5) - 0.5));
        } else if (e.key === "Home") {
          e.preventDefault();
          onChange(0.5);
        } else if (e.key === "End") {
          e.preventDefault();
          onChange(5);
        }
      }}
      className="relative h-11 cursor-pointer rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)] focus-visible:ring-offset-2 active:opacity-80"
    >
      {/* Fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-lg bg-[var(--gold-warm)] transition-[width] duration-100"
        style={{ width: `${fillPct}%` }}
        aria-hidden
      />
      {/* Tick marks at each 0.5 step */}
      {HALF_STEPS.map((step) => (
        <div
          key={step}
          aria-hidden
          className={cn(
            "absolute top-1/2 h-3 w-px -translate-y-1/2",
            step <= value ? "bg-background/40" : "bg-border",
          )}
          style={{ left: `${(step / 5) * 100}%` }}
        />
      ))}
      {/* Numeric value — follows the fill head so it sits inside the filled
          portion (white text on gold) at every step. When the fill is under
          18% the number parks just outside the head in dark text to stay
          readable. Previous design kept the label glued to the right edge
          so only 4.5 / 5.0 landed inside the fill. */}
      {value > 0 ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-[left] duration-100",
            fillPct >= 18
              ? "bg-transparent text-white"
              : "bg-card text-foreground shadow-sm",
          )}
          style={{
            left: `calc(${fillPct}% + ${fillPct >= 18 ? "-36px" : "4px"})`,
          }}
        >
          {value % 1 === 0 ? `${value}.0` : value.toFixed(1)}
        </span>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
        >
          タップして評価
        </span>
      )}
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (newRatings: Record<string, number>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSaving(true);
      setJustSaved(false);
      timerRef.current = setTimeout(async () => {
        try {
          const result = await saveDirectRatings(venueId, { ratings: newRatings });
          if (!result.success) {
            setSaving(false);
            const detail =
              typeof result.error === "object" &&
              result.error &&
              "formErrors" in result.error
                ? (result.error.formErrors?.[0] ?? null)
                : null;
            showToast(
              "error",
              detail
                ? `うまく残せませんでした: ${detail}。もう一度お試しください`
                : "うまく残せませんでした。もう一度お試しください",
            );
            return;
          }
          setSaving(false);
          setJustSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setJustSaved(false), 1000);
        } catch (err) {
          setSaving(false);
          console.error("[rating] save failed:", err);
          showToast("error", "うまく残せませんでした。もう一度お試しください");
        }
      }, 500);
    },
    [venueId],
  );

  const handleRate = (dimension: string, score: number) => {
    // Update local state with the merged map (so the UI reflects all current
    // sliders). Only send the *changed* dimension to the server though:
    // initialRatings comes from VenueScore averages stored as Decimal(2,1),
    // which can land on non-0.5 increments like 3.6 — and the zod schema
    // enforces multipleOf(0.5). Re-sending those legacy averages would fail
    // validation and surface as the generic '保存できませんでした' toast even
    // though the user's own click was a valid 0.5 step.
    const newRatings = { ...ratings, [dimension]: score };
    setRatings(newRatings);
    debouncedSave({ [dimension]: score });
  };

  return (
    <section className="relative space-y-4">
      <h2 className="text-base">印象を残す</h2>
      <AnimatePresence mode="wait">
        {saving ? (
          <motion.span
            key="saving"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 right-0 text-xs text-muted-foreground flex items-center gap-1"
            aria-live="polite"
          >
            いま残しています…
          </motion.span>
        ) : justSaved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-0 right-0 text-xs text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))] flex items-center gap-1"
            aria-live="polite"
          >
            <Check className="h-3 w-3" /> 残しました
          </motion.span>
        ) : null}
      </AnimatePresence>

      {TIER1_DIMENSIONS.map((dim) => {
        const value = ratings[dim] ?? 0;
        const partnerValue = partnerRatings?.[dim];
        return (
          <div key={dim} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm">{DIMENSION_LABELS[dim]}</span>
              {value > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {scoreToLabel(value)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{DIMENSION_HELP[dim]}</p>
            <RatingBar
              value={value}
              onChange={(score) => handleRate(dim, score)}
              label={DIMENSION_LABELS[dim]}
            />
            {partnerValue !== undefined && partnerValue > 0 && (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-xs text-muted-foreground">パートナー:</span>
                <div className="relative h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-secondary"
                    style={{ width: `${(partnerValue / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {partnerValue % 1 === 0 ? `${partnerValue}.0` : partnerValue}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

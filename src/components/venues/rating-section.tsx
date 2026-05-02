"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { showToast } from "@/lib/toast";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TIER1_DIMENSIONS, DIMENSION_LABELS, DIMENSION_HELP } from "@/lib/constants";
import { saveDirectRatings } from "@/server/actions/ratings";
import { track } from "@/lib/analytics";

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
  // A dimension shows a full RatingBar when it's rated OR the user has
  // explicitly expanded it via the chip below. Starts seeded from any
  // dimensions that arrived with a non-zero score. Keeps a rated→unrated
  // transition (if we ever add a clear button) on-screen so the bar
  // doesn't disappear mid-tap.
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        TIER1_DIMENSIONS.filter((d) => (initialRatings[d] ?? 0) > 0),
      ),
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // W18-6: track the last successfully-persisted rating per dimension so we
  // can roll back the on-screen value when a Server Action fails. Without
  // this the UI silently kept the optimistic value while the DB held the
  // old one — the user's next visit would see the rating revert with no
  // warning. Seeded from `initialRatings` (= what the DB returned) and
  // advanced only on a successful save.
  const lastSavedRef = useRef<Record<string, number>>({ ...initialRatings });

  const debouncedSave = useCallback(
    (delta: Record<string, number>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSaving(true);
      setJustSaved(false);
      // Snapshot the pre-save baseline so we can decide added vs
      // edited AFTER the server confirms. Reading `lastSavedRef`
      // directly inside the timeout would reflect any later concurrent
      // save that already advanced the baseline — capturing here
      // pins the analytics decision to the user action that started
      // this debounce window.
      const baselineBeforeSave = { ...lastSavedRef.current };
      timerRef.current = setTimeout(async () => {
        const rollback = () => {
          setRatings((prev) => {
            const reverted = { ...prev };
            for (const dim of Object.keys(delta)) {
              reverted[dim] = lastSavedRef.current[dim] ?? 0;
            }
            return reverted;
          });
        };
        try {
          const result = await saveDirectRatings(venueId, { ratings: delta });
          if (!result.success) {
            setSaving(false);
            rollback();
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
          // Phase 3 wave 1.5 analytics — fire one track event per
          // dimension successfully saved. "added" = the viewer had no
          // previous score on this dimension; "edited" = there was
          // already a score and the viewer changed it. Owner vs
          // partner is NOT a property here — the funnel's whole
          // point is that *anyone* in the couple can rate, so the
          // event itself is role-agnostic. Admin-side segmentation
          // can join on the userId already attached by the analytics
          // helper.
          //
          // Decision pinned against the snapshot taken BEFORE this
          // save started; the post-save advance happens immediately
          // below.
          for (const [dim, score] of Object.entries(delta)) {
            const prevScore = baselineBeforeSave[dim] ?? 0;
            const eventName =
              prevScore > 0 ? "partner_rating_edited" : "partner_rating_added";
            track(eventName, { venueId, dimension: dim, score });
          }
          // Advance the rollback baseline only after the DB confirms.
          lastSavedRef.current = { ...lastSavedRef.current, ...delta };
          setSaving(false);
          setJustSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setJustSaved(false), 1000);
        } catch (err) {
          setSaving(false);
          console.error("[rating] save failed:", err);
          rollback();
          showToast("error", "うまく残せませんでした。もう一度お試しください");
        }
      }, 500);
    },
    [venueId],
  );

  const handleRate = (dimension: string, score: number) => {
    // W18-6 optimistic update: flip the on-screen value immediately. The
    // debounced save below either commits the new value into lastSavedRef
    // (success) or rolls this dimension back to its last successful value
    // (failure / network error), so the UI can never stay out of sync with
    // the DB.
    //
    // Only send the *changed* dimension to the server though:
    // initialRatings comes from VenueScore averages stored as Decimal(2,1),
    // which can land on non-0.5 increments like 3.6 — and the zod schema
    // enforces multipleOf(0.5). Re-sending those legacy averages would fail
    // validation and surface as the generic '保存できませんでした' toast even
    // though the user's own click was a valid 0.5 step.
    const newRatings = { ...ratings, [dimension]: score };
    setRatings(newRatings);
    setExpanded((prev) => {
      if (prev.has(dimension)) return prev;
      const next = new Set(prev);
      next.add(dimension);
      return next;
    });
    debouncedSave({ [dimension]: score });
  };

  const handleExpand = (dimension: string) => {
    setExpanded((prev) => {
      if (prev.has(dimension)) return prev;
      const next = new Set(prev);
      next.add(dimension);
      return next;
    });
  };

  const { visibleDims, hiddenDims } = useMemo(() => {
    const visible: string[] = [];
    const hidden: string[] = [];
    for (const dim of TIER1_DIMENSIONS) {
      const rated = (ratings[dim] ?? 0) > 0;
      if (rated || expanded.has(dim)) {
        visible.push(dim);
      } else {
        hidden.push(dim);
      }
    }
    return { visibleDims: visible, hiddenDims: hidden };
  }, [ratings, expanded]);

  return (
    <section className="relative space-y-4">
      <div>
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          Impression
        </p>
        <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em]">
          印象を残す
        </h2>
      </div>
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

      {visibleDims.length === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          ふたりの印象を少しずつ残せます。気になる項目から、軽く触れるだけで。
        </p>
      )}

      {visibleDims.map((dim) => {
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

      {hiddenDims.length > 0 && (
        <div className="space-y-2 pt-1">
          {visibleDims.length > 0 && (
            <p className="text-eyebrow text-muted-foreground/70">
              残したい項目を足す
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {hiddenDims.map((dim) => (
              <button
                key={dim}
                type="button"
                onClick={() => handleExpand(dim)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs text-foreground transition-all duration-200 hover:border-[var(--gold-warm)]/60 hover:text-[var(--gold-warm)] active:scale-95"
                aria-label={`${DIMENSION_LABELS[dim]}を評価する`}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {DIMENSION_LABELS[dim]}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

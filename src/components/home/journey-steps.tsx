"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type JourneyStepStatus = "completed" | "current" | "upcoming";

export interface JourneyStep {
  label: string;
  icon: LucideIcon;
  count?: number;
  status: JourneyStepStatus;
}

interface JourneyStepsProps {
  steps: JourneyStep[];
  currentStep: number; // 1-indexed
}

const STATUS_STYLES: Record<
  JourneyStepStatus,
  { dot: string; icon: string; label: string; ring: string }
> = {
  completed: {
    dot: "bg-primary/10 border-primary/30",
    icon: "text-primary",
    label: "text-foreground",
    ring: "",
  },
  current: {
    dot: "bg-[var(--gold-subtle)] border-[var(--gold-warm)]",
    icon: "text-[var(--gold-warm)]",
    label: "text-foreground",
    ring:
      "shadow-[0_0_0_4px_color-mix(in_oklch,var(--gold-warm)_18%,transparent)]",
  },
  upcoming: {
    dot: "bg-muted border-border",
    icon: "text-muted-foreground/60",
    label: "text-muted-foreground",
    ring: "",
  },
};

export default function JourneySteps({ steps, currentStep }: JourneyStepsProps) {
  const shouldReduceMotion = useReducedMotion();
  const totalSteps = steps.length;

  // Track which step indices transitioned into `completed` since the last
  // render. Those get a short sunrise-fill celebration (scale pulse +
  // gold halo ring) lasting 600ms.
  //
  // Strategy (lint-safe):
  //   - `prevStatuses` lives in state so we can compare across renders.
  //   - On every render, derive `celebrating` from (prev vs current) —
  //     no setState-in-effect, no ref mutation during render.
  //   - The `prevStatuses` snapshot is updated in an effect that runs
  //     *after* the 600ms celebration window clears, which also naturally
  //     hides the halo.
  const [prevStatuses, setPrevStatuses] = useState<JourneyStepStatus[]>(() =>
    steps.map((s) => s.status),
  );

  const celebrating: Set<number> = (() => {
    if (shouldReduceMotion) return new Set();
    const set = new Set<number>();
    steps.forEach((step, i) => {
      if (step.status === "completed" && prevStatuses[i] !== "completed") {
        set.add(i);
      }
    });
    return set;
  })();

  useEffect(() => {
    if (celebrating.size === 0) return;
    const t = setTimeout(() => {
      setPrevStatuses(steps.map((s) => s.status));
    }, 600);
    return () => clearTimeout(t);
    // `celebrating` is derived from `steps` + `prevStatuses`; depending
    // on `steps` is sufficient to re-evaluate on transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  // Keep `prevStatuses` in sync when no celebration is pending (e.g. the
  // first render after steps change to a non-completing state).
  useEffect(() => {
    if (celebrating.size > 0) return;
    const current = steps.map((s) => s.status);
    const changed =
      current.length !== prevStatuses.length ||
      current.some((s, i) => s !== prevStatuses[i]);
    if (changed) setPrevStatuses(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep}
      aria-label="式場さがしの進捗"
      className="w-full"
    >
      <ol role="list" className="flex items-start justify-between gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const styles = STATUS_STYLES[step.status];
          const isLast = idx === totalSteps - 1;
          const nextCompleted =
            !isLast &&
            (steps[idx + 1].status === "completed" ||
              step.status === "completed");

          return (
            <li
              key={step.label}
              role="listitem"
              aria-current={step.status === "current" ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* Connector line to next step (drawn from this dot's right edge) */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-5 left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] h-px",
                    nextCompleted ? "bg-primary/30" : "bg-border"
                  )}
                />
              )}

              <motion.span
                initial={false}
                animate={(() => {
                  if (shouldReduceMotion) return undefined;
                  if (celebrating.has(idx)) {
                    // Sunrise-fill celebration: scale-up spring + opacity
                    // pulse for 600ms on a freshly-completed step.
                    return { scale: [1, 1.15, 1], opacity: [0.7, 1, 1] };
                  }
                  if (step.status === "current") {
                    return { scale: [1, 1.06, 1] };
                  }
                  return undefined;
                })()}
                transition={
                  celebrating.has(idx)
                    ? { duration: 0.6, type: "spring", stiffness: 180, damping: 14 }
                    : { duration: 0.8, ease: "easeOut" }
                }
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                  styles.dot,
                  styles.ring
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("h-5 w-5", styles.icon)}
                  strokeWidth={1.5}
                />
                {/* Sunrise halo — rendered only during the 600ms celebration
                    window. Expanding gold ring fades out as it grows. */}
                <AnimatePresence>
                  {celebrating.has(idx) && !shouldReduceMotion && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ opacity: 0.6, scale: 0.9 }}
                      animate={{ opacity: 0, scale: 1.8 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full ring-2 ring-[var(--gold-warm)]"
                    />
                  )}
                </AnimatePresence>
              </motion.span>

              <span
                className={cn(
                  "mt-2 text-[11px] tracking-[0.06em]",
                  styles.label
                )}
              >
                {step.label}
              </span>
              {typeof step.count === "number" && step.count > 0 && (
                <span
                  className="mt-0.5 text-[11px] font-light tabular-nums text-muted-foreground"
                  aria-label={`${step.count}件`}
                >
                  {step.count}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Convenience: canonical 4-step set for the home journey.
export const JOURNEY_STEP_ICONS = {
  add: Cloud,
  visit: CloudSun,
  compare: CloudSun,
  decide: Sun,
} as const;

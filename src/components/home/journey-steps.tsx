"use client";

import { Cloud, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
                animate={
                  shouldReduceMotion || step.status !== "current"
                    ? undefined
                    : { scale: [1, 1.06, 1] }
                }
                transition={{ duration: 0.8, ease: "easeOut" }}
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

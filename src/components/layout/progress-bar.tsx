"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "条件設定" },
  { label: "式場探索" },
  { label: "見学" },
  { label: "比較" },
  { label: "絞り込み" },
  { label: "決定" },
] as const;

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={step.label} className="flex items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    isCompleted &&
                      "bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-2 border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border border-border bg-muted text-foreground-muted",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight sm:text-xs",
                    isCurrent
                      ? "font-medium text-primary"
                      : isCompleted
                        ? "text-primary"
                        : "text-foreground-muted",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 w-4 sm:mx-2 sm:w-8",
                    stepNumber < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
} as const;

export function StarRating({
  value,
  onChange,
  size = "md",
  disabled = false,
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex gap-0.5">
      {stars.map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star}点`}
            aria-pressed={filled ? "true" : "false"}
            disabled={disabled}
            onClick={() => onChange?.(star)}
            className={cn(
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              disabled && "cursor-default opacity-50",
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                filled
                  ? "fill-accent text-accent"
                  : "fill-none text-border",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

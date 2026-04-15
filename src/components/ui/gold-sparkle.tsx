import { cn } from "@/lib/utils";

interface GoldSparkleProps {
  className?: string;
  /** Optional aria-label; defaults to purely decorative (aria-hidden). */
  ariaLabel?: string;
}

/**
 * Decorative three-dot constellation in gold-warm.
 * Used sparingly in empty states and hero moments to add a subtle
 * "晴れ時" sparkle without introducing animation noise.
 * 12×12 viewBox; scale via Tailwind width/height classes.
 */
export function GoldSparkle({ className, ariaLabel }: GoldSparkleProps) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };
  return (
    <svg
      {...a11y}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-3 w-3 text-[var(--gold-warm)]", className)}
    >
      {/* Larger center dot */}
      <circle cx="6" cy="6" r="1.2" fill="currentColor" opacity="0.95" />
      {/* Upper-left small dot */}
      <circle cx="2.2" cy="2.8" r="0.7" fill="currentColor" opacity="0.55" />
      {/* Lower-right small dot */}
      <circle cx="9.6" cy="9.2" r="0.7" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

"use client";

import { useCountUp } from "@/hooks/use-count-up";

interface AnimatedPercentageProps {
  value: number;
}

/**
 * AnimatedPercentage — count-up from previously-seen value to `value`
 * on mount. Persists last value in localStorage so returns show the
 * current number instantly; only genuine progress animates.
 */
export function AnimatedPercentage({ value }: AnimatedPercentageProps) {
  const display = useCountUp(value, "haretoki:journey-percentage");
  return <span className="tabular-nums text-foreground">{display}%</span>;
}

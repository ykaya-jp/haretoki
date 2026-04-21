"use client";

import type { ComparisonMatrix } from "@/lib/comparison-types";
import type { DimensionWeights } from "@/lib/weighted-score";
import { ComparisonGrid } from "./comparison-grid";
import { ComparisonMobileSnapper } from "./comparison-mobile-snapper";

/**
 * Responsive wrapper — picks between the desktop CSS-Grid board and the
 * mobile snap carousel via Tailwind's md: breakpoint. Both subcomponents
 * are client components already (scroll sync, expand/collapse), so
 * rendering both trees at once is fine — CSS hides one at each breakpoint.
 *
 * Kept as a thin wrapper so the page.tsx can stay a pure Server Component.
 */
export function ComparisonBoard({
  matrix,
  weights = null,
}: {
  matrix: ComparisonMatrix;
  /** W12-1: viewer's dimension weights (null → legacy unweighted). */
  weights?: DimensionWeights | null;
}) {
  return (
    <>
      <div className="md:hidden">
        <ComparisonMobileSnapper matrix={matrix} weights={weights} />
      </div>
      <div className="hidden md:block">
        <ComparisonGrid matrix={matrix} weights={weights} />
      </div>
    </>
  );
}

"use client";

import type { ComparisonMatrix } from "@/lib/comparison-types";
import type { DimensionWeights } from "@/lib/weighted-score";
import type { MatrixInsight } from "@/server/actions/matrix-insight";
import { ComparisonGrid } from "./comparison-grid";
import { ComparisonMobileSnapper } from "./comparison-mobile-snapper";
import { MatrixInsightCard } from "./matrix-insight-card";

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
  matrixInsight = null,
}: {
  matrix: ComparisonMatrix;
  /** W18-1: couple's averaged dimension weights (owner+partner mean from
   *  `getCoupleWeights().couple`). On solo projects equals the viewer's
   *  weights. `null` → legacy unweighted composite. */
  weights?: DimensionWeights | null;
  /** CMP-5: SSR-fetched AI analysis card. `null` = AI unavailable or
   *  <2 venues — card is hidden. */
  matrixInsight?: MatrixInsight | null;
}) {
  return (
    <div className="space-y-4">
      <div className="md:hidden">
        <ComparisonMobileSnapper matrix={matrix} weights={weights} />
      </div>
      <div className="hidden md:block">
        <ComparisonGrid matrix={matrix} weights={weights} />
      </div>
      {/* CMP-5: AI analysis card — placed after the grid, before Decision section */}
      <MatrixInsightCard insight={matrixInsight} />
    </div>
  );
}

"use client";

import type { ComparisonMatrix } from "@/lib/comparison-types";
import type { DimensionWeights } from "@/lib/weighted-score";
import type { MatrixInsight } from "@/server/actions/matrix-insight";
import type { MatrixReviewInsight } from "@/server/actions/matrix-review-insight";
import { ComparisonGrid } from "./comparison-grid";
import { ComparisonMobileSnapper } from "./comparison-mobile-snapper";
import { MatrixInsightCard } from "./matrix-insight-card";
import { MatrixReviewInsightCard } from "./matrix-review-insight-card";

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
  matrixReviewInsight = null,
}: {
  matrix: ComparisonMatrix;
  /** W18-1: couple's averaged dimension weights (owner+partner mean from
   *  `getCoupleWeights().couple`). On solo projects equals the viewer's
   *  weights. `null` → legacy unweighted composite. */
  weights?: DimensionWeights | null;
  /** CMP-5: SSR-fetched quantitative AI analysis card. `null` = AI
   *  unavailable or <2 venues — card is hidden. */
  matrixInsight?: MatrixInsight | null;
  /** R3: SSR-fetched cross-venue review-aggregation insight. `null`
   *  = AI unavailable, <2 venues, or zero reviews across the
   *  selection — card is hidden. Sibling to `matrixInsight` so the
   *  two cards stack as a 定量 / 定性 pair. */
  matrixReviewInsight?: MatrixReviewInsight | null;
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
      {/* R3: cross-venue review insight — placed beneath the
          quantitative card so couples read 定量 → 定性 in order.
          Self-hides when there are no reviews to aggregate. */}
      <MatrixReviewInsightCard insight={matrixReviewInsight} />
    </div>
  );
}

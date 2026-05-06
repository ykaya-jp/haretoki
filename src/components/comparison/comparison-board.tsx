"use client";

import type { ComparisonMatrix } from "@/lib/comparison-types";
import type { DimensionWeights } from "@/lib/weighted-score";
import type { MatrixInsight } from "@/server/actions/matrix-insight";
import type { MatrixReviewInsight } from "@/server/actions/matrix-review-insight";
import type { VenueDisagreement } from "@/server/actions/disagreement-spotlight";
import type { VenueVisitNotePreview } from "@/server/actions/visit-notes-preview";
import { ComparisonGrid } from "./comparison-grid";
import { ComparisonMobileSnapper } from "./comparison-mobile-snapper";
import { MatrixInsightCard } from "./matrix-insight-card";
import { MatrixReviewInsightCard } from "./matrix-review-insight-card";
import { DisagreementSpotlightCard } from "./disagreement-spotlight-card";
import { VisitNotesPreviewCard } from "./visit-notes-preview-card";
import { PhotoComparisonGrid } from "./photo-comparison-grid";

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
  disagreements = [],
  visitNotePreviews = [],
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
  /** Partner-rating disagreement spotlight — top-K dimensions per
   *  venue where owner / partner deltas exceed 1.0. Empty on solo
   *  projects. Card self-hides when array is empty. */
  disagreements?: VenueDisagreement[];
  /** Cross-venue VisitNote excerpts — most recent note per venue.
   *  Empty before any visits → card self-hides. */
  visitNotePreviews?: VenueVisitNotePreview[];
}) {
  // Map venueId → name so VisitNotesPreviewCard can label rows without
  // re-querying. The matrix is the single source of truth for venue names.
  const venueIdToName: Record<string, string> = Object.fromEntries(
    matrix.venues.map((v) => [v.id, v.name]),
  );

  return (
    <div className="space-y-4">
      <div className="md:hidden">
        <ComparisonMobileSnapper matrix={matrix} weights={weights} />
      </div>
      <div className="hidden md:block">
        <ComparisonGrid matrix={matrix} weights={weights} />
      </div>
      {/* Photo cross-venue grid — visual atmosphere comparison without
          jumping between venue detail pages. Self-hides when no venue
          has photos. Cycle 強化 (写真 lens). */}
      <PhotoComparisonGrid venues={matrix.venues} />
      {/* CMP-5: AI analysis card — placed after the grid, before Decision section */}
      <MatrixInsightCard insight={matrixInsight} />
      {/* R3: cross-venue review insight — placed beneath the
          quantitative card so couples read 定量 → 定性 in order.
          Self-hides when there are no reviews to aggregate. */}
      <MatrixReviewInsightCard insight={matrixReviewInsight} />
      {/* Lived-experience lens — visit notes side by side. Self-hides
          before any visits. Pairs with the 3 lenses above so couples
          read 定量 → 定性 → 体験 → 合意 as a 4-step decision narrative. */}
      <VisitNotesPreviewCard
        previews={visitNotePreviews}
        matrixVenueIdsToNames={venueIdToName}
      />
      {/* Partner disagreement spotlight — focused on agreement. Self-hides
          on solo projects or when no dimension exceeds the 1.0 delta floor. */}
      <DisagreementSpotlightCard disagreements={disagreements} />
    </div>
  );
}

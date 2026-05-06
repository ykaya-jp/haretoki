import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getComparisonMatrix,
  getFavoriteVenueIds,
} from "@/server/actions/checklist";
import { getCoupleWeights } from "@/server/actions/weights";
import { getMatrixInsight } from "@/server/actions/matrix-insight";
import { getMatrixReviewInsight } from "@/server/actions/matrix-review-insight";
import { getMatrixDisagreements } from "@/server/actions/disagreement-spotlight";
import { getMatrixVisitNotes } from "@/server/actions/visit-notes-preview";
import { getEstimateBreakdownComparison } from "@/server/actions/estimate-breakdown-comparison";
import { COMPARE_MAX_VENUES } from "@/lib/comparison-types";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import Link from "next/link";
import { Heart, Info, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "式場横比較",
  description: "選んだ項目で式場を横並びに比較します。",
};

interface ComparePageProps {
  searchParams: Promise<{ venueIds?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;

  // Parse venue ids from query or fall back to favorites. We capture the
  // pre-trim count so the page can show a truthful message when the user
  // asked for 15 but we only show 10.
  let venueIds: string[] = [];
  let requestedCount = 0;
  if (params.venueIds) {
    const all = params.venueIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    requestedCount = all.length;
    venueIds = all.slice(0, COMPARE_MAX_VENUES);
  }

  const trimmed = requestedCount > COMPARE_MAX_VENUES;

  return (
    <div className="space-y-8 pb-24">
      <div className="space-y-3">
        {/* Eyebrow */}
        <p className="flex items-center gap-1.5 text-eyebrow text-muted-foreground uppercase">
          <span className="text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="text-muted-foreground/40">·</span>
          <span>Compare</span>
        </p>

        {/* gold hairline */}
        <div
          aria-hidden="true"
          className="h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] via-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] to-transparent"
        />

        {/* h1: editorial 2-line 明朝 */}
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(24px,6vw,32px)] font-light leading-[1.2] tracking-[-0.01em]">
            Compare
          </h1>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-[clamp(14px,3.5vw,17px)] font-light leading-relaxed tracking-[0.01em] text-muted-foreground">
            ふたつを、同じ目線で。
          </p>
        </div>

        {/* Trim notice — "比較は 10 件までが一度に見やすいです" (static, no data) */}
        {trimmed && (
          <div className="flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--gold-warm)_25%,transparent)] bg-[color-mix(in_oklab,var(--gold-warm)_5%,var(--background))] px-3 py-2.5 text-[12.5px] text-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold-warm)]" strokeWidth={2} />
            <p className="leading-snug">
              比較は {COMPARE_MAX_VENUES} 件までが一度に見やすいです。
              <br className="sm:hidden" />
              上位 {COMPARE_MAX_VENUES} 件を表示しています。
            </p>
          </div>
        )}
      </div>

      {/* Matrix + ledger copy — gated behind Suspense so page chrome paints
          without waiting on getComparisonMatrix. Fallback mirrors the final
          board layout so there's no jump when the matrix arrives (R4). */}
      <Suspense fallback={<CompareBoardSkeleton />}>
        <CompareMatrix venueIds={venueIds} />
      </Suspense>
    </div>
  );
}

async function CompareMatrix({ venueIds }: { venueIds: string[] }) {
  const ids = venueIds.length > 0 ? venueIds : await getFavoriteVenueIds();
  // W18-1: hoist the couple's averaged weights (owner+partner per-dimension
  // mean) in parallel with the matrix so each column ★ reflects both
  // partners' priorities, not only the viewer's. `.catch(null)` keeps the
  // page usable on the first visit when the weights row is absent and on
  // solo projects (getCoupleWeights returns couple=mine in that case).
  //
  // R3: matrixReviewInsight runs in parallel too — it fetches its own
  // per-venue review aggregates and Claude call (cached 3d), so the
  // page's blocking wait is bounded by the slowest of the four.
  // `.catch(null)` keeps the page rendering when reviews are absent,
  // Claude is unavailable, or the call times out.
  const [
    matrix,
    coupleWeights,
    matrixInsight,
    matrixReviewInsight,
    disagreements,
    visitNotePreviews,
    estimateBreakdown,
  ] = await Promise.all([
    getComparisonMatrix(ids),
    getCoupleWeights().catch(() => null),
    getMatrixInsight().catch(() => null),
    getMatrixReviewInsight(ids).catch(() => null),
    getMatrixDisagreements(ids).catch(() => []),
    getMatrixVisitNotes(ids).catch(() => []),
    getEstimateBreakdownComparison(ids).catch(() => ({
      venueIds: [],
      groups: [],
      grandTotalByVenueId: {},
    })),
  ]);
  const insufficient = matrix.venues.length === 1;

  return (
    <div className="space-y-8">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {matrix.venues.length > 0
          ? `${matrix.venues.length} 件の式場を、同じ観点で並べています`
          : "候補を並べると、ここに横比較が現れます。"}
      </p>

      {matrix.venues.length === 0 ? (
        <CompareEmptyState
          icon={Heart}
          title="並べる式場が、まだありません"
          description="候補に 2 件そろうと、同じ観点で横に並べて見られます。"
          ctaLabel="式場を探す"
          ctaHref="/explore"
        />
      ) : insufficient ? (
        <CompareEmptyState
          icon={Scale}
          title="もう 1 件、並べてみませんか"
          description="比較にはふたつ以上の式場が要ります。候補から 1 件そえてみてください。"
          ctaLabel="候補を開く"
          ctaHref="/candidates"
        />
      ) : (
        <ComparisonBoard
            matrix={matrix}
            weights={coupleWeights?.couple ?? null}
            matrixInsight={matrixInsight}
            matrixReviewInsight={matrixReviewInsight}
            disagreements={disagreements}
            visitNotePreviews={visitNotePreviews}
            estimateBreakdown={estimateBreakdown}
          />
      )}
    </div>
  );
}

/** CMP-4 empty state: editorial card, icon in a gold halo circle, Noto
 *  Serif JP headline, quiet description, pill CTA. Replaces the previous
 *  border-dashed "error-like" treatment with the 晴れ時 tone. */
function CompareEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/40 bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "var(--gold-subtle)" }}
      >
        <Icon className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} />
      </div>
      <div className="space-y-1.5 max-w-[320px]">
        <h3 className="font-[family-name:var(--font-display)] text-[17px] font-light leading-snug tracking-[0.01em]">
          {title}
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Link
        href={ctaHref}
        prefetch={true}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

/** Inline skeleton mirroring ComparisonBoard's header + 6 rows × 3 cols grid.
 *  Matches loading.tsx but lives here so the outer chrome is already visible
 *  while this boundary resolves. */
function CompareBoardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-4 w-64 animate-pulse rounded bg-muted/60" />
      <div className="overflow-x-auto">
        <div className="flex gap-3 pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 w-32 flex-shrink-0 animate-pulse rounded-lg bg-muted/60"
            />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-3 border-b py-3">
            <div className="h-4 w-40 flex-shrink-0 animate-pulse rounded bg-muted/60" />
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-8 w-32 flex-shrink-0 animate-pulse rounded bg-muted/60"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

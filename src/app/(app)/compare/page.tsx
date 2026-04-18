import type { Metadata } from "next";
import {
  getComparisonMatrix,
  getFavoriteVenueIds,
} from "@/server/actions/checklist";
import { COMPARE_MAX_VENUES } from "@/lib/comparison-types";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import Link from "next/link";
import { Info } from "lucide-react";

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

  if (venueIds.length === 0) {
    venueIds = await getFavoriteVenueIds();
  }

  const matrix = await getComparisonMatrix(venueIds);
  const trimmed = requestedCount > COMPARE_MAX_VENUES;
  const insufficient = matrix.venues.length === 1;

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

        {/* Ledger copy */}
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {matrix.venues.length > 0
            ? `${matrix.venues.length} 件の式場を、同じ観点で並べています`
            : "候補を並べると、ここに横比較が現れます。"}
        </p>

        {/* Trim notice — "比較は 10 件までが一度に見やすいです" */}
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

      {matrix.venues.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">比較する式場がありません</p>
          <Link
            href="/explore"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
          >
            式場を探す
          </Link>
        </div>
      ) : insufficient ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            比較には 2 件以上の式場が必要です
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground/70">
            候補から追加で選んでみてください。
          </p>
          <Link
            href="/candidates"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
          >
            候補を開く
          </Link>
        </div>
      ) : (
        <ComparisonBoard matrix={matrix} />
      )}
    </div>
  );
}

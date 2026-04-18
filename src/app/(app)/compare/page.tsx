import type { Metadata } from "next";
import { getComparisonMatrix, getFavoriteVenueIds } from "@/server/actions/checklist";
import { ComparisonMatrixView } from "@/components/checklist/comparison-matrix-view";
import Link from "next/link";

export const metadata: Metadata = {
  title: "式場横比較",
  description: "選んだ項目で式場を横並びに比較します。",
};

interface ComparePageProps {
  searchParams: Promise<{ venueIds?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;

  // Parse venue ids from query or fall back to favorites
  let venueIds: string[] = [];
  if (params.venueIds) {
    venueIds = params.venueIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  if (venueIds.length === 0) {
    venueIds = await getFavoriteVenueIds();
  }

  const matrix = await getComparisonMatrix(venueIds);

  return (
    <div className="space-y-10 pb-24">
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
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(24px,6vw,32px)] font-extralight leading-[1.2] tracking-[-0.01em]">
            Compare
          </h1>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-[clamp(14px,3.5vw,17px)] font-extralight leading-relaxed tracking-[0.01em] text-muted-foreground">
            ふたつを、同じ目線で。
          </p>
        </div>

        {/* Ledger copy */}
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {matrix.venues.length > 0
            ? `${matrix.venues.length} 件の式場を、同じ観点で並べています`
            : "候補を並べると、ここに横比較が現れます。"}
        </p>
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
      ) : matrix.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">チェック項目が選ばれていません</p>
          <Link
            href="/checklist"
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
          >
            項目を選ぶ
          </Link>
        </div>
      ) : (
        <ComparisonMatrixView matrix={matrix} />
      )}
    </div>
  );
}

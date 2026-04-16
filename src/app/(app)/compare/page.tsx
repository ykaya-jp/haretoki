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
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Compare</span>
        </p>
        <h1 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-extralight tracking-[-0.01em]">
          式場横比較
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {matrix.venues.length > 0
            ? `${matrix.venues.length} 件の式場を、同じ目線で並べてみましょう。`
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

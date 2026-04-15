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
    <div className="pb-24">
      <div className="mb-4 space-y-1">
        <h2 className="text-h1 font-serif font-extralight">式場横比較</h2>
        <p className="text-sm text-muted-foreground">
          {matrix.venues.length > 0
            ? `${matrix.venues.length}件の式場を比較中`
            : "候補に式場を追加すると比較できます"}
        </p>
      </div>

      {matrix.venues.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">比較する式場がありません</p>
          <Link
            href="/explore"
            className="mt-3 inline-block min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground active:scale-[0.98]"
          >
            式場を探す
          </Link>
        </div>
      ) : matrix.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">チェック項目が選ばれていません</p>
          <Link
            href="/checklist"
            className="mt-3 inline-block min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground active:scale-[0.98]"
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

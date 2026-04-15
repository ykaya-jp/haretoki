import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueHeader } from "@/server/actions/venues";
import { listActiveItems, getAnswersForVenue } from "@/server/actions/checklist";
import { CHECKLIST_PRESETS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";
import { VenueChecklistInputView } from "@/components/checklist/venue-checklist-input-view";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "式場チェックリスト",
};

export default async function VenueChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [venue, { activeItemIds }, answers] = await Promise.all([
    getVenueHeader(id),
    listActiveItems(),
    getAnswersForVenue(id),
  ]);

  if (!venue) notFound();

  // Build ordered active items grouped by category
  const activeSet = new Set(activeItemIds);
  const grouped = CATEGORY_ORDER.map((cat) => {
    const items = CHECKLIST_PRESETS.filter(
      (p) => p.category === cat && activeSet.has(p.id)
    );
    const subcategoryMap = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.subcategory ?? "その他";
      if (!subcategoryMap.has(key)) subcategoryMap.set(key, []);
      subcategoryMap.get(key)!.push(item);
    }
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      subcategories: Array.from(subcategoryMap.entries()).map(([sub, subItems]) => ({
        subcategory: sub,
        items: subItems,
      })),
    };
  }).filter((g) => g.subcategories.some((s) => s.items.length > 0));

  return (
    <div className="space-y-4 pb-24">
      {/* Back link */}
      <Link
        href={`/venues/${id}`}
        className="flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground active:opacity-70"
      >
        <ChevronLeft className="h-4 w-4" />
        {venue.name} に戻る
      </Link>

      {/* Venue header */}
      <div>
        <h2 className="font-serif text-xl font-extralight">{venue.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">チェックリスト</p>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            チェック項目が選ばれていません。
          </p>
          <Link
            href="/checklist"
            className="mt-3 inline-block min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground active:scale-[0.98]"
          >
            項目を選ぶ
          </Link>
        </div>
      ) : (
        <VenueChecklistInputView venueId={id} grouped={grouped} initialAnswers={answers} />
      )}
    </div>
  );
}

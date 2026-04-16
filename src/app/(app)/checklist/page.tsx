import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listActiveItems } from "@/server/actions/checklist";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { CHECKLIST_PRESETS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";
import { ChecklistSelectionView } from "@/components/checklist/checklist-selection-view";
import { ChecklistStarterCTA } from "@/components/checklist/starter-cta";
import { ReflectionHint } from "@/components/checklist/reflection-hint";

export const metadata: Metadata = {
  title: "チェックリスト設定",
  description: "式場見学で確認する項目を選んでください。選んだ項目が比較ビューに表示されます。",
};

export default async function ChecklistPage() {
  const { activeItemIds, projectId } = await listActiveItems();
  const activeSet = new Set(activeItemIds);

  // Count this project's venues so we can tell the couple where their
  // checklist choices will actually appear (F-20 反映先不明 fix).
  const user = await requireUser();
  await requireProjectMembership(user.id);
  const venueCount = await prisma.venue.count({ where: { projectId } });

  // Group presets by category × subcategory
  const grouped = CATEGORY_ORDER.map((cat) => {
    const items = CHECKLIST_PRESETS.filter((p) => p.category === cat);
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
      activeCount: items.filter((p) => activeSet.has(p.id)).length,
      totalCount: items.length,
    };
  });

  const totalActive = activeItemIds.length;
  const isEmpty = totalActive === 0;

  return (
    <div className="space-y-10 pb-24">
      {/* Compact header */}
      <div className="flex items-start gap-2">
        <Link
          href="/candidates"
          prefetch={true}
          aria-label="候補に戻る"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            何を比べるか、決める
          </p>
          <h1 className="mt-0.5 font-[family-name:var(--font-display)] text-[22px] font-extralight tracking-[0.01em]">
            チェックリスト設定
          </h1>
        </div>
        {!isEmpty && (
          <span
            aria-live="polite"
            className="shrink-0 rounded-full border border-[color:var(--gold-warm)]/30 bg-[color:var(--gold-subtle)] px-3 py-1.5 text-xs font-medium tabular-nums text-[color:var(--gold-warm)]"
          >
            {totalActive}件
          </span>
        )}
      </div>

      {isEmpty ? (
        <ChecklistStarterCTA />
      ) : (
        <ReflectionHint activeCount={totalActive} venueCount={venueCount} />
      )}

      <div id="categories" className="scroll-mt-4">
        <ChecklistSelectionView grouped={grouped} activeItemIds={activeItemIds} />
      </div>

      <div className="pt-6 text-center">
        <Link
          href="/candidates"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
        >
          候補に戻る
        </Link>
      </div>
    </div>
  );
}

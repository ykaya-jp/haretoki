import type { Metadata } from "next";
import { listActiveItems } from "@/server/actions/checklist";
import { CHECKLIST_PRESETS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";
import { ChecklistSelectionView } from "@/components/checklist/checklist-selection-view";

export const metadata: Metadata = {
  title: "チェックリスト設定",
  description: "式場見学で確認する項目を選んでください。選んだ項目が比較ビューに表示されます。",
};

export default async function ChecklistPage() {
  const { activeItemIds } = await listActiveItems();
  const activeSet = new Set(activeItemIds);

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

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="text-h1 font-serif font-extralight">チェックリスト設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          このプロジェクトで使う項目を選んでください。選んだ項目だけが式場別入力と比較ビューに出ます。
        </p>
      </div>

      <ChecklistSelectionView grouped={grouped} activeItemIds={activeItemIds} />
    </div>
  );
}

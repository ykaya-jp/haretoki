"use client";

import { formatYen, formatYenFull } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  attire: "衣裳",
  cuisine: "料理",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・映像設備",
  venue_fee: "会場費",
  other: "その他",
};

const TIER_LABELS: Record<string, string> = {
  minimum: "ミニマム",
  standard: "スタンダード",
  premium: "プレミアム",
  unknown: "",
};

const TIER_COLORS: Record<string, string> = {
  minimum: "bg-[color-mix(in_oklab,var(--primary)_10%,var(--background))] text-[color-mix(in_oklab,var(--primary)_80%,var(--foreground))]",
  standard:
    "bg-[color-mix(in_oklab,var(--success,#22c55e)_12%,var(--background))] text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]",
  premium:
    "bg-tint-gold text-tone-gold dark:bg-tint-gold dark:text-tone-gold",
};

type EstimateItem = {
  id: string;
  category: string;
  itemName: string;
  amount: number;
  tier?: string;
  predictedUpgrade?: number | null;
};

type CategoryGroup = {
  category: string;
  label: string;
  items: EstimateItem[];
  subtotal: number;
};

function groupByCategory(items: EstimateItem[]): CategoryGroup[] {
  const groups = new Map<string, EstimateItem[]>();

  for (const item of items) {
    const existing = groups.get(item.category) ?? [];
    existing.push(item);
    groups.set(item.category, existing);
  }

  // Order by the CATEGORY_LABELS key order
  const categoryOrder = Object.keys(CATEGORY_LABELS);

  return Array.from(groups.entries())
    .sort(
      ([a], [b]) =>
        (categoryOrder.indexOf(a) === -1 ? 999 : categoryOrder.indexOf(a)) -
        (categoryOrder.indexOf(b) === -1 ? 999 : categoryOrder.indexOf(b))
    )
    .map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items,
      subtotal: items.reduce((sum, item) => sum + item.amount, 0),
    }));
}

export function EstimateBreakdown({ items }: { items: EstimateItem[] }) {
  if (items.length === 0) return null;

  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.category} className="space-y-1">
          {/* Category header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              {group.label}
            </h4>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {formatYen(group.subtotal)}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-0.5 pl-3 border-l-2 border-border/50">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-0.5"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-sm text-muted-foreground truncate">
                    {item.itemName}
                  </span>
                  {item.tier &&
                    item.tier !== "unknown" &&
                    TIER_LABELS[item.tier] && (
                      <span
                        className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          TIER_COLORS[item.tier] ?? ""
                        }`}
                      >
                        {TIER_LABELS[item.tier]}
                      </span>
                    )}
                </div>
                <span className="text-sm tabular-nums text-muted-foreground shrink-0 ml-2">
                  {formatYenFull(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

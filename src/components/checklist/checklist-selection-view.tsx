"use client";

import { useOptimistic, useTransition, useState } from "react";
import { toggleItem, bulkToggleDimension } from "@/server/actions/checklist";
import type { ChecklistPresetItem } from "@/lib/checklist-presets";

interface GroupedDimension {
  dimension: string;
  label: string;
  subcategories: Array<{
    subcategory: string;
    items: ChecklistPresetItem[];
  }>;
  activeCount: number;
  totalCount: number;
}

interface ChecklistSelectionViewProps {
  grouped: GroupedDimension[];
  activeItemIds: string[];
}

export function ChecklistSelectionView({ grouped, activeItemIds }: ChecklistSelectionViewProps) {
  const [optimisticActive, setOptimisticActive] = useOptimistic(
    new Set(activeItemIds),
    (current: Set<string>, action: { itemId: string; active: boolean }) => {
      const next = new Set(current);
      if (action.active) {
        next.add(action.itemId);
      } else {
        next.delete(action.itemId);
      }
      return next;
    }
  );
  const [, startTransition] = useTransition();
  // Track which dimensions are open
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(grouped.map((g) => g.dimension))
  );

  function handleToggle(itemId: string, active: boolean) {
    startTransition(async () => {
      setOptimisticActive({ itemId, active });
      await toggleItem(itemId, active);
    });
  }

  function handleBulkToggle(dimension: string, active: boolean) {
    startTransition(async () => {
      const items =
        grouped
          .find((g) => g.dimension === dimension)
          ?.subcategories.flatMap((s) => s.items) ?? [];
      for (const item of items) {
        setOptimisticActive({ itemId: item.id, active });
      }
      await bulkToggleDimension(dimension, active);
    });
  }

  function toggleOpen(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {grouped.map((group) => {
        const allItems = group.subcategories.flatMap((s) => s.items);
        const catActive = allItems.filter((item) => optimisticActive.has(item.id)).length;
        const catTotal = allItems.length;
        const allSelected = catActive === catTotal;
        const isOpen = openCategories.has(group.dimension);

        return (
          <div key={group.dimension} className="rounded-lg border bg-card shadow-sm">
            {/* Dimension header */}
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                className="flex flex-1 items-center gap-2 text-left active:opacity-70"
                onClick={() => toggleOpen(group.dimension)}
              >
                <span className="font-medium">{group.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {catActive}/{catTotal}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>
              <button
                className="min-h-11 rounded-full border border-border px-4 text-[11px] tracking-[0.1em] text-muted-foreground active:scale-[0.98] active:bg-muted"
                onClick={() => handleBulkToggle(group.dimension, !allSelected)}
              >
                {allSelected ? "すべて外す" : "すべて選ぶ"}
              </button>
            </div>

            {/* Items */}
            {isOpen && (
              <div className="border-t px-4 pb-3">
                {group.subcategories.map((sub) => (
                  <div key={sub.subcategory} className="mb-3 mt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {sub.subcategory}
                    </p>
                    <div className="divide-y divide-border">
                      {sub.items.map((item) => {
                        const isActive = optimisticActive.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className="flex min-h-[44px] items-center justify-between gap-3 py-2"
                          >
                            <span className="flex-1 text-sm leading-snug">{item.question}</span>
                            {/* Toggle switch using checkbox */}
                            <button
                              role="switch"
                              aria-checked={isActive}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-colors duration-200 focus:outline-none ${
                                isActive ? "bg-[var(--gold-warm)]" : "bg-muted"
                              }`}
                              onClick={() => handleToggle(item.id, !isActive)}
                              aria-label={item.question}
                            >
                              <span
                                className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-[var(--shadow-card)] ring-0 transition duration-200 ease-in-out ${
                                  isActive ? "translate-x-[26px]" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

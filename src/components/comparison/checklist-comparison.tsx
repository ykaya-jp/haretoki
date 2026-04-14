"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getChecklistComparison,
  type ChecklistComparisonData,
} from "@/server/actions/checklist-comparison";
import { Check, X, Minus, Loader2, ChevronDown, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChecklistComparisonProps {
  venueIds: string[];
  venueNames: string[];
}

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

// Fixed column widths so header and rows align perfectly on 375px.
const LABEL_COL_W = "w-[132px]";
const VENUE_COL_W = "w-[72px]";

function StatusIcon({ status }: { status: string }) {
  if (status === "yes") return <Check className="h-4 w-4 text-green-600" aria-label="◯" />;
  if (status === "no") return <X className="h-4 w-4 text-destructive" aria-label="×" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" aria-label="未確認" />;
}

export function ChecklistComparison({ venueIds, venueNames }: ChecklistComparisonProps) {
  const [data, setData] = useState<ChecklistComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [diffOnly, setDiffOnly] = useState(false);
  const [openMemoKey, setOpenMemoKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChecklistComparison(venueIds)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [venueIds]);

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    if (!diffOnly) return data.categories;
    return data.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((i) => i.difference),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [data, diffOnly]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        見学チェックリストのデータがまだありません
      </p>
    );
  }

  // Prefer server-provided names; fall back to prop order if server returned empty.
  const names =
    data.venueNames && data.venueNames.length === venueIds.length
      ? data.venueNames.map((n, i) => n || venueNames[i] || "")
      : venueNames;

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">見学チェックリストの比較</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none min-h-[44px]">
          <input
            type="checkbox"
            checked={diffOnly}
            onChange={(e) => setDiffOnly(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          差分のみ表示
        </label>
      </div>

      {/* Horizontal scroller wraps header + rows so they stay aligned */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-max space-y-3">
          {/* Sticky-ish venue name header */}
          <div className="flex items-end gap-2 pb-1 border-b border-border">
            <div className={cn(LABEL_COL_W, "shrink-0")} />
            {names.map((name, i) => (
              <div
                key={venueIds[i]}
                className={cn(
                  VENUE_COL_W,
                  "shrink-0 text-center text-[11px] font-medium text-muted-foreground truncate leading-tight",
                )}
                title={name}
              >
                {name}
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && diffOnly && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              差分のある項目はありません
            </p>
          )}

          {filteredCategories.map((cat) => {
            const isExpanded = expandedCats.has(cat.category);
            return (
              <div
                key={cat.category}
                className="rounded-xl border border-border overflow-hidden bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggleCat(cat.category)}
                  className="flex w-full min-h-[48px] items-center justify-between bg-muted/30 px-4 py-3 text-left transition-colors duration-200 active:bg-muted"
                >
                  <span className="text-sm font-medium">
                    {cat.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({cat.items.length})
                    </span>
                  </span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: LUXURY_EASE }}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.7, ease: LUXURY_EASE }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border">
                        {cat.items.map((item) => {
                          const rowKey = `${cat.category}:${item.item}`;
                          const anyMemo = item.venues.some((v) => v.memo);
                          const isMemoOpen = openMemoKey === rowKey;
                          return (
                            <div key={item.item}>
                              <button
                                type="button"
                                onClick={() =>
                                  anyMemo
                                    ? setOpenMemoKey(isMemoOpen ? null : rowKey)
                                    : undefined
                                }
                                disabled={!anyMemo}
                                className={cn(
                                  "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors",
                                  anyMemo && "active:bg-muted",
                                  item.difference && "bg-[var(--gold-subtle)]/40",
                                )}
                              >
                                <span
                                  className={cn(
                                    LABEL_COL_W,
                                    "shrink-0 text-xs leading-snug text-foreground/80",
                                  )}
                                >
                                  {item.item}
                                </span>
                                {item.venues.map((v) => (
                                  <div
                                    key={v.venueId}
                                    className={cn(
                                      VENUE_COL_W,
                                      "shrink-0 flex items-center justify-center gap-0.5 rounded py-1",
                                      v.status === "yes" && "bg-green-50",
                                      v.status === "no" && "bg-destructive/10",
                                    )}
                                    title={v.memo ?? undefined}
                                  >
                                    <StatusIcon status={v.status} />
                                    {v.hasPhotos && (
                                      <Camera
                                        className="h-3 w-3 text-muted-foreground/60"
                                        aria-label="写真あり"
                                      />
                                    )}
                                  </div>
                                ))}
                              </button>
                              <AnimatePresence initial={false}>
                                {isMemoOpen && anyMemo && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.5, ease: LUXURY_EASE }}
                                    className="overflow-hidden bg-muted/30"
                                  >
                                    <div className="flex gap-2 px-4 py-2">
                                      <div className={cn(LABEL_COL_W, "shrink-0")} />
                                      {item.venues.map((v) => (
                                        <div
                                          key={v.venueId}
                                          className={cn(
                                            VENUE_COL_W,
                                            "shrink-0 text-[10px] leading-tight text-muted-foreground break-words",
                                          )}
                                        >
                                          {v.memo ?? "—"}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

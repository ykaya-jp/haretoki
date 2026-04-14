"use client";

import { useState, useEffect } from "react";
import { getChecklistComparison, type ChecklistComparisonData } from "@/server/actions/checklist-comparison";
import { Check, X, Minus, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChecklistComparisonProps {
  venueIds: string[];
  venueNames: string[];
}

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

function StatusIcon({ status }: { status: string }) {
  if (status === "yes") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "no") return <X className="h-4 w-4 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

export function ChecklistComparison({ venueIds, venueNames }: ChecklistComparisonProps) {
  const [data, setData] = useState<ChecklistComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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
    return () => { cancelled = true; };
  }, [venueIds]);

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

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">見学チェックリストの比較</h3>

      {/* Venue name headers (sticky) */}
      <div className="flex gap-2 overflow-x-auto">
        <div className="min-w-[140px] shrink-0" />
        {venueNames.map((name, i) => (
          <div
            key={venueIds[i]}
            className="min-w-[80px] flex-1 text-center text-xs font-medium text-muted-foreground truncate"
          >
            {name}
          </div>
        ))}
      </div>

      {data.categories.map((cat) => {
        const isExpanded = expandedCats.has(cat.category);
        return (
          <div key={cat.category} className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCat(cat.category)}
              className="flex w-full min-h-[48px] items-center justify-between bg-muted/30 px-4 py-3 text-left transition-colors duration-200 active:bg-muted"
            >
              <span className="text-sm font-medium">{cat.label}</span>
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
                    {cat.items.map((item) => (
                      <div key={item.item} className="flex items-center gap-2 px-4 py-2">
                        <span className="min-w-[140px] shrink-0 text-xs leading-snug text-foreground/80">
                          {item.item}
                        </span>
                        {item.venues.map((v) => (
                          <div
                            key={v.venueId}
                            className={cn(
                              "min-w-[80px] flex-1 flex items-center justify-center",
                              v.status === "yes" && "bg-green-50",
                              v.status === "no" && "bg-destructive/10",
                            )}
                            title={v.memo ?? undefined}
                          >
                            <StatusIcon status={v.status} />
                          </div>
                        ))}
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
  );
}

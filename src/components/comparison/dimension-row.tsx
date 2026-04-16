"use client";

import { useState } from "react";
import { ChevronRight, Check, X, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DimensionWithChecklist } from "@/server/actions/unified-comparison";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface DimensionRowProps {
  dimension: DimensionWithChecklist;
  venueIds: string[];
  diffOnly: boolean;
  defaultExpanded?: boolean;
  isWinner?: boolean;
}

function StarScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground/40 tabular-nums">—</span>;
  }
  const filled = Math.round(score);
  return (
    <span className="inline-flex gap-[1px]" aria-label={`${score}点`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? "text-[var(--gold-warm)] text-[11px] leading-none"
              : "text-border text-[11px] leading-none"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === null) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  if (status === "yes") {
    return <Check className="h-3.5 w-3.5 text-[var(--success)]" strokeWidth={2.5} />;
  }
  if (status === "no") {
    return <X className="h-3.5 w-3.5 text-[var(--destructive)]" strokeWidth={2.5} />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2} />;
}

export function DimensionRow({
  dimension,
  venueIds,
  diffOnly,
  defaultExpanded = false,
  isWinner = false,
}: DimensionRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasItems = dimension.checklistItems.length > 0;
  const canExpand = hasItems;

  const visibleItems = diffOnly
    ? dimension.checklistItems.filter((item) => item.hasDifference)
    : dimension.checklistItems;

  const colCount = venueIds.length;
  const gridTemplate = `100px repeat(${colCount}, 1fr)`;

  return (
    <div
      className={
        isWinner
          ? "bg-[rgba(201,168,76,0.04)] border-b border-border/50 last:border-b-0"
          : "border-b border-border/50 last:border-b-0"
      }
    >
      {/* Header row */}
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => canExpand && setExpanded((v) => !v)}
        className={[
          "w-full min-h-11 py-2 px-3 text-left",
          "transition-[background-color,transform] duration-200",
          canExpand
            ? "cursor-pointer active:scale-[0.99] active:bg-muted/50"
            : "cursor-default",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {/* Label + item count + chevron */}
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] font-medium text-foreground/80 truncate leading-tight">
              {dimension.label}
            </span>
            {hasItems && (
              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                {dimension.answeredItems}/{dimension.totalItems}
              </span>
            )}
            {canExpand && (
              <motion.span
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={{ duration: 0.2, ease: LUXURY_EASE }}
                className="shrink-0 text-muted-foreground/50 inline-flex"
              >
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
              </motion.span>
            )}
          </div>

          {/* Score cells */}
          {venueIds.map((venueId) => {
            const score = dimension.scores[venueId] ?? null;
            const isVenueWinner = dimension.winnerId === venueId;
            return (
              <div
                key={venueId}
                className={[
                  "flex items-center justify-center",
                  isVenueWinner ? "text-[var(--gold-warm)]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <StarScore score={score} />
              </div>
            );
          })}
        </div>
      </button>

      {/* Expanded checklist */}
      <AnimatePresence initial={false}>
        {expanded && canExpand && (
          <motion.div
            key="checklist"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: LUXURY_EASE }}
            className="overflow-hidden"
          >
            <div className="ml-4 border-l-2 border-[rgba(201,168,76,0.2)] pb-2">
              {visibleItems.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground/60">
                  差分のある項目はありません
                </p>
              ) : (
                visibleItems.map((item) => (
                  <div
                    key={item.itemId}
                    className="px-3 py-1.5"
                  >
                    <div
                      className="grid items-start gap-2"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      {/* Question text */}
                      <p className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                        {item.question}
                      </p>
                      {/* Status per venue */}
                      {venueIds.map((venueId) => {
                        const answer = item.answers[venueId];
                        const status = answer?.status ?? null;
                        return (
                          <div
                            key={venueId}
                            className="flex items-center justify-center"
                          >
                            <StatusIcon status={status} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

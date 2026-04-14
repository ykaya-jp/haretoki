"use client";

import { useState } from "react";
import Image from "next/image";
import type { ComparisonMatrix } from "@/server/actions/checklist";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";

const COL_MIN_W = 120; // px per venue column

interface ComparisonMatrixViewProps {
  matrix: ComparisonMatrix;
}

/** Determine if answers in a row differ (for diff highlight) */
function hasDiff(
  itemId: string,
  venueIds: string[],
  answers: ComparisonMatrix["answers"]
): boolean {
  const statuses = venueIds.map((vid) => answers[itemId]?.[vid]?.status ?? null);
  const nonNull = statuses.filter((s) => s !== null);
  if (nonNull.length < 2) return false;
  return new Set(nonNull).size > 1;
}

function YesNoCell({ status }: { status: string | null }) {
  if (status === "yes") return <span className="text-xl text-emerald-600">○</span>;
  if (status === "no") return <span className="text-xl text-rose-500">×</span>;
  return <span className="text-lg text-muted-foreground">—</span>;
}

function MemoCell({ memo }: { memo: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!memo) return <span className="text-xs text-muted-foreground">—</span>;
  const short = memo.length > 40 && !expanded;
  return (
    <button
      className="text-left text-xs leading-snug active:opacity-70"
      onClick={() => setExpanded((v) => !v)}
    >
      {short ? `${memo.slice(0, 40)}…` : memo}
    </button>
  );
}

function PhotoCell({ photoUrls }: { photoUrls: string[] }) {
  if (photoUrls.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex gap-1">
      {photoUrls.slice(0, 3).map((url, i) => (
        <Image key={i} src={url} alt="" width={48} height={48} className="h-12 w-12 rounded object-cover" />
      ))}
    </div>
  );
}

function NumberCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="tabular-nums text-sm">{value.toLocaleString("ja-JP")}</span>;
}

export function ComparisonMatrixView({ matrix }: ComparisonMatrixViewProps) {
  const { venues, items, answers } = matrix;
  const venueIds = venues.map((v) => v.id);

  // Group items by category in display order
  const groupedItems = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: items.filter((item) => item.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div style={{ minWidth: `${160 + venues.length * COL_MIN_W}px` }}>
        {/* Sticky header row */}
        <div className="sticky top-0 z-20 flex bg-background border-b">
          {/* Row header placeholder */}
          <div className="w-40 flex-shrink-0 border-r bg-background px-2 py-2" />
          {venues.map((venue) => {
            const overallScore = venue.scores.find(
              (s) => s.source === "user_rating" && s.dimension === "atmosphere"
            )?.score;
            return (
              <div
                key={venue.id}
                style={{ minWidth: COL_MIN_W }}
                className="flex flex-1 flex-col items-center gap-1 border-r bg-background px-2 py-2"
              >
                {venue.photoUrls[0] ? (
                  <Image
                    src={venue.photoUrls[0]}
                    alt={venue.name}
                    width={64}
                    height={48}
                    className="h-12 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-16 rounded bg-muted" />
                )}
                <p className="line-clamp-2 text-center font-serif text-xs font-extralight">
                  {venue.name}
                </p>
                {overallScore !== undefined && (
                  <p className="tabular-nums text-xs text-amber-500">
                    ★ {overallScore.toFixed(1)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Matrix rows */}
        {groupedItems.map((group) => (
          <div key={group.category}>
            {/* Category header */}
            <div className="sticky left-0 flex bg-muted/50 border-b border-t">
              <div className="w-40 flex-shrink-0 px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
              </div>
              <div className="flex-1" />
            </div>

            {/* Item rows */}
            {group.items.map((item) => {
              const diff = hasDiff(item.id, venueIds, answers);
              return (
                <div
                  key={item.id}
                  className={`flex min-h-[56px] border-b ${diff ? "bg-amber-50/40" : ""}`}
                >
                  {/* Sticky row header */}
                  <div
                    className={`sticky left-0 z-10 flex w-40 flex-shrink-0 items-start border-r px-2 py-2 ${
                      diff ? "bg-amber-50/60" : "bg-background"
                    }`}
                  >
                    <p className="text-xs leading-snug">{item.question}</p>
                  </div>

                  {/* Venue cells */}
                  {venues.map((venue) => {
                    const ans = answers[item.id]?.[venue.id];
                    return (
                      <div
                        key={venue.id}
                        style={{ minWidth: COL_MIN_W }}
                        className={`flex flex-1 items-start border-r px-2 py-2 ${
                          diff ? "border-l border-l-amber-300/60" : ""
                        }`}
                      >
                        {item.type === "yesno" && (
                          <YesNoCell status={ans?.status ?? null} />
                        )}
                        {item.type === "memo" && (
                          <MemoCell memo={ans?.memo ?? null} />
                        )}
                        {item.type === "photo" && (
                          <PhotoCell photoUrls={ans?.photoUrls ?? []} />
                        )}
                        {item.type === "number" && (
                          <NumberCell value={ans?.numberValue ?? null} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X, Minus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
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

/** Lucide-based Yes/No/Unknown cell — replaces ○/×/— text symbols */
function YesNoCell({ status }: { status: string | null }) {
  if (status === "yes")
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)]">
        <Check className="h-3.5 w-3.5 text-[var(--gold-warm)]" strokeWidth={2} />
      </span>
    );
  if (status === "no")
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)]">
        <X className="h-3.5 w-3.5 text-destructive" strokeWidth={2} />
      </span>
    );
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center">
      <Minus className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
    </span>
  );
}

function MemoCell({ memo }: { memo: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!memo)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center">
        <Minus className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
      </span>
    );
  const short = memo.length > 40 && !expanded;
  return (
    <button
      className="text-left text-xs leading-snug text-foreground active:opacity-70"
      onClick={() => setExpanded((v) => !v)}
    >
      {short ? `${memo.slice(0, 40)}…` : memo}
    </button>
  );
}

function PhotoCell({ photoUrls }: { photoUrls: string[] }) {
  if (photoUrls.length === 0)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center">
        <Minus className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
      </span>
    );
  return (
    <div className="flex gap-1">
      {photoUrls.slice(0, 3).map((url, i) => (
        <Image
          key={i}
          src={url}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

function NumberCell({ value }: { value: number | null }) {
  if (value === null)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center">
        <Minus className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.5} />
      </span>
    );
  return (
    <span className="tabular-nums text-sm text-foreground">
      {value.toLocaleString("ja-JP")}
    </span>
  );
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

  const showFade = venues.length >= 3;

  return (
    <div className="relative">
      {/* Fade-out gradient for horizontal overflow (CMP-3) */}
      {showFade && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-8 bg-gradient-to-l from-background to-transparent"
        />
      )}

      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: `${160 + venues.length * COL_MIN_W}px` }}>
          {/* Sticky header row */}
          <div className="sticky top-0 z-20 flex border-b border-border/60 bg-background/95 backdrop-blur-sm">
            {/* Row header placeholder */}
            <div className="w-40 flex-shrink-0 border-r border-border/40 bg-background/95 px-2 py-2" />
            {venues.map((venue) => {
              const overallScore = venue.scores.find(
                (s) => s.source === "user_rating" && s.dimension === "atmosphere"
              )?.score;
              return (
                <div
                  key={venue.id}
                  style={{ minWidth: COL_MIN_W }}
                  className="flex flex-1 flex-col items-center gap-1.5 border-r border-border/40 bg-background/95 px-2 py-3"
                >
                  {venue.photoUrls[0] ? (
                    <Image
                      src={venue.photoUrls[0]}
                      alt={venue.name}
                      width={72}
                      height={54}
                      className="h-[54px] w-[72px] rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-[54px] w-[72px] rounded-lg bg-muted" />
                  )}
                  <p className="line-clamp-2 text-center font-[family-name:var(--font-display)] text-[13px] font-extralight leading-snug">
                    {venue.name}
                  </p>
                  {overallScore !== undefined && (
                    <span className="flex items-center gap-0.5 tabular-nums text-[11px] text-[var(--gold-warm)]">
                      <Star className="h-3 w-3 fill-current" />
                      {overallScore.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Matrix rows */}
          {groupedItems.map((group) => (
            <div key={group.category}>
              {/* Category header */}
              <div className="flex border-b border-border/40 bg-[color-mix(in_oklab,var(--gold-warm)_4%,var(--background))]">
                <div className="w-40 flex-shrink-0 px-3 py-1.5">
                  <span className="text-eyebrow text-[var(--gold-warm)]">
                    {group.label}
                  </span>
                </div>
                <div className="flex-1" />
              </div>

              {/* Item rows */}
              {group.items.map((item) => {
                const diff = hasDiff(item.id, venueIds, answers);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex min-h-[52px] border-b border-border/30",
                      diff && "bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))]"
                    )}
                  >
                    {/* Sticky row header */}
                    <div
                      className={cn(
                        "sticky left-0 z-10 flex w-40 flex-shrink-0 items-start border-r border-border/40 px-3 py-2.5",
                        diff
                          ? "bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))]"
                          : "bg-background"
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {/* Gold dot for diff rows */}
                        {diff && (
                          <span
                            aria-label="差分あり"
                            className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--gold-warm)]"
                          />
                        )}
                        <p className="text-xs leading-snug text-foreground">
                          {item.question}
                        </p>
                      </div>
                    </div>

                    {/* Venue cells */}
                    {venues.map((venue) => {
                      const ans = answers[item.id]?.[venue.id];
                      return (
                        <div
                          key={venue.id}
                          style={{ minWidth: COL_MIN_W }}
                          className="flex flex-1 items-start border-r border-border/30 px-3 py-2.5"
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
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonMatrix, ComparisonVenue } from "@/server/actions/checklist";

/**
 * Grid-aware version of the legacy yes/no/memo/photo/number cells. Same
 * semantics as the old comparison-matrix-view's inline cells but written
 * so every venue cell on the row lives in the shared CSS Grid (same
 * rowIndex) → automatic baseline alignment.
 *
 * Kept separate from ComparisonRow because checklist rows are driven by
 * `matrix.answers` (per-venue per-item) while ComparisonRow is driven
 * by the declarative registry on the venue object.
 */

interface Item {
  id: string;
  question: string;
  type: string;
  category: string;
}

interface Props {
  item: Item;
  venues: ComparisonVenue[];
  answers: ComparisonMatrix["answers"];
  rowIndex: number;
}

function YesNoCell({ status }: { status: string | null }) {
  if (status === "yes")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--gold-warm)]">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        はい
      </span>
    );
  if (status === "no")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] px-2 py-0.5 text-[11px] text-destructive/80">
        <X className="h-3 w-3" strokeWidth={2} />
        いいえ
      </span>
    );
  return <Dash />;
}

function Dash() {
  return (
    <span className="inline-flex items-center text-muted-foreground/40">
      <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
    </span>
  );
}

function MemoCell({ memo }: { memo: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!memo) return <Dash />;
  const short = memo.length > 60 && !expanded;
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="block w-full text-left text-[12px] leading-snug text-foreground active:opacity-70"
    >
      <span className={cn(!expanded && "line-clamp-2")}>{memo}</span>
      {short && (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          タップで全文
        </span>
      )}
    </button>
  );
}

function PhotoCell({ photoUrls }: { photoUrls: string[] }) {
  if (photoUrls.length === 0) return <Dash />;
  return (
    <div className="flex gap-1">
      {photoUrls.slice(0, 3).map((url, i) => (
        <Image
          key={i}
          src={url}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg object-cover"
          unoptimized
        />
      ))}
    </div>
  );
}

function NumberCell({ value }: { value: number | null }) {
  if (value === null) return <Dash />;
  return (
    <span className="tabular-nums text-[13px] text-foreground">
      {value.toLocaleString("ja-JP")}
    </span>
  );
}

function hasDiff(
  itemId: string,
  venueIds: string[],
  answers: ComparisonMatrix["answers"],
): boolean {
  const statuses = venueIds.map((vid) => answers[itemId]?.[vid]?.status ?? null);
  const nonNull = statuses.filter((s) => s !== null);
  if (nonNull.length < 2) return false;
  return new Set(nonNull).size > 1;
}

export function ChecklistAnswerRow({ item, venues, answers, rowIndex }: Props) {
  const rowStyle = { gridRow: rowIndex };
  const diff = hasDiff(
    item.id,
    venues.map((v) => v.id),
    answers,
  );

  return (
    <>
      <div
        style={{ ...rowStyle, gridColumn: 1 }}
        className={cn(
          "sticky left-0 z-10 flex items-start gap-1.5 border-b border-border/20 px-3 py-2.5",
          diff
            ? "bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))]"
            : "bg-background",
        )}
      >
        {diff && (
          <span
            aria-label="差分あり"
            className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--gold-warm)]"
          />
        )}
        <p className="text-[11px] leading-snug text-foreground">{item.question}</p>
      </div>

      {venues.map((venue, i) => {
        const ans = answers[item.id]?.[venue.id];
        return (
          <div
            key={venue.id}
            style={{ ...rowStyle, gridColumn: i + 2 }}
            className={cn(
              "flex items-start border-b border-l border-border/20 px-3 py-2.5",
              diff && "bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))]",
            )}
          >
            {item.type === "yesno" && <YesNoCell status={ans?.status ?? null} />}
            {item.type === "memo" && <MemoCell memo={ans?.memo ?? null} />}
            {item.type === "photo" && <PhotoCell photoUrls={ans?.photoUrls ?? []} />}
            {item.type === "number" && <NumberCell value={ans?.numberValue ?? null} />}
          </div>
        );
      })}
    </>
  );
}

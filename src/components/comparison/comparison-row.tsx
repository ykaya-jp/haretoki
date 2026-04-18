"use client";

import { useState } from "react";
import { Check, X, Minus, Star, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonVenue } from "@/lib/comparison-types";
import type { CompareField } from "./comparison-field-registry";
import { resolveHighlight } from "./comparison-field-registry";

/**
 * One field across N venues. Produces one <div> with a left label cell
 * and N venue cells — all children share the same CSS Grid row index
 * (assigned by the parent), which is what gives us per-row baseline
 * alignment regardless of how tall any individual cell renders.
 *
 * The parent (`comparison-grid.tsx`) sets `display:grid` and
 * `grid-template-columns: 160px repeat(N, minmax(160px, 1fr))`. Each row
 * here contributes (N + 1) cells. When a cell grows (multi-line address,
 * chip list), `align-items: start` means shorter cells stay top-aligned
 * rather than stretching weirdly.
 *
 * The "gold row ring" for highlight is applied *inside each cell* rather
 * than on the row — so the ring wraps only the winner cell, not the
 * whole 1760px row.
 */

interface ComparisonRowProps {
  field: CompareField;
  venues: ComparisonVenue[];
  rowIndex: number;
}

function YesNoPill({ value }: { value: boolean | null }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--gold-warm)]">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        あり
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] px-2 py-0.5 text-[11px] text-destructive/80">
        <X className="h-3 w-3" strokeWidth={2} />
        なし
      </span>
    );
  return <DashCell />;
}

function DashCell() {
  return (
    <span className="inline-flex items-center text-muted-foreground/40">
      <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
    </span>
  );
}

/** "2.5 万円" style — expects raw yen */
function formatYen(yen: number | null): string | null {
  if (yen === null) return null;
  const man = Math.round(yen / 10_000);
  return `${man.toLocaleString("ja-JP")}万`;
}

function MultilineCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = text.length > 60 && !expanded;
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="block w-full text-left text-[12px] leading-snug text-foreground active:opacity-70"
    >
      <span className={cn(!expanded && "line-clamp-2")}>{text}</span>
      {short && (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          タップで全文
        </span>
      )}
    </button>
  );
}

function Chips({ items, highlight }: { items: string[]; highlight: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] leading-snug",
            highlight
              ? "bg-[color-mix(in_oklab,var(--gold-warm)_12%,transparent)] text-[var(--gold-warm)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function CellContent({
  field,
  venue,
  isWinner,
}: {
  field: CompareField;
  venue: ComparisonVenue;
  isWinner: boolean;
}) {
  const raw = field.accessor(venue);
  if (!field.hasValue(raw)) return <DashCell />;

  switch (field.render) {
    case "composite-rating": {
      const score = raw as number;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular-nums text-[13px]",
            isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
          )}
        >
          <Star
            className={cn("h-3.5 w-3.5", isWinner ? "fill-current" : "fill-muted-foreground/40")}
            strokeWidth={0}
          />
          {score.toFixed(1)}
        </span>
      );
    }
    case "rating-pair": {
      const { value, count } = raw as { value: number; count: number };
      return (
        <div className="flex flex-col">
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums text-[13px]",
              isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
            )}
          >
            <Star
              className={cn("h-3.5 w-3.5", isWinner ? "fill-current" : "fill-muted-foreground/40")}
              strokeWidth={0}
            />
            {value.toFixed(2)}
          </span>
          {count > 0 && (
            <span className="tabular-nums text-[10px] text-muted-foreground">
              {count.toLocaleString("ja-JP")}件
            </span>
          )}
        </div>
      );
    }
    case "yen-range": {
      const { min, max } = raw as { min: number | null; max: number | null };
      const mn = formatYen(min);
      const mx = formatYen(max);
      const label = mn && mx ? `${mn}〜${mx}円` : mx ? `〜${mx}円` : mn ? `${mn}円〜` : null;
      if (!label) return <DashCell />;
      return (
        <span
          className={cn(
            "tabular-nums text-[13px]",
            isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
          )}
        >
          {label}
        </span>
      );
    }
    case "yen-exact": {
      const label = formatYen(raw as number);
      if (!label) return <DashCell />;
      return (
        <span
          className={cn(
            "tabular-nums text-[13px]",
            isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
          )}
        >
          {label}円
        </span>
      );
    }
    case "percent": {
      // serviceFeeRate is stored as e.g. 0.10 -> "10%"
      const n = raw as number;
      return (
        <span
          className={cn(
            "tabular-nums text-[13px]",
            isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
          )}
        >
          {Math.round(n * 100)}%
        </span>
      );
    }
    case "people-range": {
      const { min, max } = raw as { min: number | null; max: number | null };
      const label = min && max ? `${min}〜${max}名` : max ? `〜${max}名` : min ? `${min}名〜` : null;
      if (!label) return <DashCell />;
      return (
        <span
          className={cn(
            "tabular-nums text-[13px]",
            isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground",
          )}
        >
          {label}
        </span>
      );
    }
    case "chips":
      return <Chips items={raw as string[]} highlight={false} />;
    case "text":
      return (
        <span className="text-[12px] leading-snug text-foreground">{raw as string}</span>
      );
    case "multiline":
      return <MultilineCell text={raw as string} />;
    case "yesno": {
      // For the parking row, the raw value is {has, capacity}
      if (typeof raw === "object" && raw !== null && "has" in raw) {
        const { has, capacity } = raw as { has: boolean | null; capacity: number | null };
        return (
          <div className="flex flex-col gap-0.5">
            <YesNoPill value={has} />
            {has && capacity !== null && (
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {capacity}台
              </span>
            )}
          </div>
        );
      }
      return <YesNoPill value={raw as boolean | null} />;
    }
    default:
      return <DashCell />;
  }
}

export function ComparisonRow({ field, venues, rowIndex }: ComparisonRowProps) {
  const winners = resolveHighlight(field, venues);
  const rowStyle = { gridRow: rowIndex };

  return (
    <>
      {/* Label cell — always column 1 */}
      <div
        style={{ ...rowStyle, gridColumn: 1 }}
        className="sticky left-0 z-10 flex items-start gap-1.5 border-b border-border/20 bg-background px-3 py-2.5"
      >
        <p className="text-[11px] font-medium leading-snug text-muted-foreground">
          {field.label}
        </p>
      </div>

      {/* Venue cells — columns 2..N+1 */}
      {venues.map((venue, i) => {
        const isWinner = winners.has(venue.id);
        return (
          <div
            key={venue.id}
            style={{ ...rowStyle, gridColumn: i + 2 }}
            className={cn(
              "flex items-start border-b border-l border-border/20 px-3 py-2.5",
              isWinner &&
                "bg-[color-mix(in_oklab,var(--gold-warm)_5%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--gold-warm)_45%,transparent)]",
            )}
          >
            {/* Crown icon for "best" rows so the gold cue is color-agnostic */}
            {isWinner && field.highlight.kind === "best" && (
              <Crown
                aria-label="この項目で最良"
                className="mr-1 mt-0.5 h-3 w-3 shrink-0 text-[var(--gold-warm)]"
                strokeWidth={2}
              />
            )}
            <div className="min-w-0 flex-1">
              <CellContent field={field} venue={venue} isWinner={isWinner} />
            </div>
          </div>
        );
      })}
    </>
  );
}

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ComparisonMatrix } from "@/lib/comparison-types";
import { ComparisonHeaderColumn } from "./comparison-header-column";
import { ComparisonRow } from "./comparison-row";
import { ComparisonReviewRow } from "./comparison-review-row";
import { ChecklistAnswerRow } from "./comparison-checklist-row";
import {
  COMPARE_FIELDS,
  FIELD_GROUP_LABELS,
  type FieldGroup,
} from "./comparison-field-registry";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";
import type { DimensionWeights } from "@/lib/scoring";

/**
 * Desktop/tablet CSS Grid layout (≥ 768px).
 *
 * Layout contract:
 * - One big grid with `grid-template-columns: 160px repeat(N, minmax(160px, 1fr))`.
 * - Header row (row 1) holds the venue header columns and stays sticky-top.
 * - Each subsequent row is one CompareField *or* one checklist item.
 * - Group subheadings (費用 / 評価 / 設備) span the full width of the data
 *   columns but sit in their own row — they're the only row that uses
 *   `grid-column: 2 / -1` so the label gutter stays clean.
 *
 * Why a single grid (vs one grid per row)? Because a single grid lets
 * the browser share baselines across rows automatically. If every row
 * were its own mini-grid, a tall row (multi-line address) in venue A
 * would only affect A's column on that row — but with a shared grid
 * the same row height applies to every column, so baselines align.
 *
 * Mobile (<768px) uses a different component (ComparisonMobileSnapper)
 * because 10 columns × 160px = 1760px horizontal scroll is unusable on
 * 375px viewport — better to show one venue per viewport with snap.
 */

interface ComparisonGridProps {
  matrix: ComparisonMatrix;
  /** W18-1: couple's averaged per-dimension weights (owner+partner mean).
   *  Forwarded to the header column so each ★ badge reflects both
   *  partners' priorities. `null` → unweighted (legacy). */
  weights?: DimensionWeights | null;
}

export function ComparisonGrid({ matrix, weights = null }: ComparisonGridProps) {
  const { venues, items, answers } = matrix;

  // Only show Deep Extraction rows that at least one venue has data for.
  // Suppresses "白紙" rows when every venue lacks e.g. chef credentials.
  const visibleFields = useMemo(
    () =>
      COMPARE_FIELDS.filter((field) =>
        venues.some((v) => field.hasValue(field.accessor(v))),
      ),
    [venues],
  );

  // Group visible deep-extraction rows for subheadings
  const fieldGroups = useMemo(() => {
    const seen = new Map<FieldGroup, typeof COMPARE_FIELDS>();
    for (const f of visibleFields) {
      if (!seen.has(f.group)) seen.set(f.group, []);
      seen.get(f.group)!.push(f);
    }
    return Array.from(seen.entries());
  }, [visibleFields]);

  // Group checklist items by category (legacy behaviour preserved)
  const checklistGroups = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        items: items.filter((i) => i.category === cat),
      })).filter((g) => g.items.length > 0),
    [items],
  );

  // Grid row accounting — we build one continuous grid. Row 1 is the
  // header. We then walk [group heading][...fields][group heading][...].
  // Each Row component is told its rowIndex so it writes itself into
  // the right grid-row.
  const N = venues.length;
  const gridTemplateColumns = `160px repeat(${N}, minmax(160px, 1fr))`;

  // R2 — only show the cross-venue review row when at least one venue
  // has a populated reviewSummary. Hides the row entirely when nothing
  // has been imported yet, instead of rendering N empty cells.
  const showReviewRow = venues.some(
    (v) => v.reviewSummary !== undefined && v.reviewSummary.count > 0,
  );

  // Pre-compute rowIndex assignment so the JSX below stays readable.
  type Slot =
    | { kind: "group-heading"; group: FieldGroup; label: string }
    | { kind: "field"; fieldId: string }
    | { kind: "review-heading" }
    | { kind: "review-row" }
    | { kind: "checklist-heading"; label: string }
    | { kind: "checklist-item"; itemId: string };
  const slots: Slot[] = [];
  for (const [group, fields] of fieldGroups) {
    slots.push({ kind: "group-heading", group, label: FIELD_GROUP_LABELS[group] });
    for (const f of fields) slots.push({ kind: "field", fieldId: f.id });
  }
  if (showReviewRow) {
    slots.push({ kind: "review-heading" });
    slots.push({ kind: "review-row" });
  }
  for (const g of checklistGroups) {
    slots.push({ kind: "checklist-heading", label: g.label });
    for (const item of g.items) slots.push({ kind: "checklist-item", itemId: item.id });
  }
  // rowIndex: header is row 1, slots start at row 2
  const slotRowIndex = (slotIndex: number) => slotIndex + 2;

  const showFade = N >= 3;

  return (
    <div className="relative">
      {/* Fade gradient for horizontal overflow cue */}
      {showFade && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-8 bg-gradient-to-l from-background to-transparent"
        />
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-8">
        <div
          className="grid w-max"
          style={{
            gridTemplateColumns,
            gridAutoRows: "minmax(52px, auto)",
          }}
        >
          {/* Row 1: empty label cell + venue header columns, sticky top.
              W21-8: corner cell (row 1, col 1) sticks to BOTH top AND left
              with z-30 so it stays above the row-only and column-only sticky
              cells when the user scrolls in two axes at once. Without this,
              horizontal scroll at 375px lets the leftmost venue header bleed
              under where the empty corner used to be, leaving a visual gap
              over the sticky label column. */}
          <div
            className="sticky left-0 top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm"
            style={{ gridRow: 1, gridColumn: 1 }}
          />
          {venues.map((venue, i) => (
            <div
              key={venue.id}
              className={cn(
                "sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-sm",
                i > 0 && "border-l border-border/40",
              )}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              <ComparisonHeaderColumn venue={venue} weights={weights} />
            </div>
          ))}

          {/* Subsequent rows: group headings and field rows */}
          {slots.map((slot, si) => {
            const row = slotRowIndex(si);
            if (slot.kind === "group-heading") {
              return (
                <div
                  key={`heading-${slot.group}-${si}`}
                  style={{ gridRow: row, gridColumn: `1 / -1` }}
                  className="border-b border-border/40 bg-[color-mix(in_oklab,var(--gold-warm)_4%,var(--background))] px-3 py-1.5"
                >
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--gold-warm)]">
                    {slot.label}
                  </span>
                </div>
              );
            }
            if (slot.kind === "field") {
              const field = visibleFields.find((f) => f.id === slot.fieldId)!;
              return (
                <ComparisonRow
                  key={`field-${slot.fieldId}`}
                  field={field}
                  venues={venues}
                  rowIndex={row}
                />
              );
            }
            if (slot.kind === "review-heading") {
              return (
                <div
                  key={`review-heading-${si}`}
                  style={{ gridRow: row, gridColumn: `1 / -1` }}
                  className="border-b border-border/40 bg-[color-mix(in_oklab,var(--gold-warm)_4%,var(--background))] px-3 py-1.5"
                >
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--gold-warm)]">
                    口コミ
                  </span>
                </div>
              );
            }
            if (slot.kind === "review-row") {
              return (
                <ComparisonReviewRow
                  key={`review-row-${si}`}
                  venues={venues}
                  rowIndex={row}
                />
              );
            }
            if (slot.kind === "checklist-heading") {
              return (
                <div
                  key={`cl-heading-${slot.label}-${si}`}
                  style={{ gridRow: row, gridColumn: `1 / -1` }}
                  className="border-b border-border/40 bg-surface-sunken px-3 py-1.5"
                >
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    チェックリスト · {slot.label}
                  </span>
                </div>
              );
            }
            // checklist-item
            const item = items.find((i) => i.id === slot.itemId)!;
            return (
              <ChecklistAnswerRow
                key={`cl-${slot.itemId}`}
                item={item}
                venues={venues}
                answers={answers}
                rowIndex={row}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EstimateForm } from "@/components/venues/estimate-form";
import { EstimateBreakdown } from "@/components/venues/estimate-breakdown";
import { EstimatePdfUpload } from "@/components/venues/estimate-pdf-upload";
import { Plus, ChevronDown, ChevronUp, Receipt, FilePlus2, Pencil } from "lucide-react";
import { formatYen } from "@/lib/utils";

type EstimateItem = {
  id: string;
  category: string;
  itemName: string;
  amount: number;
  tier?: string;
  predictedUpgrade?: number | null;
};

type Estimate = {
  id: string;
  version: number;
  total: number;
  predictedFinal: number | null;
  sourceType: string;
  items: EstimateItem[];
  createdAt: Date;
};

/**
 * Mode state for the add-estimate action row.
 *
 * `null` = neither form open. `pdf` = PDF upload + AI extraction flow.
 * `manual` = legacy hand-input form. Kept as a discriminated value rather
 * than two booleans so we can never end up with both forms open at once
 * (a real bug we hit when the previous boolean pair had independent state).
 */
type EntryMode = null | "pdf" | "manual";

export function EstimateSection({
  venueId,
  estimates,
}: {
  venueId: string;
  estimates: Estimate[];
}) {
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const latest = estimates[0]; // already sorted by version desc

  if (!latest && entryMode === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ boxShadow: "0 0 0 0.5px var(--gold-subtle)" }}
        >
          <Receipt className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-light">見積もりはまだありません</p>
          <p className="text-xs text-muted-foreground">
            PDFをアップロードして自動入力、または手入力で記録できます
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={() => setEntryMode("pdf")}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98]"
          >
            <FilePlus2 className="mr-1 h-4 w-4" />
            PDFで自動入力
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("manual")}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-6 text-sm text-foreground transition-all duration-200 active:scale-[0.98] active:bg-muted"
          >
            <Pencil className="mr-1 h-4 w-4" />
            手入力で記録
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section eyebrow — matches Reviews / Visit / Plans editorial pattern */}
      <div>
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          Estimate
        </p>
        <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em]">
          お金のはなし
        </h2>
      </div>

      {/* Latest estimate summary */}
      {latest && (
        <div className="space-y-4">
          {/* Total prominently at top — display-scale numeral (V-2) */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-baseline gap-0.5">
              <span className="text-[11px] text-muted-foreground">¥</span>
              <span className="text-display-numeral">
                {(latest.total / 10000).toFixed(0)}
              </span>
              <span className="text-[11px] text-muted-foreground">万</span>
            </span>
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              v{latest.version}&thinsp;·&thinsp;
              {latest.sourceType === "manual" ? "手入力" : latest.sourceType}
            </span>
          </div>

          {/* Predicted final highlight */}
          {latest.predictedFinal && (
            <div className="rounded-md bg-tint-gold px-3 py-2 dark:bg-tint-gold">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-tone-gold dark:text-tone-gold">
                  最終予測額
                </span>
                <span className="text-lg font-medium tabular-nums text-tone-gold dark:text-tone-gold">
                  {formatYen(latest.predictedFinal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-tone-gold dark:text-tone-gold">
                準備として把握しておくと安心です
              </p>
            </div>
          )}

          {/* Collapsible category breakdown */}
          {latest.items.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-muted-foreground active:bg-muted min-h-[44px]"
              >
                <span>内訳を見る（{latest.items.length}項目）</span>
                {showBreakdown ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showBreakdown && (
                <div className="mt-3">
                  <EstimateBreakdown items={latest.items} />
                </div>
              )}
            </div>
          )}

          {/* Show older versions count */}
          {estimates.length > 1 && (
            <p className="text-xs text-muted-foreground">
              過去の見積もり: {estimates.length - 1}件
            </p>
          )}
        </div>
      )}

      {/* Add new estimate — two entry paths (AI / manual). We only show
          one form at a time so the section stays scannable on mobile. */}
      {entryMode !== null ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {entryMode === "pdf" ? "PDFで自動入力" : "新しい見積もり"}
            </h4>
            <button
              type="button"
              onClick={() => setEntryMode(null)}
              className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2"
            >
              キャンセル
            </button>
          </div>
          {entryMode === "pdf" ? (
            <EstimatePdfUpload
              venueId={venueId}
              onSaved={() => setEntryMode(null)}
            />
          ) : (
            <EstimateForm
              venueId={venueId}
              onSaved={() => setEntryMode(null)}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => setEntryMode("pdf")}
            className="w-full"
          >
            <FilePlus2 className="mr-1 h-4 w-4" />
            PDFで追加
          </Button>
          <Button
            variant="outline"
            onClick={() => setEntryMode("manual")}
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" />
            手入力で追加
          </Button>
        </div>
      )}
    </div>
  );
}

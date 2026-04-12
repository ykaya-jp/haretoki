"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EstimateForm } from "@/components/venues/estimate-form";
import { EstimateWaterfallChart } from "@/components/venues/estimate-waterfall-chart";
import { EstimateBreakdown } from "@/components/venues/estimate-breakdown";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { formatYen, formatYenFull } from "@/lib/utils";

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

export function EstimateSection({
  venueId,
  estimates,
}: {
  venueId: string;
  estimates: Estimate[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const latest = estimates[0]; // already sorted by version desc

  if (!latest && !showForm) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          まだ見積もりが登録されていません
        </p>
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" />
          見積もりを追加
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Latest estimate summary */}
      {latest && (
        <div className="space-y-4">
          {/* Total prominently at top */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold tabular-nums">
                {formatYen(latest.total)}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                ({formatYenFull(latest.total)})
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              v{latest.version}・
              {latest.sourceType === "manual" ? "手入力" : latest.sourceType}
            </span>
          </div>

          {/* Predicted final highlight */}
          {latest.predictedFinal && (
            <div className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  最終予測額
                </span>
                <span className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">
                  {formatYen(latest.predictedFinal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                準備として把握しておくと安心です
              </p>
            </div>
          )}

          {/* Waterfall chart: show if predicted_final exists */}
          {latest.predictedFinal && (
            <EstimateWaterfallChart
              initialTotal={latest.total}
              predictedFinal={latest.predictedFinal}
              items={latest.items.map((item) => ({
                category: item.category,
                itemName: item.itemName,
                amount: item.amount,
                predictedUpgrade: item.predictedUpgrade ?? null,
              }))}
            />
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

      {/* Add new estimate */}
      {showForm ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">新しい見積もり</h4>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-2"
            >
              キャンセル
            </button>
          </div>
          <EstimateForm
            venueId={venueId}
            onSaved={() => setShowForm(false)}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" />
          見積もりを追加
        </Button>
      )}
    </div>
  );
}

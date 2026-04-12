"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EstimateForm } from "@/components/venues/estimate-form";
import { Plus } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  venue_fee: "会場費",
  cuisine: "料理・飲物",
  attire: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・照明",
  other: "その他",
};

type EstimateItem = {
  id: string;
  category: string;
  itemName: string;
  amount: number;
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

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatYenMan(amount: number): string {
  return `¥${Math.round(amount / 10000)}万`;
}

export function EstimateSection({
  venueId,
  estimates,
}: {
  venueId: string;
  estimates: Estimate[];
}) {
  const [showForm, setShowForm] = useState(false);
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
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums">
              {formatYenMan(latest.total)}
            </span>
            <span className="text-xs text-muted-foreground">
              v{latest.version}・
              {latest.sourceType === "manual" ? "手入力" : latest.sourceType}
            </span>
          </div>

          {latest.predictedFinal && (
            <div className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
              <span className="text-sm text-amber-800 dark:text-amber-200">
                最終予測額: {formatYenMan(latest.predictedFinal)}
              </span>
            </div>
          )}

          {/* Line items */}
          {latest.items.length > 0 && (
            <div className="space-y-1">
              {latest.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    <span className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    {item.itemName}
                  </span>
                  <span className="tabular-nums">{formatYen(item.amount)}</span>
                </div>
              ))}
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
              className="text-sm text-muted-foreground hover:text-foreground"
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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEstimate } from "@/server/actions/estimates";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  { value: "venue_fee", label: "会場費" },
  { value: "cuisine", label: "料理・飲物" },
  { value: "attire", label: "衣裳" },
  { value: "photo_video", label: "写真・映像" },
  { value: "flowers", label: "装花" },
  { value: "performance", label: "演出" },
  { value: "av_equipment", label: "音響・照明" },
  { value: "other", label: "その他" },
] as const;

type LineItem = {
  category: (typeof CATEGORY_OPTIONS)[number]["value"];
  itemName: string;
  amount: string;
};

function formatYen(value: string): string {
  const num = parseInt(value.replace(/,/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("ja-JP");
}

export function EstimateForm({
  venueId,
  onSaved,
}: {
  venueId: string;
  onSaved?: () => void;
}) {
  const [total, setTotal] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { category: "other", itemName: "", amount: "" },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const totalNum = parseInt(total.replace(/,/g, ""), 10);
    if (isNaN(totalNum) || totalNum <= 0) {
      setError("総額をご入力ください");
      setLoading(false);
      return;
    }

    const parsedItems =
      items.length > 0
        ? items
            .filter((item) => item.itemName.trim() !== "")
            .map((item) => ({
              category: item.category,
              itemName: item.itemName,
              amount: parseInt(item.amount.replace(/,/g, ""), 10) || 0,
            }))
        : undefined;

    try {
      const result = await createEstimate({
        venueId,
        total: totalNum,
        items: parsedItems,
      });

      if (result.error) {
        const messages = Object.values(result.error).flat();
        setError(messages.join(", ") || "入力内容をご確認ください");
        return;
      }

      // Reset form
      setTotal("");
      setItems([]);
      setShowItems(false);
      toast.success("見積もりを記録しました");
      onSaved?.();
    } catch {
      setError("記録できませんでした");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Total amount */}
      <div className="space-y-2">
        <Label htmlFor="estimate-total">
          総額 <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ¥
          </span>
          <Input
            id="estimate-total"
            inputMode="numeric"
            placeholder="3,500,000"
            value={total}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setTotal(raw ? formatYen(raw) : "");
            }}
            className="pl-7"
            required
          />
        </div>
      </div>

      {/* Collapsible line items */}
      <div>
        <button
          type="button"
          onClick={() => {
            setShowItems(!showItems);
            if (!showItems && items.length === 0) addItem();
          }}
          className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-muted-foreground active:bg-muted"
        >
          <span>内訳を入力（任意）</span>
          {showItems ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showItems && (
          <div className="mt-3 space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-border/50 p-3"
              >
                <div className="flex-1 space-y-2">
                  <select
                    value={item.category}
                    onChange={(e) =>
                      updateItem(index, "category", e.target.value)
                    }
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="項目名"
                    value={item.itemName}
                    onChange={(e) =>
                      updateItem(index, "itemName", e.target.value)
                    }
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ¥
                    </span>
                    <Input
                      inputMode="numeric"
                      placeholder="金額"
                      value={item.amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        updateItem(
                          index,
                          "amount",
                          raw ? formatYen(raw) : "",
                        );
                      }}
                      className="pl-7"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="mt-1 rounded-md p-2 text-muted-foreground hover:text-destructive active:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="w-full"
            >
              <Plus className="mr-1 h-4 w-4" />
              項目を追加
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "記録しています..." : "見積もりを記録する"}
      </Button>
    </form>
  );
}

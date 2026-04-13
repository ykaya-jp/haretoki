"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VenueFilters } from "@/server/actions/venues";

interface VenueFilterSheetProps {
  filters: VenueFilters;
  onApply: (filters: VenueFilters) => void;
}

const SORT_OPTIONS = [
  { value: "created_desc", label: "新しい順" },
  { value: "score_desc", label: "スコア順" },
  { value: "cost_asc", label: "費用が安い順" },
  { value: "cost_desc", label: "費用が高い順" },
] as const;

const DRESS_OPTIONS = [
  { value: "allowed", label: "可" },
  { value: "not_allowed", label: "不可" },
  { value: "negotiable", label: "要相談" },
] as const;

const PAYMENT_OPTIONS = [
  { value: "カード", label: "カード" },
  { value: "現金", label: "現金" },
  { value: "分割", label: "分割" },
] as const;

export function VenueFilterSheet({ filters, onApply }: VenueFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VenueFilters>(filters);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft(filters);
    setOpen(isOpen);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleReset = () => {
    const empty: VenueFilters = {};
    setDraft(empty);
    onApply(empty);
    setOpen(false);
  };

  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="relative flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm transition-colors active:scale-95"
          />
        }
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>絞り込み</span>
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {activeCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>絞り込み・並べ替え</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Sort */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">並べ替え</Label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      sortBy: d.sortBy === opt.value ? undefined : opt.value,
                    }))
                  }
                  className={cn(
                    "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                    draft.sortBy === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Score range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              最低スコア
              {draft.minScore !== undefined && (
                <span className="ml-2 tabular-nums text-[var(--gold-warm)]">
                  {draft.minScore.toFixed(1)} 以上
                </span>
              )}
            </Label>
            <input
              type="range"
              min="3.0"
              max="5.0"
              step="0.1"
              value={draft.minScore ?? 3.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setDraft((d) => ({
                  ...d,
                  minScore: val <= 3.0 ? undefined : val,
                }));
              }}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3.0</span>
              <span>5.0</span>
            </div>
          </div>

          {/* Cost range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">費用の範囲（万円）</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="下限"
                value={draft.costMin !== undefined ? draft.costMin / 10000 : ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    costMin: e.target.value ? parseInt(e.target.value) * 10000 : undefined,
                  }))
                }
                className="flex-1"
              />
              <span className="text-muted-foreground">〜</span>
              <Input
                type="number"
                placeholder="上限"
                value={draft.costMax !== undefined ? draft.costMax / 10000 : ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    costMax: e.target.value ? parseInt(e.target.value) * 10000 : undefined,
                  }))
                }
                className="flex-1"
              />
            </div>
          </div>

          {/* Dress bring-in */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">ドレス持ち込み</Label>
            <div className="flex flex-wrap gap-2">
              {DRESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      dressBringIn: d.dressBringIn === opt.value ? undefined : opt.value,
                    }))
                  }
                  className={cn(
                    "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                    draft.dressBringIn === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">支払い方法</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      paymentMethod: d.paymentMethod === opt.value ? undefined : opt.value,
                    }))
                  }
                  className={cn(
                    "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                    draft.paymentMethod === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              リセット
            </Button>
            <SheetClose
              render={
                <Button onClick={handleApply} className="flex-1" />
              }
            >
              適用する
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

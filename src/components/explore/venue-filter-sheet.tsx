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
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VenueFilters } from "@/server/actions/venue-filters";
import { paymentMethodOptions, type PaymentMethod } from "@/lib/payment";

interface VenueFilterSheetProps {
  filters: VenueFilters;
  onApply: (filters: VenueFilters) => void;
}

const SORT_OPTIONS = [
  { value: "created_desc", label: "新しい順" },
  { value: "score_desc", label: "評価が高い順" },
  { value: "cost_asc", label: "費用が安い順" },
  { value: "cost_desc", label: "費用が高い順" },
  { value: "review_delta_asc", label: "見積もり上昇率の低い順" },
  { value: "score_cuisine_desc", label: "料理の評価順" },
  { value: "score_hospitality_desc", label: "サービスの評価順" },
  { value: "score_atmosphere_desc", label: "雰囲気の評価順" },
  { value: "score_cost_desc", label: "コスパの評価順" },
  { value: "score_access_desc", label: "設備の評価順" },
] as const;

const REVIEW_DELTA_PCT_DEFAULT = 30;
const REVIEW_SAMPLE_COUNT_THRESHOLD = 3;

const DRESS_OPTIONS = [
  { value: "allowed", label: "可" },
  { value: "not_allowed", label: "不可" },
  { value: "negotiable", label: "要相談" },
] as const;

const PAYMENT_OPTIONS = paymentMethodOptions();

const DEFAULT_MIN_INSTALLMENTS = 3;

const DIMENSION_OPTIONS = [
  { value: "atmosphere", label: "雰囲気" },
  { value: "cuisine", label: "料理" },
  { value: "hospitality", label: "サービス" },
  { value: "cost", label: "コスパ" },
  { value: "access", label: "設備" },
] as const;

const DRESS_FEE_RANGE_MIN = 0;
const DRESS_FEE_RANGE_MAX = 300_000;
const DRESS_FEE_STEP = 10_000;

function formatDressFee(value: number): string {
  if (value === 0) return "無料";
  return `${(value / 10_000).toLocaleString("ja-JP")}万円`;
}

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

  const activeCount = Object.values(filters).filter((v) => {
    if (v === undefined || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;

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
        <span>条件で探す</span>
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {activeCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>条件をしぼる・並べ替え</SheetTitle>
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
              評価の下限
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

          {/* Category-specific rating */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">カテゴリ別の評価</Label>
            <div className="flex flex-wrap gap-2">
              {DIMENSION_OPTIONS.map((opt) => {
                const isActive = draft.dimensionMinScore?.dimension === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        dimensionMinScore: isActive
                          ? undefined
                          : { dimension: opt.value, score: 4.0 },
                      }))
                    }
                    className={cn(
                      "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground"
                    )}
                  >
                    {opt.label} {isActive && "4.0+"}
                  </button>
                );
              })}
            </div>
            {draft.dimensionMinScore && (
              <input
                type="range"
                min="3.0"
                max="5.0"
                step="0.1"
                value={draft.dimensionMinScore.score}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDraft((d) =>
                    d.dimensionMinScore
                      ? { ...d, dimensionMinScore: { ...d.dimensionMinScore, score: val } }
                      : d
                  );
                }}
                className="w-full accent-primary"
              />
            )}
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

          {/* Dress bring-in fee — dual-handle range slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">ドレス持ち込み料</Label>
              {!draft.dressBringInFeeFreeOnly && (
                <span className="text-sm tabular-nums text-[var(--gold-warm)]">
                  {formatDressFee(draft.dressBringInFeeMin ?? DRESS_FEE_RANGE_MIN)}
                  {" 〜 "}
                  {formatDressFee(draft.dressBringInFeeMax ?? DRESS_FEE_RANGE_MAX)}
                </span>
              )}
            </div>
            <Slider
              min={DRESS_FEE_RANGE_MIN}
              max={DRESS_FEE_RANGE_MAX}
              step={DRESS_FEE_STEP}
              value={[
                draft.dressBringInFeeMin ?? DRESS_FEE_RANGE_MIN,
                draft.dressBringInFeeMax ?? DRESS_FEE_RANGE_MAX,
              ]}
              disabled={draft.dressBringInFeeFreeOnly}
              onValueChange={(value) => {
                const [min, max] = value as readonly number[];
                setDraft((d) => ({
                  ...d,
                  dressBringInFeeMin: min === DRESS_FEE_RANGE_MIN ? undefined : min,
                  dressBringInFeeMax: max === DRESS_FEE_RANGE_MAX ? undefined : max,
                }));
              }}
              aria-label="ドレス持ち込み料の範囲"
            />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatDressFee(DRESS_FEE_RANGE_MIN)}</span>
              <span>{formatDressFee(DRESS_FEE_RANGE_MAX)}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    dressBringInFeeFreeOnly: d.dressBringInFeeFreeOnly ? undefined : true,
                    // When flipping to "free only", clear the numeric range so UX is clean.
                    ...(d.dressBringInFeeFreeOnly
                      ? {}
                      : { dressBringInFeeMin: undefined, dressBringInFeeMax: undefined }),
                  }))
                }
                className={cn(
                  "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                  draft.dressBringInFeeFreeOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                )}
              >
                無料のみ
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    dressBringInIncludeNegotiable: d.dressBringInIncludeNegotiable ? undefined : true,
                  }))
                }
                className={cn(
                  "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
                  draft.dressBringInIncludeNegotiable
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                )}
              >
                要相談を含む
              </button>
            </div>
          </div>

          {/* Review-derived estimate-increase cap */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">見積もり上昇率</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                レビューから推定された、初期見積もりからの上昇率
              </p>
              <p className="text-[11px] leading-relaxed text-[var(--gold-warm)]">
                妻が特に重視したい項目です
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.reviewEstimateDeltaPctMax !== undefined}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    reviewEstimateDeltaPctMax: e.target.checked
                      ? REVIEW_DELTA_PCT_DEFAULT
                      : undefined,
                  }))
                }
                className="h-4 w-4 accent-primary"
                aria-label="上昇率の上限でしぼる"
              />
              <span>
                {draft.reviewEstimateDeltaPctMax !== undefined
                  ? `${draft.reviewEstimateDeltaPctMax}%以下の式場だけ表示`
                  : "上昇率の上限でしぼる"}
              </span>
            </label>

            {draft.reviewEstimateDeltaPctMax !== undefined && (
              <>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[draft.reviewEstimateDeltaPctMax]}
                  onValueChange={(value) => {
                    const [v] = value as readonly number[];
                    setDraft((d) => ({
                      ...d,
                      reviewEstimateDeltaPctMax: v,
                    }));
                  }}
                  aria-label="見積もり上昇率の上限"
                />
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.reviewEstimateMinSampleCount !== undefined}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    reviewEstimateMinSampleCount: e.target.checked
                      ? REVIEW_SAMPLE_COUNT_THRESHOLD
                      : undefined,
                  }))
                }
                className="h-4 w-4 accent-primary"
                aria-label="サンプル数で絞り込む"
              />
              <span>n=3 以上の式場のみ</span>
            </label>
          </div>

          {/* Payment methods — multi-select over the new PaymentMethod enum. */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">支払い方法</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const selected = draft.paymentMethodEnums ?? [];
                const isActive = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft((d) => {
                        const cur = d.paymentMethodEnums ?? [];
                        const next: PaymentMethod[] = isActive
                          ? cur.filter((v) => v !== opt.value)
                          : [...cur, opt.value];
                        // When 分割 is toggled off, also clear the min-installments rider.
                        const clearMin =
                          opt.value === "installment" && isActive;
                        return {
                          ...d,
                          paymentMethodEnums: next.length > 0 ? next : undefined,
                          ...(clearMin ? { maxInstallmentsMin: undefined } : {}),
                        };
                      })
                    }
                    className={cn(
                      "min-h-[44px] rounded-full border px-4 text-sm font-light transition-colors active:scale-95",
                      isActive
                        ? "border-[var(--gold-warm)] bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                        : "border-border bg-card text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {draft.paymentMethodEnums?.includes("installment") && (
              <div className="space-y-2 rounded-xl border-l-[3px] border-[var(--gold-warm)] bg-[var(--gold-subtle)] px-3 py-2">
                <Label
                  htmlFor="max-installments-min"
                  className="text-xs font-light text-muted-foreground"
                >
                  最低 N 回以上の分割が可能な式場のみ
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="max-installments-min"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    placeholder={String(DEFAULT_MIN_INSTALLMENTS)}
                    value={draft.maxInstallmentsMin ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        maxInstallmentsMin: raw
                          ? Math.max(1, parseInt(raw, 10))
                          : undefined,
                      }));
                    }}
                    className="w-24 tabular-nums"
                  />
                  <span className="text-sm font-light text-muted-foreground">
                    回以上
                  </span>
                </div>
              </div>
            )}
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
              この条件で探す
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateMyWeights } from "@/server/actions/weights";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  DIMENSION_HELP,
  type Tier1Dimension,
} from "@/lib/constants";
import {
  WEIGHT_MIN,
  WEIGHT_MAX,
  WEIGHT_DEFAULT,
  type Weights,
} from "@/lib/weighted-score";

/**
 * W12-1 weights settings form.
 *
 * One slider per Tier1 dimension, integer scale 1-5 (matches the star
 * rating radix couples already use). Labels anchor the extremes in plain
 * language ("どうでもいい" ↔ "超重視") because raw numbers leave users
 * guessing what "2" means — and the whole point of this screen is to
 * translate personal priority into a number the ranking engine can use.
 *
 * Touch targets: <input type="range"> renders a 44px-tall hit area via
 * the h-11 wrapper; the visual track is thinner but the click zone
 * matches the global 44px rule. Each +/- button is also h-11 so a user
 * who can't use a slider thumb on 375px still has two tappable ways to
 * nudge the value.
 */

interface WeightsFormProps {
  initialWeights: Weights;
}

const SCALE_HINT = "1=どうでもいい ／ 3=普通 ／ 5=超重視";

function clamp(n: number): number {
  if (n < WEIGHT_MIN) return WEIGHT_MIN;
  if (n > WEIGHT_MAX) return WEIGHT_MAX;
  return n;
}

export function WeightsForm({ initialWeights }: WeightsFormProps) {
  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const setDim = (dim: Tier1Dimension, value: number) => {
    setWeights((prev: Weights) => ({ ...prev, [dim]: clamp(Math.round(value)) }));
  };

  const handleReset = () => {
    const next = {} as Weights;
    for (const dim of TIER1_DIMENSIONS) next[dim] = WEIGHT_DEFAULT;
    setWeights(next);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateMyWeights(weights);
      if (result.success) {
        toast.success("重みを残しました");
        router.refresh();
      } else {
        toast.error(result.error ?? "うまく残せませんでした");
      }
    });
  };

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-[var(--gold-subtle)] px-4 py-3 text-[12.5px] leading-relaxed text-foreground/80">
        スライダーを動かすと、候補タブと比較画面の総合スコアに反映されます。
        <br />
        <span className="text-muted-foreground">{SCALE_HINT}</span>
      </p>

      <div className="space-y-5">
        {TIER1_DIMENSIONS.map((dim) => {
          const value = weights[dim] ?? WEIGHT_DEFAULT;
          const inputId = `weight-${dim}`;
          return (
            <div
              key={dim}
              className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={inputId} className="text-[14px] font-normal">
                  {DIMENSION_LABELS[dim] ?? dim}
                </Label>
                <span
                  aria-label={`現在の重み: ${value} / ${WEIGHT_MAX}`}
                  className="tabular-nums text-[13px] font-medium text-[var(--gold-warm)]"
                >
                  {value} / {WEIGHT_MAX}
                </span>
              </div>
              {DIMENSION_HELP[dim] && (
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {DIMENSION_HELP[dim]}
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  aria-label={`${DIMENSION_LABELS[dim] ?? dim} の重みを下げる`}
                  onClick={() => setDim(dim, value - 1)}
                  disabled={value <= WEIGHT_MIN || isPending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg transition-all duration-150 active:scale-[0.92] disabled:opacity-40"
                >
                  −
                </button>
                <input
                  id={inputId}
                  type="range"
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  step={1}
                  value={value}
                  disabled={isPending}
                  onChange={(e) => setDim(dim, parseInt(e.target.value, 10))}
                  className="h-11 w-full accent-[var(--gold-warm)]"
                />
                <button
                  type="button"
                  aria-label={`${DIMENSION_LABELS[dim] ?? dim} の重みを上げる`}
                  onClick={() => setDim(dim, value + 1)}
                  disabled={value >= WEIGHT_MAX || isPending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg transition-all duration-150 active:scale-[0.92] disabled:opacity-40"
                >
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:flex-1"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              残しています…
            </>
          ) : (
            <>
              <Sliders className="mr-2 h-4 w-4" />
              重みを保存
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          初期値に戻す
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        ※ 現在は自分の重みのみ総合スコアに反映しています。パートナーの重みを混ぜた
        「ふたりの総合」はこれから対応予定です。
      </p>
    </div>
  );
}

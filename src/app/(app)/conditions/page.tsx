"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateConditions } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AREA_OPTIONS = [
  "東京（表参道・青山）",
  "東京（その他）",
  "横浜・湘南",
  "千葉・埼玉",
  "関西",
  "その他",
];

const STYLE_OPTIONS = [
  "チャペル",
  "神前式",
  "人前式",
  "ガーデン",
  "レストラン",
];

function ChipSelector({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function ConditionsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [areas, setAreas] = useState<string[]>([]);
  const [guestCount, setGuestCount] = useState(80);
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [styles, setStyles] = useState<string[]>([]);

  function toggleArea(value: string) {
    setAreas((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleStyle(value: string) {
    setStyles((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function handleSave() {
    startTransition(async () => {
      const budget =
        budgetMin || budgetMax
          ? {
              min: budgetMin ? Number(budgetMin) : 0,
              max: budgetMax ? Number(budgetMax) : 0,
            }
          : undefined;

      await updateConditions({
        area: areas.length > 0 ? areas : undefined,
        guestCount: guestCount || undefined,
        budget,
        style: styles.length > 0 ? styles : undefined,
      });

      router.push("/venues");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-xl font-bold">
          おふたりの理想を教えてください
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          すべて任意です。後からいつでも変更できます。
        </p>
      </div>

      {/* Area */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">エリア</CardTitle>
        </CardHeader>
        <CardContent>
          <ChipSelector
            options={AREA_OPTIONS}
            selected={areas}
            onToggle={toggleArea}
          />
        </CardContent>
      </Card>

      {/* Guest count */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">ゲスト人数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={200}
              step={10}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">
              {guestCount}名
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>20名</span>
            <span>200名</span>
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">予算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="budget-min">下限（万円）</Label>
              <Input
                id="budget-min"
                type="number"
                placeholder="200"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="budget-max">上限（万円）</Label>
              <Input
                id="budget-max"
                type="number"
                placeholder="500"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ※ 最終的に初期見積もりから+100万円程度になる傾向があります
          </p>
        </CardContent>
      </Card>

      {/* Ceremony style */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">挙式スタイル</CardTitle>
        </CardHeader>
        <CardContent>
          <ChipSelector
            options={STYLE_OPTIONS}
            selected={styles}
            onToggle={toggleStyle}
          />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/venues")}
          className="flex-1"
        >
          スキップして式場を探す
        </Button>
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? "保存中..." : "保存して次へ"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillOptions } from "@/components/ui/pill-options";
import { saveOnboardingAnswers } from "@/server/actions/onboarding";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";

const STYLE_OPTIONS = [
  { id: "チャペル", label: "チャペル" },
  { id: "神前", label: "神前" },
  { id: "人前", label: "人前" },
  { id: "ガーデン", label: "ガーデン" },
  { id: "ホテル", label: "ホテル" },
  { id: "レストラン", label: "レストラン" },
];

const AREA_OPTIONS = [
  { id: "表参道", label: "表参道" },
  { id: "青山", label: "青山" },
  { id: "銀座", label: "銀座" },
  { id: "恵比寿", label: "恵比寿" },
  { id: "横浜", label: "横浜" },
  { id: "舞浜", label: "舞浜" },
];

const BUDGET_OPTIONS = [
  { id: "200", label: "〜200万" },
  { id: "300", label: "200〜300万" },
  { id: "400", label: "300〜400万" },
  { id: "500", label: "400〜500万" },
  { id: "over500", label: "500万〜" },
];

interface SettingsFormProps {
  initialConditions: {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };
}

function budgetToId(budget?: { min: number; max: number }): string[] {
  if (!budget) return [];
  if (budget.max <= 2000000) return ["200"];
  if (budget.max <= 3000000) return ["300"];
  if (budget.max <= 4000000) return ["400"];
  if (budget.max <= 5000000) return ["500"];
  return ["over500"];
}

const BUDGET_MAP: Record<string, { min: number; max: number }> = {
  "200": { min: 0, max: 2000000 },
  "300": { min: 2000000, max: 3000000 },
  "400": { min: 3000000, max: 4000000 },
  "500": { min: 4000000, max: 5000000 },
  over500: { min: 5000000, max: 99999999 },
};

export function SettingsForm({ initialConditions }: SettingsFormProps) {
  const [styles, setStyles] = useState<string[]>(
    initialConditions.style ?? []
  );
  const [guestCount, setGuestCount] = useState(
    initialConditions.guestCount?.toString() ?? ""
  );
  const [areas, setAreas] = useState<string[]>(initialConditions.area ?? []);
  const [budgetId, setBudgetId] = useState<string[]>(
    budgetToId(initialConditions.budget)
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    startTransition(async () => {
      const budget = budgetId[0] ? BUDGET_MAP[budgetId[0]] : undefined;
      const count = parseInt(guestCount, 10);

      const result = await saveOnboardingAnswers({
        style: styles.length > 0 ? styles : undefined,
        guestCount: count > 0 ? count : undefined,
        area: areas.length > 0 ? areas : undefined,
        budget,
      });

      if (result.success) {
        toast.success("残しました");
        router.refresh();
      } else {
        toast.error("うまく残せませんでした");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Style */}
      <div className="space-y-3">
        <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
          Style
        </p>
        <PillOptions
          options={STYLE_OPTIONS}
          selected={styles}
          onToggle={(id) =>
            setStyles((prev) =>
              prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
            )
          }
        />
      </div>

      {/* Guests — label + input on same row */}
      <div className="grid grid-cols-[96px_1fr] items-center gap-4">
        <p className="text-[12px] text-muted-foreground">ゲスト人数</p>
        <Input
          id="guests"
          type="number"
          inputMode="numeric"
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value)}
          placeholder="例: 80"
          className="h-11 max-w-[140px] tabular-nums"
        />
      </div>

      {/* Area */}
      <div className="space-y-3">
        <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
          Area
        </p>
        <PillOptions
          options={AREA_OPTIONS}
          selected={areas}
          onToggle={(id) =>
            setAreas((prev) =>
              prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
            )
          }
        />
      </div>

      {/* Budget */}
      <div className="space-y-3">
        <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
          Budget
        </p>
        <PillOptions
          options={BUDGET_OPTIONS}
          selected={budgetId}
          onToggle={(id) => setBudgetId([id])}
          multiSelect={false}
        />
      </div>

      <Button onClick={handleSave} disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            残しています…
          </>
        ) : (
          <>
            <Settings className="mr-2 h-4 w-4" />
            設定を整える
          </>
        )}
      </Button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

export interface PersonalizedConditions {
  styles?: string[];
  areas?: string[];
  guestCount?: number;
  budgetMax?: number;
}

interface Chip {
  key: keyof PersonalizedConditions;
  label: string;
  value?: string;
}

interface VenuePersonalizedChipsProps {
  conditions: PersonalizedConditions;
  /** When true, suppresses the section header and subtitle (used inside UnifiedFilterZone) */
  hideHeader?: boolean;
}

/**
 * Non-dismissable style badge row showing onboarding-derived filters applied to /explore.
 * Each chip's "×" removes only that condition from the URL.
 */
export function VenuePersonalizedChips({ conditions, hideHeader = false }: VenuePersonalizedChipsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const chips: Chip[] = [];
  if (conditions.styles?.length) {
    for (const s of conditions.styles) {
      chips.push({ key: "styles", label: `#${s}`, value: s });
    }
  }
  if (conditions.areas?.length) {
    for (const a of conditions.areas) {
      chips.push({ key: "areas", label: `#${a}`, value: a });
    }
  }
  if (typeof conditions.guestCount === "number") {
    chips.push({ key: "guestCount", label: `#ゲスト${conditions.guestCount}名` });
  }
  if (typeof conditions.budgetMax === "number" && conditions.budgetMax > 0) {
    const man = Math.round(conditions.budgetMax / 10000);
    chips.push({ key: "budgetMax", label: `#〜${man}万円` });
  }

  if (chips.length === 0) return null;

  const remove = (chip: Chip) => {
    const params = new URLSearchParams(window.location.search);

    // Freeze all currently-applied conditions into the URL before we flip
    // personalized=1. Previously the server only saw the key being
    // removed (e.g. `styles`), so as soon as `personalized=1` was set
    // the other onboarding-derived conditions (areas / guestCount /
    // budgetMax) silently dropped — that's the "押してないものまで
    // 消える" bug. Mirror the entire live condition set so the server
    // can apply it exactly as the user expects.
    if (conditions.styles?.length) {
      params.delete("styles");
      for (const v of conditions.styles) params.append("styles", v);
    }
    if (conditions.areas?.length) {
      params.delete("areas");
      for (const v of conditions.areas) params.append("areas", v);
    }
    if (typeof conditions.guestCount === "number") {
      params.set("guestCount", String(conditions.guestCount));
    }
    if (typeof conditions.budgetMax === "number" && conditions.budgetMax > 0) {
      params.set("budgetMax", String(conditions.budgetMax));
    }

    // Now apply the specific removal on top of the frozen set.
    if (chip.key === "styles" && chip.value) {
      const rest = (conditions.styles ?? []).filter((v) => v !== chip.value);
      params.delete("styles");
      for (const v of rest) params.append("styles", v);
    } else if (chip.key === "areas" && chip.value) {
      const rest = (conditions.areas ?? []).filter((v) => v !== chip.value);
      params.delete("areas");
      for (const v of rest) params.append("areas", v);
    } else {
      params.delete(chip.key);
    }
    // Mark that user touched personalization so server doesn't re-apply defaults.
    params.set("personalized", "1");
    startTransition(() => {
      // `scroll: false` — Next's default on route change is to scroll to
      // top, which felt disorienting when a chip was tapped mid-scroll.
      router.replace(
        `/explore${params.toString() ? `?${params.toString()}` : "?personalized=1"}`,
        { scroll: false },
      );
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="パーソナライズフィルタ"
      data-testid="personalized-chips"
    >
      {!hideHeader && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            絞り込み条件
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            オンボーディングの回答をもとに設定されています
          </span>
        </div>
      )}
      {chips.map((chip, idx) => (
        <button
          key={`${chip.key}-${chip.value ?? idx}`}
          type="button"
          disabled={isPending}
          onClick={() => remove(chip)}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs text-foreground transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <span>{chip.label}</span>
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

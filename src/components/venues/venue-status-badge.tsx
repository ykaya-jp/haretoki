"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

/** Maps DB status → 3-stage display label + color + plain-language explanation. */
const STATUS_CONFIG: Record<
  VenueStatus,
  { label: string; className: string; hint: string }
> = {
  // Stage 1: 気になる (interested) — default for new venues and until a visit happens
  researching: {
    label: "気になる",
    className:
      "bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
    hint: "まだ見学していない段階。見学を予約すると自動で進みます。",
  },
  visit_scheduled: {
    label: "気になる",
    className:
      "bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
    hint: "見学を予約中。見学を完了すると「検討中」に進みます。",
  },
  // Stage 2: 検討中 (considering) — after at least one visit
  visited: {
    label: "検討中",
    className:
      "bg-[color-mix(in_oklab,#3b82f6_10%,var(--background))] text-[color-mix(in_oklab,#3b82f6_75%,var(--foreground))]",
    hint: "見学済み。候補に入れて比較すると、最終決定に進めます。",
  },
  shortlisted: {
    label: "検討中",
    className:
      "bg-[color-mix(in_oklab,#3b82f6_10%,var(--background))] text-[color-mix(in_oklab,#3b82f6_75%,var(--foreground))]",
    hint: "候補に入っています。比較して決めましょう。",
  },
  // Stage 3: 決定
  selected: {
    label: "決定",
    className:
      "bg-[color-mix(in_oklab,var(--gold-warm)_20%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_90%,var(--foreground))] ring-1 ring-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)]",
    hint: "ここに決めた式場です。おめでとうございます。",
  },
  // 見送り
  rejected: {
    label: "見送り",
    className: "bg-destructive/10 text-destructive",
    hint: "見送った式場。いつでも戻せます。",
  },
};

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  const config = STATUS_CONFIG[status];

  // The DB status auto-transitions via visits / decisions — not a direct user
  // toggle. Tap reveals the rule so the label stops feeling like a mystery.
  // Couples kept asking "何で勝手に付いてるの？" — this answers inline.
  const handleTap = () => {
    toast(config.label, {
      description: config.hint,
      duration: 4500,
    });
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={`${config.label}の意味をみる`}
      className={cn(
        "inline-flex items-center rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm transition-transform active:scale-95",
        config.className,
      )}
    >
      {config.label}
    </button>
  );
}

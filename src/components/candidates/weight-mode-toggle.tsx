"use client";

import { User, Users } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * W13-1: two-state segmented toggle for候補 list ranking.
 *
 * Couples switch between "自分" (their own weights drive the ★) and
 * "二人の合成" (mean of both members' weights). The toggle is only
 * mounted when a partner exists — solo projects never see it.
 *
 * Design choices:
 *  - Pill-shaped with a sliding motion indicator, mirroring the main
 *    SegmentedControl but leaner (2 cells, iconography, no disabled state).
 *  - Icons (User / Users) carry the meaning when shrunk on 375px — the
 *    labels are concise enough to always fit side-by-side but we keep
 *    icons for scan-ability.
 *  - Full 44px min-height per tap target (touch guideline).
 */
export type WeightMode = "mine" | "couple";

interface WeightModeToggleProps {
  value: WeightMode;
  onChange: (mode: WeightMode) => void;
  /** Viewer's display name, shown as "あなた" fallback. */
  meName?: string | null;
  /** Partner display name, shown as fallback "パートナー". */
  partnerName?: string | null;
}

export function WeightModeToggle({
  value,
  onChange,
  meName,
  partnerName: _partnerName,
}: WeightModeToggleProps) {
  // Keep names short — on 375px the toggle row must fit without wrapping.
  // "自分（○○）" is ~7 JP chars max; partnerName unused for now but
  // accepted for future "合成（自分 × パートナー）" copy expansion.
  const mineLabel = meName ? "自分" : "自分";
  void _partnerName;

  const segments: { id: WeightMode; label: string; Icon: typeof User }[] = [
    { id: "mine", label: mineLabel, Icon: User },
    { id: "couple", label: "二人の合成", Icon: Users },
  ];

  return (
    <div
      role="tablist"
      aria-label="ランキングモード切替"
      className="relative flex w-full gap-1 rounded-full bg-muted p-1"
    >
      {segments.map((segment) => {
        const active = value === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(segment.id)}
            className={cn(
              "relative z-10 flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] transition-colors duration-200 active:scale-[0.97]",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.div
                layoutId="weight-mode-indicator"
                className="absolute inset-0 rounded-full bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              />
            )}
            <segment.Icon
              aria-hidden="true"
              className="relative z-10 h-3.5 w-3.5"
              strokeWidth={1.8}
            />
            <span className="relative z-10">{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}

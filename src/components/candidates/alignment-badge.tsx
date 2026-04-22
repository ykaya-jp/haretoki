import { Sparkles, MessageCircle } from "lucide-react";
import { alignmentBucket } from "@/lib/weighted-score";
import { cn } from "@/lib/utils";

/**
 * W13-1: couple opinion-alignment badge.
 *
 * Rendered above each VenueCard when the候補 tab is in "二人の合成" mode.
 * Communicates at a glance whether the two partners' weight vectors point
 * in the same direction for this shortlist context.
 *
 * Three buckets (see `alignmentBucket` for thresholds):
 *  - aligned  → gold chip "ふたりの視点がぴったり" + Sparkles icon
 *  - close    → subtle gold chip "おおむね一致"
 *  - discuss  → neutral chip "話し合いの余地" + MessageCircle icon
 *
 * Design contract: the chip is always 44px-min-target friendly when
 * interactive, but here it's purely informational (no tap), so we keep
 * it compact (28px tall) to avoid stealing visual weight from the venue
 * card below.
 *
 * Note: this is the couple-mode *overall* alignment — it's the same value
 * across every card in the list. We render it per-card anyway (or at the
 * top of the list — see integration) because it's cheap and keeps the
 * shortlist scrolling experience from having one lonely badge up top.
 */
interface AlignmentBadgeProps {
  score: number;
  /**
   * Optional compact flag — when true, renders without the descriptive
   * sub-line. Used per-card; the list-top hero uses the full version.
   */
  compact?: boolean;
}

export function AlignmentBadge({ score, compact = false }: AlignmentBadgeProps) {
  const bucket = alignmentBucket(score);

  const styles = {
    aligned: {
      chipClass:
        "bg-[color-mix(in_oklab,var(--gold-warm)_14%,transparent)] text-[color:var(--gold-warm)] border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)]",
      Icon: Sparkles,
      label: "ふたりの視点がぴったり",
      sub: "意見が揃っています",
    },
    close: {
      chipClass:
        "bg-[color-mix(in_oklab,var(--gold-warm)_6%,transparent)] text-[color:var(--gold-warm)] border-[color-mix(in_oklab,var(--gold-warm)_24%,transparent)]",
      Icon: Sparkles,
      label: "おおむね一致",
      sub: "方向性は近そうです",
    },
    discuss: {
      chipClass:
        "bg-muted text-muted-foreground border-border",
      Icon: MessageCircle,
      label: "話し合いの余地",
      sub: "優先順位が少し違います",
    },
  } as const;

  const style = styles[bucket];
  const Icon = style.Icon;

  return (
    <div
      aria-label={`ふたりの意見一致度 ${score} / 100 — ${style.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-[0.02em]",
        style.chipClass,
      )}
    >
      <Icon
        aria-hidden="true"
        className="h-3 w-3 shrink-0"
        strokeWidth={1.8}
      />
      <span className="leading-none">{style.label}</span>
      {!compact && (
        <>
          <span
            aria-hidden="true"
            className="opacity-40"
          >
            ·
          </span>
          <span className="tabular-nums opacity-70 leading-none">{score}</span>
        </>
      )}
    </div>
  );
}

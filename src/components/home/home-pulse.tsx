import Link from "next/link";
import { JourneyRing } from "@/components/home/journey-ring";
import { AnimatedPercentage } from "@/components/home/animated-percentage";

interface HomePulseProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
  percentage: number;
}

/**
 * HomePulse — 3-layer Home's middle band (~15% viewport).
 * Compact horizontal row: Journey Ring + Journey % + 3 metrics.
 * Replaces the EditorialHero metrics block.
 */
export function HomePulse(props: HomePulseProps) {
  // 用語統一 (CLAUDE.md 用語対応表):
  //   totalVenues   — "気になる" (= status researching 相当を含む全 Venue)
  //   visitedVenues — "見学済み"
  //   favoriteCount — "候補" (VenueFavorite = ハートで追加 = bottom-nav の候補タブと同一)
  // 旧 "本命 / 印象メモ" ラベルは用語対応表と衝突していたため削除。
  const metrics = [
    { label: "気になる", value: props.totalVenues },
    { label: "見学済み", value: props.visitedVenues },
    { label: "候補", value: props.favoriteCount },
  ];

  return (
    <section
      aria-label="ふたりの進捗"
      className="rounded-3xl border border-border/60 bg-card px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
    >
      <div className="flex items-center gap-3">
        {/* Tapping the ring navigates to the candidates list — the natural
            "next step" at any journey stage. prefetch={true} starts
            fetching as soon as this component mounts. */}
        <Link
          href="/candidates"
          prefetch={true}
          aria-label="候補一覧を見る"
          className="shrink-0 rounded-full transition-transform active:scale-[0.95]"
        >
          <JourneyRing
            totalVenues={props.totalVenues}
            visitedVenues={props.visitedVenues}
            favoriteCount={props.favoriteCount}
            hasDecision={props.hasDecision}
            upcomingVisits={props.upcomingVisits}
          />
        </Link>
        <div className="flex-1 border-l border-border/40 pl-3">
          <div className="grid grid-cols-3 divide-x divide-border/40">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center leading-tight px-2 first:pl-0 last:pr-0"
              >
                <span className="font-[family-name:var(--font-display)] font-light tabular-nums text-[24px] text-foreground">
                  {m.value}
                </span>
                <span className="mt-0.5 text-fluid-xs font-medium tracking-[0.04em] text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            Journey <AnimatedPercentage value={props.percentage} />
          </p>
        </div>
      </div>
    </section>
  );
}

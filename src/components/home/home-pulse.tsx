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
  const metrics = [
    { label: "気になる", value: props.totalVenues },
    { label: "印象メモ", value: props.visitedVenues },
    { label: "本命", value: props.favoriteCount },
  ];

  return (
    <section
      aria-label="ふたりの進捗"
      className="rounded-3xl border border-border/60 bg-card px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
    >
      <div className="flex items-center gap-3">
        <JourneyRing
          totalVenues={props.totalVenues}
          visitedVenues={props.visitedVenues}
          favoriteCount={props.favoriteCount}
          hasDecision={props.hasDecision}
          upcomingVisits={props.upcomingVisits}
        />
        <div className="flex-1 border-l border-border/40 pl-3">
          <div className="grid grid-cols-3 divide-x divide-border/40">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center leading-tight px-2 first:pl-0 last:pr-0"
              >
                <span className="font-[family-name:var(--font-display)] font-light tabular-nums text-[22px] text-foreground">
                  {m.value}
                </span>
                <span className="mt-0.5 text-[10px] tracking-[0.08em] text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-[10.5px] tracking-[0.12em] uppercase text-muted-foreground">
            Journey <AnimatedPercentage value={props.percentage} />
          </p>
        </div>
      </div>
    </section>
  );
}

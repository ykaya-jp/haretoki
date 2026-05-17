import { Sun, CloudSun, Cloud } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { AlignmentBadge } from "@/components/candidates/alignment-badge";
import type { CoupleVenueScore, Weather } from "@/lib/scoring";

// Release β B-1 — "二人の合意" consensus card sitting at the top of
// /venues/[id]. Pure presentational Server Component: the caller fetches
// `CoupleVenueScore` (own + partner ratings already aggregated via
// computeCoupleVenueScore) and hands it in. Tap-to-expand into the
// existing PartnerComparisonSummary is wired by the page, not here, so
// this stays free of "use client" and renders on the server.

interface CoupleConsensusCardProps {
  score: CoupleVenueScore;
  ownName?: string;
  partnerName?: string;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const WEATHER_META: Record<
  Weather,
  { Icon: IconComponent; label: string; iconClass: string }
> = {
  sun: {
    Icon: Sun,
    label: "晴れの日",
    iconClass: "text-[var(--gold-warm)]",
  },
  "cloud-sun": {
    Icon: CloudSun,
    label: "晴れ間",
    iconClass: "text-[color-mix(in_oklab,var(--gold-warm)_70%,var(--muted-foreground))]",
  },
  cloud: {
    Icon: Cloud,
    label: "曇り",
    iconClass: "text-muted-foreground",
  },
};

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function StarBar({ score }: { score: number | null }) {
  // 10-dot bar (0.5-star granularity on a 0-5 scale). Pure CSS so the
  // card stays Server-renderable. Filled count = round(score * 2).
  const filled =
    score === null ? 0 : Math.max(0, Math.min(10, Math.round(score * 2)));
  return (
    <div
      className="flex gap-0.5"
      aria-label={
        score === null ? "未評価" : `スコア ${score.toFixed(1)} / 5.0`
      }
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled ? "bg-[var(--gold-warm)]" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

export function CoupleConsensusCard({
  score,
  ownName = "あなた",
  partnerName = "配偶者",
}: CoupleConsensusCardProps) {
  const {
    overall,
    alignment,
    weather,
    agreedDimensions,
    discussDimensions,
    byDimension,
  } = score;
  const meta = WEATHER_META[weather];
  const WeatherIcon = meta.Icon;

  // Per-side overall: mean across the dimensions that side actually
  // rated. Different from the couple-`overall`, which already averages
  // own + partner per dim before meaning over dims. Showing both sides
  // separately lets the couple see who pulled the joint score where.
  const ownMean = mean(
    byDimension.map((d) => d.own).filter((v): v is number => v !== null),
  );
  const partnerMean = mean(
    byDimension.map((d) => d.partner).filter((v): v is number => v !== null),
  );

  return (
    <section
      aria-label="二人の合意"
      className="rounded-[var(--r-lg)] bg-[var(--bg-card)] px-6 py-7 shadow-[var(--shadow-card)]"
    >
      <header className="flex items-center gap-2">
        <WeatherIcon
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0", meta.iconClass)}
          strokeWidth={1.6}
        />
        <p className="text-meta tracking-[0.12em] uppercase text-muted-foreground">
          二人の合意 — {meta.label}
        </p>
      </header>

      <div className="mt-4 flex items-baseline gap-3">
        <p
          aria-label={
            overall === null
              ? "総合スコア 未評価"
              : `総合スコア ${overall.toFixed(1)}`
          }
          className="font-[family-name:var(--font-display)] text-5xl font-extralight tabular-nums tracking-tight text-foreground"
        >
          {overall === null ? "—" : overall.toFixed(1)}
        </p>
        <p className="text-meta text-muted-foreground">/ 5.0</p>
      </div>

      <div className="mt-3">
        <AlignmentBadge score={alignment} compact />
      </div>

      <hr className="my-5 border-t border-[var(--gold-subtle)]/40" />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-meta text-muted-foreground">
            {ownName}
          </span>
          <StarBar score={ownMean} />
          <span className="ml-auto tabular-nums text-[13px] text-foreground">
            {ownMean === null ? "—" : ownMean.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-meta text-muted-foreground">
            {partnerName}
          </span>
          <StarBar score={partnerMean} />
          <span className="ml-auto tabular-nums text-[13px] text-foreground">
            {partnerMean === null ? "—" : partnerMean.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="mt-5 text-meta text-muted-foreground">
        一致した次元{" "}
        <span className="tabular-nums text-foreground">
          {agreedDimensions.length}
        </span>
        <span aria-hidden="true" className="mx-2 opacity-30">
          ·
        </span>
        話し合う次元{" "}
        <span className="tabular-nums text-foreground">
          {discussDimensions.length}
        </span>
      </p>
    </section>
  );
}

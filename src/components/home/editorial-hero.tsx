"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { JourneyRing } from "@/components/home/journey-ring";
import { HeroNBA } from "@/components/home/hero-nba";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface EditorialHeroProps {
  userName: string;
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
  percentage: number;
  /** Server-rendered JST date label (eg. "2026 APR 15"). Avoids client clock
   *  divergence and the previous useSyncExternalStore infinite-loop bug. */
  dateLabel?: string;
  timeOfDayLabel?: string;
  /**
   * When true, DailyRitual is shown above and already covers eyebrow +
   * headline + sub. EditorialHero collapses to metrics + Journey Ring + NBA.
   */
  compact?: boolean;
  /** Forwarded to HeroNBA for single-venue deep-link to /venues/<id>#visit. */
  firstVenueId?: string | null;
}

type StageKey = "start" | "adding" | "visiting" | "comparing" | "decided";

interface StageContent {
  key: StageKey;
  stageLabel: string;
  headline: string;
  sub: (p: EditorialHeroProps) => string;
  sky: "cloud" | "cloud-sun" | "sun" | "sun-rays";
}

function stageOf(p: EditorialHeroProps): StageContent {
  if (p.hasDecision)
    return {
      key: "decided",
      stageLabel: "晴れの日へ",
      headline: "ここから、当日の準備へ",
      sub: () => "あとは準備を、ゆっくりと",
      sky: "sun-rays",
    };
  if (p.favoriteCount >= 2)
    return {
      key: "comparing",
      stageLabel: "比較中",
      headline: "ふたりで並べて、見比べてみましょう",
      sub: (x) => `本命 ${x.favoriteCount} 件。比べるほど、輪郭が見えてきます`,
      sky: "sun",
    };
  if (p.visitedVenues >= 1)
    return {
      key: "visiting",
      stageLabel: "見学中",
      headline: "印象を、忘れないうちに。",
      sub: () => "気になったこと、写真と一緒に残しておきましょう",
      sky: "cloud-sun",
    };
  if (p.totalVenues >= 1)
    return {
      key: "adding",
      stageLabel: "式場さがし",
      headline: "少しずつ、見えてきました。",
      sub: () => "最初の見学を入れてみませんか。当日のメモも残せます",
      sky: "cloud-sun",
    };
  return {
    key: "start",
    stageLabel: "はじめる",
    headline: "まだ見ぬ、あの一日へ。",
    sub: () => "URL を貼るだけ。あとは晴れ時がそっと集めます",
    sky: "cloud",
  };
}

/** Brand "sky chip" — a small circular illustration evoking 曇り→晴れ間→晴れ. */
function SkyChip({ mood }: { mood: StageContent["sky"] }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{
        background:
          "radial-gradient(120% 120% at 30% 20%, oklch(0.95 0.04 75) 0%, oklch(0.92 0.06 65) 40%, oklch(0.86 0.08 55) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(201,164,76,0.12), 0 6px 16px rgba(201,164,76,0.18)",
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        {mood === "cloud" && (
          <g>
            <circle cx="12" cy="17" r="5" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <circle cx="19" cy="15" r="6" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <ellipse cx="15" cy="20" rx="9" ry="4" fill="oklch(0.98 0.01 75)" opacity="0.95" />
          </g>
        )}
        {mood === "cloud-sun" && (
          <g>
            <circle cx="21" cy="11" r="5" fill="oklch(0.85 0.14 80)" />
            <g stroke="oklch(0.85 0.14 80)" strokeWidth="1.2" strokeLinecap="round">
              <line x1="21" y1="3" x2="21" y2="5" />
              <line x1="27.5" y1="4.5" x2="26.2" y2="5.8" />
              <line x1="29" y1="11" x2="27" y2="11" />
            </g>
            <ellipse cx="13" cy="20" rx="10" ry="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="9" cy="18" r="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="16" cy="17" r="5.5" fill="oklch(0.99 0.005 80)" />
          </g>
        )}
        {mood === "sun" && (
          <g>
            <circle cx="16" cy="16" r="6" fill="oklch(0.80 0.16 80)" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="oklch(0.80 0.16 80)" strokeOpacity="0.35" strokeWidth="1" />
          </g>
        )}
        {mood === "sun-rays" && (
          <g>
            <circle cx="16" cy="16" r="5" fill="oklch(0.78 0.17 80)" />
            <g stroke="oklch(0.78 0.17 80)" strokeWidth="1.4" strokeLinecap="round">
              <line x1="16" y1="3" x2="16" y2="6" />
              <line x1="16" y1="26" x2="16" y2="29" />
              <line x1="3" y1="16" x2="6" y2="16" />
              <line x1="26" y1="16" x2="29" y2="16" />
              <line x1="7" y1="7" x2="9" y2="9" />
              <line x1="23" y1="23" x2="25" y2="25" />
              <line x1="7" y1="25" x2="9" y2="23" />
              <line x1="23" y1="9" x2="25" y2="7" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

export function EditorialHero(props: EditorialHeroProps) {
  const date = props.dateLabel ?? "";
  const timeOfDay = props.timeOfDayLabel ?? "";
  const stage = stageOf(props);
  const prefersReduced = useReducedMotion();

  const metrics = [
    { label: "気になる", value: props.totalVenues },
    { label: "印象メモ", value: props.visitedVenues },
    { label: "本命", value: props.favoriteCount },
  ];

  const compact = props.compact === true;

  return (
    <motion.section
      aria-label="ふたりの進捗とおすすめアクション"
      className="relative"
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
    >
      {!compact && (
        <>
          {/* Top row: eyebrow + sky chip */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2.5">
              {/* Publication-style masthead eyebrow */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-eyebrow text-muted-foreground">
                <span className="font-medium text-foreground">HARETOKI</span>
                <span aria-hidden="true" className="opacity-30">·</span>
                <span className="tabular-nums">{date || "\u00a0"}</span>
                {timeOfDay && (
                  <>
                    <span aria-hidden="true" className="opacity-30">·</span>
                    <span className="normal-case tracking-normal text-[12px]">{timeOfDay}</span>
                  </>
                )}
                <span className="ml-1 inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-eyebrow text-muted-foreground">
                  {stage.stageLabel}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground">
                {timeOfDay === "朝" ? "おはようございます" : timeOfDay === "夕" || timeOfDay === "夜" ? "こんばんは" : "こんにちは"}、
                <span className="text-foreground">{props.userName}</span>さん
              </p>
            </div>
            <SkyChip mood={stage.sky} />
          </div>

          {/* Headline — mincho, light, editorial */}
          <h1 className="mt-5 font-[family-name:var(--font-display)] font-light leading-[1.22] tracking-[-0.01em] text-fluid-3xl text-foreground">
            {stage.headline}
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {stage.sub(props)}
          </p>
        </>
      )}

      {compact && (
        // Compact mode: DailyRitual covers the headline above. Show only a
        // tiny stage label as a connector to the metrics block.
        <p className="mb-3 inline-flex items-center gap-2 text-eyebrow text-muted-foreground">
          <span className="text-foreground">{stage.stageLabel}</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>進捗</span>
        </p>
      )}

      {/* Hairline — full mode only. Viz Phase 1: gold gradient → neutral hairline。 */}
      {!compact && (
        <div aria-hidden="true" className="mt-7 h-px w-full bg-border/60" />
      )}

      {/* Metrics block — Journey Ring (72px) + 3 metrics grid.
          Viz Phase 1: gold/primary グラデ背景 → card 色に統一。 */}
      <div
        className={cn(
          "rounded-3xl bg-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
          compact ? "mt-2" : "mt-5",
        )}
      >
        {/* Row 1: Journey Ring (72px) — full mode only. Replaces JourneyRingSm. */}
        {!compact && (
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <JourneyRing
                totalVenues={props.totalVenues}
                visitedVenues={props.visitedVenues}
                favoriteCount={props.favoriteCount}
                hasDecision={props.hasDecision}
                upcomingVisits={props.upcomingVisits}
              />
              <div className="leading-tight">
                <div className="text-eyebrow text-muted-foreground">
                  Journey
                </div>
                <div className="font-[family-name:var(--font-display)] tabular-nums text-[17px] font-light text-foreground">
                  {props.percentage}
                  <span className="ml-0.5 text-[11px] text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <p className="max-w-[50%] text-right text-[11.5px] leading-relaxed text-muted-foreground/80">
              {stage.stageLabel}
            </p>
          </div>
        )}

        {/* Row 2: 3 metrics grid */}
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
      </div>

      {/* Hero NBA — separated component per H-1 spec (§2.3).
          Shown in full mode only; compact mode uses DailyRitual's CTA. */}
      {!compact && (
        <div className="mt-6">
          <HeroNBA
            totalVenues={props.totalVenues}
            visitedVenues={props.visitedVenues}
            favoriteCount={props.favoriteCount}
            hasDecision={props.hasDecision}
            firstVenueId={props.firstVenueId}
          />
        </div>
      )}
    </motion.section>
  );
}

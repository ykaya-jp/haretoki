"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface EditorialHeroProps {
  userName: string;
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
  percentage: number;
  /**
   * When true, DailyRitual is shown above and already covers eyebrow +
   * headline + sub. EditorialHero collapses to metrics + primary CTA only.
   */
  compact?: boolean;
}

type StageKey = "start" | "adding" | "visiting" | "comparing" | "decided";

interface StageContent {
  key: StageKey;
  stageLabel: string;
  headline: string;
  sub: (p: EditorialHeroProps) => string;
  sky: "cloud" | "cloud-sun" | "sun" | "sun-rays";
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

function stageOf(p: EditorialHeroProps): StageContent {
  if (p.hasDecision)
    return {
      key: "decided",
      stageLabel: "晴れの日へ",
      headline: "晴れの日が、近づいています。",
      sub: () => "あとは準備を、ゆっくりと",
      sky: "sun-rays",
      primary: { label: "決めた式場を見る", href: "/candidates" },
    };
  if (p.favoriteCount >= 2)
    return {
      key: "comparing",
      stageLabel: "比較中",
      headline: "ふたりで、並べてみよう。",
      sub: (x) => `本命 ${x.favoriteCount} 件。比べるほど、輪郭が見えてきます`,
      sky: "sun",
      primary: { label: "比べてみる", href: "/candidates" },
    };
  if (p.visitedVenues >= 1)
    return {
      key: "visiting",
      stageLabel: "見学中",
      headline: "印象を、忘れないうちに。",
      sub: () => "気になったこと、写真と一緒に残しておきましょう",
      sky: "cloud-sun",
      primary: { label: "印象を残す", href: "/candidates" },
    };
  if (p.totalVenues >= 1)
    return {
      key: "adding",
      stageLabel: "式場さがし",
      headline: "少しずつ、見えてきました。",
      sub: () => "次は、見学の日取りを入れてみませんか？",
      sky: "cloud-sun",
      primary: { label: "見学を入れる", href: "/candidates" },
    };
  return {
    key: "start",
    stageLabel: "はじめる",
    headline: "まだ見ぬ、あの一日へ。",
    sub: () => "URL を貼るだけ。あとは晴れ時がそっと集めます",
    sky: "cloud",
    primary: { label: "URL から追加", href: "/explore" },
    secondary: { label: "式場を探してみる", href: "/explore" },
  };
}

const subscribe = () => () => {};
const getDateSnapshot = () => new Date().getTime();
const getServerSnapshot = () => 0;

function formatJaDate(ts: number) {
  if (ts === 0) return { date: "", timeOfDay: "" };
  const d = new Date(ts);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const date = `${d.getFullYear()} ${months[d.getMonth()]} ${d.getDate()}`;
  const h = d.getHours();
  const timeOfDay = h < 5 ? "夜" : h < 11 ? "朝" : h < 15 ? "昼" : h < 18 ? "午後" : h < 22 ? "夕" : "夜";
  return { date, timeOfDay };
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

function JourneyRingSm({ percentage }: { percentage: number }) {
  const size = 40;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percentage / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold-warm)" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        stroke="url(#ringg)"
      />
    </svg>
  );
}

export function EditorialHero(props: EditorialHeroProps) {
  const ts = useSyncExternalStore(subscribe, getDateSnapshot, getServerSnapshot);
  const { date, timeOfDay } = formatJaDate(ts);
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] tracking-[0.16em] uppercase text-muted-foreground">
                <span className="tabular-nums">{date || "\u00a0"}</span>
                {timeOfDay && (
                  <>
                    <span aria-hidden="true" className="opacity-30">·</span>
                    <span className="normal-case tracking-normal text-[12px]">{timeOfDay}</span>
                  </>
                )}
                <span
                  className="ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] tracking-[0.12em] uppercase"
                  style={{
                    background: "var(--gold-subtle)",
                    color: "var(--gold-warm)",
                  }}
                >
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

          {/* Headline — mincho, light, editorial but warmer */}
          <h1 className="mt-5 font-[family-name:var(--font-display)] font-extralight leading-[1.22] tracking-[-0.01em] text-fluid-3xl text-foreground">
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
        <p className="mb-3 inline-flex items-center gap-2 text-[10.5px] tracking-[0.14em] uppercase text-muted-foreground">
          <span className="text-[var(--gold-warm)]">{stage.stageLabel}</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>進捗</span>
        </p>
      )}

      {/* Gradient hairline (fade in → fade out) — only in full mode */}
      {!compact && (
        <div
          aria-hidden="true"
          className="mt-7 h-px w-full"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 30%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 70%, transparent 100%)",
          }}
        />
      )}

      {/* Metrics block — soft gradient-noon background, rounded, gentle */}
      <div
        className="mt-5 rounded-3xl p-4"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 5%, var(--background)) 0%, color-mix(in oklab, var(--primary) 3%, var(--background)) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* In compact mode the DailyRitual above already shows the weather
              SkyChip; the percentage ring would be visually redundant
              (R-1: 進捗リング → 天気アイコン化 = sky chip already covers it). */}
          {!compact && (
            <div className="flex items-center gap-2">
              <JourneyRingSm percentage={props.percentage} />
              <div className="leading-tight">
                <div className="text-[10.5px] tracking-[0.12em] uppercase text-muted-foreground">Progress</div>
                <div className="font-[family-name:var(--font-display)] tabular-nums text-[15px] text-foreground">
                  {props.percentage}%
                </div>
              </div>
            </div>
          )}
          <div className="ml-auto flex gap-5 text-right">
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col items-end leading-tight">
                <span className="font-[family-name:var(--font-display)] font-extralight tabular-nums text-[22px] text-foreground">
                  {m.value}
                </span>
                <span className="mt-0.5 text-[10px] tracking-[0.08em] text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary CTA — rounded 14px, gentle gold halo */}
      <div className="mt-6 flex flex-col gap-2.5">
        <HaloTap className="w-full rounded-[14px]">
          <Link
            href={stage.primary.href}
            prefetch={true}
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "w-full justify-center rounded-[14px] text-[14.5px] font-medium tracking-wide",
            )}
            style={{
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.08), 0 8px 24px color-mix(in oklab, var(--gold-warm) 18%, transparent)",
            }}
          >
            {stage.primary.label}
          </Link>
        </HaloTap>
        {stage.secondary && (
          <Link
            href={stage.secondary.href}
            prefetch={true}
            className="text-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            {stage.secondary.label}
          </Link>
        )}
      </div>
    </motion.section>
  );
}

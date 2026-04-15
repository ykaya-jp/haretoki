"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Cloud, CloudSun, Sun } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";

interface EditorialHeroProps {
  userName: string;
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
  percentage: number;
}

type StageKey = "start" | "adding" | "visiting" | "comparing" | "decided";

interface StageContent {
  key: StageKey;
  headline: string;
  sub: string;
  weather: typeof Cloud;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

function stageOf(p: EditorialHeroProps): StageContent {
  if (p.hasDecision)
    return {
      key: "decided",
      headline: "晴れの日へ、ふたりで。",
      sub: "決めた式場の準備をゆっくり進めていきましょう",
      weather: Sun,
      primary: { label: "決めた式場を見る", href: "/candidates" },
    };
  if (p.favoriteCount >= 2)
    return {
      key: "comparing",
      headline: "並べて、見比べてみる。",
      sub: `候補 ${p.favoriteCount} 件、比べるほど輪郭が見えてきます`,
      weather: Sun,
      primary: { label: "比べる", href: "/candidates" },
    };
  if (p.visitedVenues >= 1)
    return {
      key: "visiting",
      headline: "見学の印象を、残す。",
      sub: "忘れないうちにメモと写真を置いておきましょう",
      weather: CloudSun,
      primary: { label: "印象を残す", href: "/candidates" },
    };
  if (p.totalVenues >= 1)
    return {
      key: "adding",
      headline: "最初の一歩を入れる。",
      sub: "気になる式場の見学日を決めてみませんか",
      weather: CloudSun,
      primary: { label: "見学を入れる", href: "/candidates" },
    };
  return {
    key: "start",
    headline: "気になる式場を置く。",
    sub: "URL を貼るだけで、自動で情報を集めます",
    weather: Cloud,
    primary: { label: "URL から追加", href: "/explore" },
    secondary: { label: "式場を探してみる", href: "/explore" },
  };
}

const subscribe = () => () => {};
const getDateSnapshot = () => {
  const d = new Date();
  return d.getTime();
};
const getServerSnapshot = () => 0;

function formatJaDate(ts: number): { eyebrow: string; greetingKey: "morning" | "day" | "evening" | "neutral" } {
  if (ts === 0) return { eyebrow: "", greetingKey: "neutral" };
  const d = new Date(ts);
  const y = d.getFullYear();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const m = months[d.getMonth()];
  const day = d.getDate();
  const hour = d.getHours();
  const greetingKey = hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
  return { eyebrow: `${y} · ${m} · ${day}`, greetingKey };
}

function JourneyRingSm({ percentage }: { percentage: number }) {
  const size = 36;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percentage / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
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
        stroke="var(--gold-warm)"
      />
    </svg>
  );
}

export function EditorialHero(props: EditorialHeroProps) {
  const ts = useSyncExternalStore(subscribe, getDateSnapshot, getServerSnapshot);
  const { eyebrow, greetingKey } = formatJaDate(ts);
  const stage = stageOf(props);
  const Weather = stage.weather;
  const greeting =
    greetingKey === "morning" ? "おはようございます" :
    greetingKey === "evening" ? "こんばんは" :
    greetingKey === "day" ? "こんにちは" : "";

  const metrics = [
    { label: "候補", value: props.totalVenues },
    { label: "評価済", value: props.visitedVenues },
    { label: "お気に入り", value: props.favoriteCount },
  ];

  return (
    <section aria-label="今日のおすすめアクション">
      {/* Eyebrow: date + weather */}
      <div className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        <Weather className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        <span className="tabular-nums">{eyebrow || "\u00a0"}</span>
        {greeting && (
          <>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>{greeting}、{props.userName}さん</span>
          </>
        )}
      </div>

      {/* Headline: mincho light, editorial */}
      <h1 className="mt-3 font-[family-name:var(--font-display)] font-extralight leading-tight tracking-[-0.01em] text-fluid-3xl">
        {stage.headline}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{stage.sub}</p>

      {/* Thin gold hairline separator */}
      <div
        aria-hidden="true"
        className="mt-6 h-px w-full"
        style={{ background: "color-mix(in oklab, var(--gold-warm) 30%, transparent)" }}
      />

      {/* Metrics row + ring */}
      <div className="mt-4 flex items-center gap-5">
        <div className="flex items-center gap-2">
          <JourneyRingSm percentage={props.percentage} />
          <span className="text-xs text-muted-foreground">
            決定まで{" "}
            <span className="tabular-nums text-foreground">{props.percentage}%</span>
          </span>
        </div>
        <div className="ml-auto flex gap-4 text-right">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col items-end leading-tight">
              <span className="font-[family-name:var(--font-display)] font-extralight tabular-nums text-2xl">
                {m.value}
              </span>
              <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Primary action — flat, no card frame */}
      <div className="mt-7 flex flex-col gap-3">
        <HaloTap className="w-full rounded-lg">
          <Link
            href={stage.primary.href}
            prefetch={true}
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "w-full justify-center",
            )}
          >
            {stage.primary.label}
          </Link>
        </HaloTap>
        {stage.secondary && (
          <Link
            href={stage.secondary.href}
            prefetch={true}
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {stage.secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}

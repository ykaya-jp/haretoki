"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SkyChip, weatherLabel } from "@/components/home/sky-chip";
import { markRitualSeen, markRitualActed, type DailyRitualView } from "@/server/actions/ritual";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface DailyRitualProps {
  ritual: DailyRitualView;
  /** Today's JST date label, e.g. "2026 APR 16". Built server-side to avoid
   *  hydration drift when the day rolls over. */
  todayLabel: string;
  /** "朝" / "昼" / "夕" / "夜" — server-rendered to keep SSR stable. */
  timeOfDayLabel: string;
}

export function DailyRitual({ ritual, todayLabel, timeOfDayLabel }: DailyRitualProps) {
  const prefersReduced = useReducedMotion();
  const seenRef = useRef(false);

  // Fire-and-forget telemetry. The Server Action is best-effort; failures
  // are swallowed inside markRitualSeen.
  useEffect(() => {
    if (seenRef.current) return;
    seenRef.current = true;
    void markRitualSeen();
  }, []);

  return (
    <motion.section
      aria-label="今日の一言"
      className="relative mb-2"
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10.5px] tracking-[0.16em] uppercase text-muted-foreground">
            <span className="tabular-nums">{todayLabel}</span>
            <span aria-hidden="true" className="opacity-30">
              ·
            </span>
            <span className="normal-case tracking-normal text-[12px]">
              {timeOfDayLabel}
            </span>
            <span aria-hidden="true" className="opacity-30">
              ·
            </span>
            <span className="normal-case tracking-normal text-[12px] text-[var(--gold-warm)]">
              {weatherLabel(ritual.weather)}
            </span>
          </p>

          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-fluid-3xl font-extralight leading-[1.22] tracking-[-0.005em] text-foreground"
          >
            {ritual.headline}
          </h1>

          {ritual.mood && (
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
              {ritual.mood}
            </p>
          )}
        </div>

        <SkyChip mood={ritual.weather} size={64} />
      </div>

      {ritual.ctaHref && ritual.ctaLabel && (
        <Link
          href={ritual.ctaHref}
          prefetch={true}
          onClick={() => void markRitualActed()}
          className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--gold-warm)] transition-opacity hover:opacity-80 underline-offset-4 hover:underline"
        >
          {ritual.ctaLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      )}

      {ritual.fallback && (
        <p
          aria-hidden="true"
          className="mt-3 text-[10.5px] text-muted-foreground/70"
        >
          今日はそっと、静かに。
        </p>
      )}

      {/* Editorial hairline — gold が左右にフェードする細い罫線。magazine 的な
          余白のリズムをつくる。次のブロックとの呼吸を保つため mt を控えめに。*/}
      <div
        aria-hidden="true"
        className="mt-6 h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 30%, transparent) 35%, color-mix(in oklab, var(--gold-warm) 30%, transparent) 65%, transparent 100%)",
        }}
      />
    </motion.section>
  );
}

export function DailyRitualSkeleton() {
  return (
    <div className="mb-2 animate-pulse" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-44 rounded bg-muted" />
          <div className="h-7 w-3/4 rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
        <div className="h-16 w-16 rounded-full bg-muted" />
      </div>
    </div>
  );
}

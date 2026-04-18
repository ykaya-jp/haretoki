"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { weatherLabel } from "@/components/home/sky-chip";
import { markRitualSeen } from "@/server/actions/ritual";
import type { DailyRitualView } from "@/server/actions/ritual";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface HomeWhisperProps {
  ritual: DailyRitualView;
}

/**
 * HomeWhisper — 3-layer Home's bottom band (~15% viewport).
 * A single-line "今日の一言" echo. Cover already shows ritual.headline, so
 * Whisper surfaces mood + weather as a subtle, decorative tail — no CTA.
 */
export function HomeWhisper({ ritual }: HomeWhisperProps) {
  const prefersReduced = useReducedMotion();
  const seenRef = useRef(false);

  useEffect(() => {
    if (seenRef.current) return;
    seenRef.current = true;
    void markRitualSeen();
  }, []);

  const body = ritual.mood ?? ritual.headline;

  return (
    <motion.section
      aria-label="今日の一言"
      className="relative"
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE, delay: 0.1 }}
    >
      <div aria-hidden="true" className="mb-5 h-px w-full bg-border/60" />
      <p className="flex items-center gap-2 text-eyebrow text-muted-foreground">
        <span>今日の空</span>
        <span aria-hidden="true" className="opacity-30">·</span>
        <span className="normal-case tracking-normal text-[12px] text-foreground">
          {weatherLabel(ritual.weather)}
        </span>
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {ritual.fallback && (
        <p aria-hidden="true" className="mt-2 text-[10.5px] text-muted-foreground/70">
          今日はそっと、静かに。
        </p>
      )}
    </motion.section>
  );
}

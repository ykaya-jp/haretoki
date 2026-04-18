"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { SkyChip } from "@/components/home/sky-chip";
import { buttonVariants } from "@/components/ui/button";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";
import type { Weather } from "@/lib/prompts/ritual";
import { markRitualActed } from "@/server/actions/ritual";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

interface CoverVenue {
  id: string;
  name: string;
  photoUrls: string[];
}

export interface HomeCoverProps {
  /** Editorial masthead eyebrow: "HARETOKI · 2026 APR 18 · 朝" etc. */
  dateLabel: string;
  timeOfDayLabel: string;
  userName: string;
  /** Large mincho headline. Prefer ritual.headline, else stage-derived. */
  headline: string;
  /** One-line sub beneath headline. */
  sub: string;
  /** Journey weather mood — drives SkyChip illustration. */
  weather: Weather;
  /** Primary CTA. Anchored below photo as the single next-best-action. */
  ctaLabel: string;
  ctaHref: string;
  /** Hero photo. When absent, Cover falls back to an abstract gradient. */
  coverVenue?: CoverVenue | null;
  /** Fire telemetry when user acts on the primary CTA (ritual-derived only). */
  isRitualCta?: boolean;
}

/**
 * HomeCover — the 3-layer Home's first screen (~70% viewport).
 * Full-bleed 4:5 photo + mincho headline + SkyChip 96 + single CTA.
 * Replaces the stacked EditorialHero full-mode + DailyRitual headline.
 */
export function HomeCover({
  dateLabel,
  timeOfDayLabel,
  userName,
  headline,
  sub,
  weather,
  ctaLabel,
  ctaHref,
  coverVenue,
  isRitualCta = false,
}: HomeCoverProps) {
  const prefersReduced = useReducedMotion();
  const greeting =
    timeOfDayLabel === "朝"
      ? "おはようございます"
      : timeOfDayLabel === "夕" || timeOfDayLabel === "夜"
        ? "こんばんは"
        : "こんにちは";

  const photoUrl = coverVenue?.photoUrls?.[0] ?? null;

  return (
    <motion.section
      aria-label="今日のカバー"
      className="relative -mx-5 sm:-mx-8"
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: LUXURY_EASE }}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={coverVenue?.name ?? ""}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(130% 90% at 30% 15%, oklch(0.95 0.03 80) 0%, oklch(0.90 0.05 70) 45%, oklch(0.82 0.07 60) 100%)",
            }}
          />
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(20,16,12,0.25) 0%, rgba(20,16,12,0) 30%, rgba(20,16,12,0) 55%, rgba(20,16,12,0.78) 100%)",
          }}
        />

        <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-eyebrow text-white/80">
            <span className="font-medium text-white">HARETOKI</span>
            <span aria-hidden="true" className="opacity-50">·</span>
            <span className="tabular-nums">{dateLabel}</span>
            {timeOfDayLabel && (
              <>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span className="normal-case tracking-normal text-[12px]">
                  {timeOfDayLabel}
                </span>
              </>
            )}
          </div>
          <SkyChip mood={weather} size={96} />
        </div>

        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-[12.5px] text-white/70">
            {greeting}、<span className="text-white">{userName}</span>さん
          </p>
          <h1
            className={cn(
              "mt-2 font-[family-name:var(--font-display)] font-light tracking-[-0.01em] text-white",
              "text-[clamp(2rem,1.4rem+3vw,3.25rem)] leading-[1.15]",
            )}
          >
            {headline}
          </h1>
          {sub && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
              {sub}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        <HaloTap className="w-full rounded-[14px]">
          <Link
            href={ctaHref}
            prefetch={true}
            onClick={isRitualCta ? () => void markRitualActed() : undefined}
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "w-full justify-center rounded-[14px] text-[14.5px] font-medium tracking-wide",
            )}
            style={{
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.08), 0 8px 24px color-mix(in oklab, var(--primary) 18%, transparent)",
            }}
          >
            {ctaLabel}
          </Link>
        </HaloTap>
      </div>
    </motion.section>
  );
}

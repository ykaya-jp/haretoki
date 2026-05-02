"use client";

import Image from "next/image";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { useEffect, useRef } from "react";
import { SkyChip, weatherLabel } from "@/components/home/sky-chip";
import { buttonVariants } from "@/components/ui/button";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";
import { isLikelyAssetUrl } from "@/lib/url-import/extract-images";
import type { Weather } from "@/lib/prompts/ritual";
import { markRitualActed, markRitualSeen } from "@/server/actions/ritual";
import { track } from "@/lib/analytics";

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
  /** True when any ritual content (headline/mood/cta) flows into Cover.
   *  Drives `markRitualSeen` on mount so we don't double-count on
   *  stage-only fallbacks. */
  hasRitual?: boolean;
  /** Current journey-stage key. When provided, the CTA tap fires the
   *  unified `onboarding_entry_clicked` PostHog event with this stage
   *  in the payload — letting a single funnel measure conversion from
   *  any home stage into the next step regardless of which surface
   *  the couple started from. */
  stageKey?: "start" | "adding" | "visiting" | "comparing" | "decided";
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
  hasRitual = false,
  stageKey,
}: HomeCoverProps) {
  const seenRef = useRef(false);
  useEffect(() => {
    if (seenRef.current) return;
    if (!hasRitual) return;
    seenRef.current = true;
    void markRitualSeen();
  }, [hasRitual]);
  const greeting =
    timeOfDayLabel === "朝"
      ? "おはようございます"
      : timeOfDayLabel === "夕" || timeOfDayLabel === "夜"
        ? "こんばんは"
        : "こんにちは";

  // Drop URLs that are known site assets / promo banners (e.g. zexy's
  // `/images/common/ic_new_text.gif`). The same filter runs at import
  // time in the extraction pipeline and at render time in PhotoCarousel,
  // but older venues in DB can still have those URLs at position [0] —
  // which is exactly what Home renders as the hero. Without this guard
  // we fall through to a pink/gif placeholder on Home.
  const photoUrl =
    coverVenue?.photoUrls?.find((u) => !isLikelyAssetUrl(u)) ?? null;

  return (
    <section
      aria-label="今日のカバー"
      className="relative -mx-5 sm:-mx-8 animate-cover-fade-in"
    >
      {/* Height policy: 4:5 portrait on mobile (brand intent — poster
          crop for the venue photo) but cap to 16:9 landscape + ~64vh on
          desktop so the hero doesn't eat 70%+ of a PC viewport. Hard
          ceiling at 560px keeps the headline above the fold on tablets. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden md:aspect-[16/9] md:max-h-[min(64vh,560px)]">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={coverVenue?.name ?? ""}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 960px"
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
              "linear-gradient(to bottom, rgba(20,16,12,0.32) 0%, rgba(20,16,12,0) 30%, rgba(20,16,12,0) 50%, rgba(20,16,12,0.82) 100%)",
          }}
        />

        <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] tracking-[0.18em] uppercase text-white/85">
            <span className="font-medium text-white">HARETOKI</span>
            <span aria-hidden="true" className="opacity-50">·</span>
            <span className="tabular-nums">{dateLabel}</span>
            {timeOfDayLabel && (
              <>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span className="normal-case tracking-normal text-[12.5px]">
                  {timeOfDayLabel}
                </span>
              </>
            )}
          </div>
          {/* SkyChip now pairs with a caption so the illustration stops
              reading as "unknown glyph". Smaller size (64) reduces hero
              clutter — the label carries the meaning, not the size. */}
          <div className="flex flex-col items-center gap-1">
            <SkyChip mood={weather} size={64} />
            <span
              className="text-[10.5px] tracking-[0.12em] text-white/85 uppercase"
              aria-label={`ふたりの今日の空 ${weatherLabel(weather)}`}
            >
              {weatherLabel(weather)}
            </span>
          </div>
        </div>

        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-[13.5px] text-white/80">
            {greeting}、<span className="text-white">{userName}</span>さん
          </p>
          <h1
            className={cn(
              "mt-2 font-[family-name:var(--font-display)] font-light tracking-[-0.01em] text-white",
              "text-[clamp(1.9rem,1.3rem+2.6vw,2.75rem)] leading-[1.18]",
            )}
          >
            {headline}
          </h1>
          {sub && (
            <p className="mt-3 text-[14px] leading-relaxed text-white/85">
              {sub}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        <HaloTap className="w-full rounded-[14px]">
          <PrefetchLink
            href={ctaHref}
            onClick={() => {
              // Unified entry funnel — every home CTA tap is logged
              // with its stage so PostHog can build a single
              // conversion funnel keyed on `onboarding_entry_clicked`
              // regardless of which step of the journey the couple is
              // on. Same event name fires from OnboardingHero so the
              // funnel can split by `from`.
              if (stageKey) {
                track("onboarding_entry_clicked", {
                  from: "home",
                  stage: stageKey,
                  cta: ctaLabel,
                });
              }
              if (isRitualCta) void markRitualActed();
            }}
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
          </PrefetchLink>
        </HaloTap>
      </div>
    </section>
  );
}

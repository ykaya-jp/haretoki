"use client";

import Link from "next/link";
import { Cloud, CloudSun, Sun } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { JourneyRing } from "@/components/home/journey-ring";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";

interface HeroNbaProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
}

type StageKey = "start" | "adding" | "visiting" | "comparing" | "decided";

interface HeroContent {
  stage: StageKey;
  weatherIcon: typeof Cloud;
  body: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

function getHeroContent(props: HeroNbaProps): HeroContent {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision } = props;

  if (hasDecision) {
    return {
      stage: "decided",
      weatherIcon: Sun,
      body: "ここから、当日の準備へ",
      primaryCta: { label: "準備を始める", href: "/mypage" },
    };
  }

  if (favoriteCount >= 2) {
    return {
      stage: "comparing",
      weatherIcon: Sun,
      body: "ふたりで並べて、見比べてみましょう",
      primaryCta: { label: "比べる", href: "/candidates" },
    };
  }

  if (visitedVenues >= 1) {
    return {
      stage: "visiting",
      weatherIcon: CloudSun,
      body: "見学の印象を、忘れないうちに残しましょう",
      primaryCta: { label: "印象を残す", href: "/candidates" },
    };
  }

  if (totalVenues >= 1) {
    return {
      stage: "adding",
      weatherIcon: CloudSun,
      body: "最初の見学を入れてみませんか。当日のメモも残せます",
      primaryCta: { label: "見学を入れる", href: "/candidates" },
    };
  }

  return {
    stage: "start",
    weatherIcon: Cloud,
    body: "まず1件、気になる式場を。URLを貼るだけで始まります",
    primaryCta: { label: "URLから追加", href: "/explore" },
    secondaryCta: { label: "式場を探してみる", href: "/explore" },
  };
}

/** Hero card: weather icon + Journey Ring + editorial copy + single primary CTA */
export function HeroNba(props: HeroNbaProps) {
  const content = getHeroContent(props);
  const WeatherIcon = content.weatherIcon;

  return (
    <section
      aria-label="今日のおすすめアクション"
      className="rounded-xl p-6 shadow-[var(--shadow-card)] shadow-[var(--inner-glow)]"
      style={{
        background: `var(--gradient-dusk), var(--bg-card, oklch(0.99 0.005 80))`,
        boxShadow: `var(--inner-glow), var(--shadow-card)`,
      }}
    >
      {/* Top row: weather icon (left) + journey ring (right) */}
      <div className="mb-4 flex items-start justify-between">
        <WeatherIcon
          aria-hidden="true"
          className="h-6 w-6 text-muted-foreground"
          strokeWidth={1.5}
        />
        <JourneyRing {...props} />
      </div>

      {/* Editorial body copy */}
      <p className="mb-5 font-serif font-light leading-snug text-fluid-lg">
        {content.body}
      </p>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <HaloTap className="w-full rounded-lg">
          <Link
            href={content.primaryCta.href}
            className={cn(buttonVariants({ variant: "default", size: "default" }), "w-full justify-center")}
          >
            {content.primaryCta.label}
          </Link>
        </HaloTap>
        {content.secondaryCta && (
          <Link
            href={content.secondaryCta.href}
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {content.secondaryCta.label}
          </Link>
        )}
      </div>
    </section>
  );
}

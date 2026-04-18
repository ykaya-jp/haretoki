"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HaloTap } from "@/components/ui/halo-tap";
import { cn } from "@/lib/utils";

interface HeroNBAProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
}

interface NBAContent {
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/** Maps journey stage to §5.4 Hero NBA copy table. */
function getNBA(p: HeroNBAProps): NBAContent {
  if (p.hasDecision) {
    return {
      body: "ここから、当日の準備へ",
      primaryLabel: "準備を始める",
      primaryHref: "/candidates?tab=decision",
    };
  }
  if (p.favoriteCount >= 2) {
    return {
      body: "2 件で迷ったら、情景で決める",
      primaryLabel: "情景で決める",
      primaryHref: "/candidates?tab=duel",
      secondaryLabel: "比べてみる",
      secondaryHref: "/candidates?tab=compare",
    };
  }
  if (p.visitedVenues >= 1) {
    return {
      body: "見学の印象を、忘れないうちに残しましょう",
      primaryLabel: "印象を残す",
      primaryHref: "/candidates",
    };
  }
  if (p.totalVenues >= 1) {
    return {
      body: "最初の見学を入れてみませんか。当日のメモも残せます",
      primaryLabel: "見学を入れる",
      primaryHref: "/candidates",
    };
  }
  return {
    body: "まず 1 件、気になる式場を。URL を貼るだけで始まります",
    primaryLabel: "URL から追加",
    primaryHref: "/explore",
    secondaryLabel: "別のおすすめを見る",
    secondaryHref: "/explore",
  };
}

/** Hero NBA — the single next-best-action shown below the Journey Ring. */
export function HeroNBA(props: HeroNBAProps) {
  const nba = getNBA(props);

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        {nba.body}
      </p>
      <div className="flex flex-col gap-2">
        <HaloTap className="w-full rounded-[14px]">
          <Link
            href={nba.primaryHref}
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
            {nba.primaryLabel}
          </Link>
        </HaloTap>
        {nba.secondaryLabel && nba.secondaryHref && (
          <Link
            href={nba.secondaryHref}
            prefetch={true}
            className="text-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            {nba.secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

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
  /**
   * 直近更新された venue の id。1 件しか登録されていないときは
   * 「見学を入れる」「印象を残す」 CTA から `/venues/<id>#visit` に直接
   * 飛ばして、候補一覧を経由せずに予定入力 UI まで届けるために使う。
   */
  firstVenueId?: string | null;
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
    // 「印象を残す」= venue 詳細の rating / 帰り道モード。式場が 1 件しか
    // ない場合は迷わないので詳細直行。複数あるときは候補一覧で選ばせる。
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      body: "見学の印象を、忘れないうちに残しましょう",
      primaryLabel: "印象を残す",
      primaryHref: singleVenue
        ? `/venues/${p.firstVenueId}`
        : "/candidates",
    };
  }
  if (p.totalVenues >= 1) {
    // 「見学を入れる」= VisitSection のスケジューラ。1 件しか無いなら
    // /venues/<id>#visit で section まで scroll、複数あるなら候補画面で
    // どの式場か選んでもらうため、コピーも「式場を選ぶ」に寄せる。
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      body: singleVenue
        ? "最初の見学予定を入れてみませんか。日付とメモを残せます"
        : "見学する式場を選んで、予定を入れましょう",
      primaryLabel: singleVenue ? "見学予定を入れる" : "式場を選ぶ",
      primaryHref: singleVenue
        ? `/venues/${p.firstVenueId}#visit`
        : "/candidates",
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

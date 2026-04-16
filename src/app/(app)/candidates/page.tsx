import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";
import { getVenues } from "@/server/actions/venues";
import { getDecision } from "@/server/actions/decisions";
import { getCurrentUserName } from "@/server/actions/home";
import { CandidatesView } from "@/components/candidates/candidates-view";
import { CoupleGapSection } from "@/components/candidates/couple-gap-section";

export const metadata: Metadata = {
  title: "候補",
  description: "お気に入りの式場を比較し、最終決定まで並べて検討できます。",
};

interface CandidatesPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  // getCurrentUserName replaces the heavyweight getHomeData — only userName is needed here.
  const [favorites, venues, decision, userName, params] = await Promise.all([
    getFavorites("mine"),
    getVenues(),
    getDecision(),
    getCurrentUserName(),
    searchParams,
  ]);

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));

  // ?view=recent: surface a note that "最近見た" is in the list below.
  // Full "recently viewed" sub-tab is deferred to Tier 2.
  const isRecentView = params.view === "recent";

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[10.5px] tracking-[0.18em] uppercase text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span>{isRecentView ? "Recent" : "Candidates"}</span>
        </p>
        <h2 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-extralight tracking-[-0.01em]">
          {isRecentView ? "最近見た式場" : "候補"}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {isRecentView
            ? "先日ご覧になった式場を、そっとまとめました。"
            : "集めて、並べて、ふたりの輪郭を描く。"}
        </p>
      </div>
      {/* Gradient hairline separator */}
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 30%, transparent) 35%, color-mix(in oklab, var(--gold-warm) 30%, transparent) 65%, transparent 100%)",
        }}
      />
      <CoupleGapSection />
      {/* チェック項目の編集は副次的なので inline text link で静かに */}
      <div className="-mt-6 text-right">
        <Link
          href="/checklist"
          prefetch={false}
          className="inline-flex min-h-11 items-center gap-1 text-[11.5px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
        >
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          チェック項目を編集
        </Link>
      </div>
      <CandidatesView
        initialFavorites={favorites}
        venueOptions={venueOptions}
        initialDecision={
          decision
            ? { venueName: decision.venue.name, rationale: decision.rationale }
            : null
        }
        userName={userName}
      />
    </div>
  );
}

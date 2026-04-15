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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h1 font-serif font-extralight">
            {isRecentView ? "最近見た式場" : "候補"}
          </h2>
          <p className="mt-1 text-meta text-muted-foreground">
            {isRecentView ? "先日ご覧になった式場の一覧です" : "集めて、比べて、決める"}
          </p>
        </div>
        <Link
          href="/checklist"
          prefetch={true}
          aria-label="チェック項目を編集"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors active:bg-muted"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Link>
      </div>
      <CoupleGapSection />
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

import type { Metadata } from "next";
import { getFavorites } from "@/server/actions/favorites";
import { getVenues } from "@/server/actions/venues";
import { getDecision } from "@/server/actions/decisions";
import { getCurrentUserName } from "@/server/actions/home";
import { CandidatesView } from "@/components/candidates/candidates-view";

export const metadata: Metadata = {
  title: "候補",
  description: "お気に入りの式場を比較し、最終決定まで並べて検討できます。",
};

export default async function CandidatesPage() {
  // getCurrentUserName replaces the heavyweight getHomeData — only userName is needed here.
  const [favorites, venues, decision, userName] = await Promise.all([
    getFavorites("mine"),
    getVenues(),
    getDecision(),
    getCurrentUserName(),
  ]);

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h1 font-serif font-extralight">候補</h2>
        <p className="mt-1 text-meta text-muted-foreground">
          お気に入りを並べて、ふたりで比べる
        </p>
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

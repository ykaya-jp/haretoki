import { getFavorites } from "@/server/actions/favorites";
import { getVenues } from "@/server/actions/venues";
import { getDecision } from "@/server/actions/decisions";
import { getHomeData } from "@/server/actions/home";
import { CandidatesView } from "@/components/candidates/candidates-view";

export default async function CandidatesPage() {
  const [favorites, venues, decision, homeData] = await Promise.all([
    getFavorites("mine"),
    getVenues(),
    getDecision(),
    getHomeData(),
  ]);

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl font-light tracking-wide">候補</h2>
      <CandidatesView
        initialFavorites={favorites}
        venueOptions={venueOptions}
        initialDecision={
          decision
            ? { venueName: decision.venue.name, rationale: decision.rationale }
            : null
        }
        userName={homeData.userName}
      />
    </div>
  );
}

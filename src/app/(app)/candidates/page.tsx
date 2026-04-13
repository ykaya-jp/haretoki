import { getFavorites } from "@/server/actions/favorites";
import { getVenues } from "@/server/actions/venues";
import { CandidatesView } from "@/components/candidates/candidates-view";

export default async function CandidatesPage() {
  const [favorites, venues] = await Promise.all([
    getFavorites("mine"),
    getVenues(),
  ]);

  const venueOptions = venues.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="space-y-4">
      <h2>候補</h2>
      <CandidatesView initialFavorites={favorites} venueOptions={venueOptions} />
    </div>
  );
}

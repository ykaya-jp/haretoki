import { getFavorites } from "@/server/actions/favorites";
import { CandidatesView } from "@/components/candidates/candidates-view";

export default async function CandidatesPage() {
  const favorites = await getFavorites("mine");

  return (
    <div className="space-y-4">
      <h2>候補</h2>
      <CandidatesView initialFavorites={favorites} />
    </div>
  );
}

import { getVenues } from "@/server/actions/venues";
import { getFavorites } from "@/server/actions/favorites";
import { AddVenueSheet } from "@/components/explore/add-venue-sheet";
import { ExploreContent } from "@/components/explore/explore-content";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";

export default async function ExplorePage() {
  const [venues, favorites] = await Promise.all([
    getVenues(),
    getFavorites("mine"),
  ]);

  const favoriteIds = favorites.map((f) => f.venue.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2>式場を探す</h2>
        <AddVenueSheet />
      </div>

      {/* Venue list with filters */}
      {venues.length === 0 ? (
        <EmptyState
          icon={Search}
          title="まだ式場が登録されていません"
          description="気になる式場を追加して、比較を始めましょう"
          action={{ label: "式場を追加する", href: "#" }}
        />
      ) : (
        <ExploreContent venues={venues} favoriteIds={favoriteIds} />
      )}
    </div>
  );
}

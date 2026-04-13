import { getVenues } from "@/server/actions/venues";
import { getFavorites } from "@/server/actions/favorites";
import { AddVenueSheet } from "@/components/explore/add-venue-sheet";
import { ExploreContent } from "@/components/explore/explore-content";
import { AIRecommendations } from "@/components/venues/ai-recommendations";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";

export default async function ExplorePage() {
  const [venues, favorites] = await Promise.all([
    getVenues(),
    getFavorites("mine"),
  ]);

  const favoriteIds = favorites.map((f) => f.venue.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2>式場を探す</h2>
        <AddVenueSheet />
      </div>

      {/* AI Recommendations — always visible */}
      <AIRecommendations />

      {/* Venue list with filters */}
      {venues.length === 0 ? (
        <EmptyState
          icon={Search}
          title="式場の下見は、ここから始まります"
          description="右上の「追加」ボタンから、ゼクシィなどのURLを貼り付けるだけでAIが自動で情報を読み取ります。手動での登録もできます。"
        />
      ) : (
        <ExploreContent venues={venues} favoriteIds={favoriteIds} />
      )}
    </div>
  );
}

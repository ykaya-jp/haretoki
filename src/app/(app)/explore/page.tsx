import { getVenues } from "@/server/actions/venues";
import { getFavorites } from "@/server/actions/favorites";
import { AddVenueSheet } from "@/components/explore/add-venue-sheet";
import { ExploreContent } from "@/components/explore/explore-content";
import { AIRecommendations } from "@/components/venues/ai-recommendations";
import { VenueSearchBar } from "@/components/venues/venue-search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [venues, favorites] = await Promise.all([
    getVenues(query ? { query } : undefined),
    getFavorites("mine"),
  ]);

  const favoriteIds = favorites.map((f) => f.venue.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2>式場をさがす</h2>
        <AddVenueSheet />
      </div>

      {/* Search bar */}
      <VenueSearchBar initialQuery={query} />

      {/* AI Recommendations — always visible */}
      <AIRecommendations />

      {/* Venue list with filters */}
      {venues.length === 0 ? (
        query ? (
          <EmptyState
            icon={Search}
            title="該当する式場がありません"
            description={`「${query}」に一致する式場は見つかりませんでした。キーワードを変えてお試しください。`}
            action={{ href: "/explore", label: "検索をクリア" }}
          />
        ) : (
          <EmptyState
            icon={Search}
            imageUrl="/images/empty-explore.png"
            title="式場さがしは、ここから"
            description="右上の「追加」からURLを貼るだけ。AIが自動で情報を読み取ります。"
          />
        )
      ) : (
        <ExploreContent venues={venues} favoriteIds={favoriteIds} />
      )}
    </div>
  );
}

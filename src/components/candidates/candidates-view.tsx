"use client";

import { useState, useEffect } from "react";
import { SegmentedControl } from "@/components/candidates/segmented-control";
import { FavoriteFilter } from "@/components/candidates/favorite-filter";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ComparisonBoard } from "@/components/comparison/comparison-board";
import { Heart } from "lucide-react";
import { getFavorites } from "@/server/actions/favorites";

type Tab = "shortlist" | "comparison" | "decision";

interface FavoriteVenue {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    scores: Array<{ dimension: string; score: number; source: string }>;
  };
  favoritedBy: string[];
}

interface CandidatesViewProps {
  initialFavorites: FavoriteVenue[];
  venueOptions: Array<{ id: string; name: string }>;
}

export function CandidatesView({ initialFavorites, venueOptions }: CandidatesViewProps) {
  const [tab, setTab] = useState<Tab>("shortlist");
  const [filter, setFilter] = useState<"mine" | "partner" | "both">("mine");
  const [favorites, setFavorites] = useState(initialFavorites);

  useEffect(() => {
    // Refetch when filter changes
    getFavorites(filter).then(setFavorites);
  }, [filter]);

  const SEGMENTS = [
    { id: "shortlist" as const, label: "ショートリスト" },
    { id: "comparison" as const, label: "比較", disabled: false },
    { id: "decision" as const, label: "決定", disabled: false },
  ];

  return (
    <div className="space-y-4">
      <SegmentedControl
        segments={SEGMENTS}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === "shortlist" && (
        <>
          <FavoriteFilter active={filter} onChange={setFilter} />

          {favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="気になる式場をハートで候補に追加しましょう"
              description="式場一覧でハートをタップすると候補に追加されます"
              action={{ label: "式場を探す", href: "/explore" }}
            />
          ) : (
            <div className="space-y-4">
              {favorites.map((fav) => (
                <VenueCard
                  key={fav.venue.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  venue={fav.venue as any}
                  isFavorite={true}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "comparison" && (
        <ComparisonBoard venueOptions={venueOptions} />
      )}

      {tab === "decision" && (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">
            比較ボードで式場を選んで「この式場に決める」を実行してください
          </p>
        </div>
      )}
    </div>
  );
}

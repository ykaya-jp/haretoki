"use client";

import { useState, useMemo } from "react";
import { FilterChips } from "@/components/explore/filter-chips";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import type { Venue, VenueScore, Estimate } from "@/generated/prisma/client";

type VenueWithRelations = Venue & {
  scores: VenueScore[];
  estimates?: (Estimate & { items: unknown[] })[];
};

interface ExploreContentProps {
  venues: VenueWithRelations[];
  favoriteIds: string[];
}

const STATUS_FILTERS = [
  { id: "all", label: "全て" },
  { id: "researching", label: "調査中" },
  { id: "visit_scheduled", label: "見学予定" },
  { id: "visited", label: "見学済み" },
  { id: "selected", label: "候補" },
] as const;

export function ExploreContent({ venues, favoriteIds }: ExploreContentProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const chips = STATUS_FILTERS.map((f) => ({
    id: f.id,
    label: f.label,
    active: activeFilter === f.id,
  }));

  const handleToggle = (id: string) => {
    setActiveFilter(id === activeFilter ? "all" : id);
  };

  const filteredVenues = useMemo(() => {
    if (activeFilter === "all") return venues;
    return venues.filter((v) => v.status === activeFilter);
  }, [venues, activeFilter]);

  return (
    <>
      <FilterChips chips={chips} onToggle={handleToggle} />

      {filteredVenues.length === 0 ? (
        <EmptyState
          icon={Search}
          title="該当する式場がありません"
          description="フィルタを変更してみてください"
        />
      ) : (
        <div className="space-y-4">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              isFavorite={favoriteSet.has(venue.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

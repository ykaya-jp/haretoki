"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { FilterChips } from "@/components/explore/filter-chips";
import { VenueFilterSheet } from "@/components/explore/venue-filter-sheet";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getVenues } from "@/server/actions/venues";
import type { VenueFilters } from "@/server/actions/venues";
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
  { id: "all", label: "すべて" },
  { id: "researching", label: "気になる" },
  { id: "visit_scheduled", label: "見学予定" },
  { id: "visited", label: "見学済み" },
  { id: "selected", label: "お気に入り" },
] as const;

export function ExploreContent({ venues: initialVenues, favoriteIds }: ExploreContentProps) {
  const [venues, setVenues] = useState(initialVenues);
  const [activeFilter, setActiveFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<VenueFilters>({});
  const [isPending, startTransition] = useTransition();
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const chips = STATUS_FILTERS.map((f) => {
    const count = f.id === "all"
      ? venues.length
      : venues.filter((v) => v.status === f.id).length;
    return {
      id: f.id,
      label: count > 0 ? `${f.label} (${count})` : f.label,
      active: activeFilter === f.id,
    };
  });

  const handleToggle = (id: string) => {
    setActiveFilter(id === activeFilter ? "all" : id);
  };

  const handleFilterApply = useCallback((filters: VenueFilters) => {
    setAdvancedFilters(filters);
    startTransition(async () => {
      const result = await getVenues(filters);
      setVenues(result as VenueWithRelations[]);
    });
  }, []);

  const filteredVenues = useMemo(() => {
    if (activeFilter === "all") return venues;
    return venues.filter((v) => v.status === activeFilter);
  }, [venues, activeFilter]);

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1 overflow-x-auto">
          <FilterChips chips={chips} onToggle={handleToggle} />
        </div>
        <VenueFilterSheet filters={advancedFilters} onApply={handleFilterApply} />
      </div>

      {isPending && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!isPending && filteredVenues.length === 0 ? (
        <EmptyState
          icon={Search}
          title="条件に合う式場が見つかりません"
          description="条件を変えてみると、新しい出会いがあるかもしれません"
        />
      ) : (
        !isPending && (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredVenues.map((venue, i) => (
                <motion.div
                  key={venue.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.15, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <VenueCard
                    venue={venue}
                    isFavorite={favoriteSet.has(venue.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      )}
    </>
  );
}

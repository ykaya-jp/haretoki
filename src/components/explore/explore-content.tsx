"use client";

import { useState, useMemo, useCallback, useTransition, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { FilterChips } from "@/components/explore/filter-chips";
import { VenueFilterSheet } from "@/components/explore/venue-filter-sheet";
import { SaveSearchButton } from "@/components/explore/save-search-button";
import { VenueCard } from "@/components/venues/venue-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getVenues } from "@/server/actions/venues";
import type { VenueFilters } from "@/server/actions/venue-filters";
import type { SavedSearchFilters } from "@/lib/schemas";
import { VIBE_TAGS } from "@/lib/vibe-tags";
import type { Venue, VenueScore, Estimate } from "@/generated/prisma/client";
import Link from "next/link";

type VenueWithRelations = Venue & {
  scores: Pick<VenueScore, "dimension" | "score" | "source">[];
  estimates?: (Pick<Estimate, "id" | "venueId" | "total" | "version" | "createdAt"> & { items: { amount: unknown }[] })[];
};

interface ExploreContentProps {
  venues: VenueWithRelations[];
  favoriteIds: string[];
  // The server page already resolved the query + onboarding-derived filters
  // (from URL search params or project.conditions). Pass them in so the
  // filter-sheet merges ON TOP of them instead of silently clobbering them.
  baseFilters?: VenueFilters;
  /** E-2 Fit Reason map { venueId: "◯◯ — ふたりの..." | null } */
  fitReasons?: Record<string, string | null>;
  /** Number of saved searches already stored (for limit check). */
  savedSearchCount?: number;
  /** Server-rendered personalized condition chips to show inside the filter zone */
  conditionChips?: ReactNode;
  /** Server-rendered vibe filter chips to show inside the filter zone */
  vibeChips?: ReactNode;
  /** Active search query (from URL ?q=) for empty state messaging */
  searchQuery?: string;
}

const validVibeIds: Set<string> = new Set(VIBE_TAGS.map((t) => t.id));

const STATUS_FILTERS = [
  { id: "all", label: "すべて" },
  { id: "researching", label: "気になる" },
  { id: "visit_scheduled", label: "見学予定" },
  { id: "visited", label: "見学済み" },
  { id: "shortlisted", label: "検討中" },
  { id: "selected", label: "決定" },
  { id: "rejected", label: "見送り" },
] as const;

export function ExploreContent({
  venues: initialVenues,
  favoriteIds,
  baseFilters,
  fitReasons = {},
  savedSearchCount = 0,
  conditionChips,
  vibeChips,
  searchQuery = "",
}: ExploreContentProps) {
  const [venues, setVenues] = useState(initialVenues);
  const [activeFilter, setActiveFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<VenueFilters>({});
  const [isPending, startTransition] = useTransition();
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Read URL params for keyword and vibe tags (managed by parent components).
  const searchParams = useSearchParams();

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

  const handleFilterApply = useCallback(
    (filters: VenueFilters) => {
      setAdvancedFilters(filters);
      // Merge sheet filters ON TOP of the server-resolved base (search
      // query + onboarding conditions). Sheet keys override base keys so the
      // user can intentionally loosen a personalization constraint, but they
      // never silently lose their search query.
      const merged: VenueFilters = { ...(baseFilters ?? {}), ...filters };
      startTransition(async () => {
        const result = await getVenues(merged);
        setVenues(result as VenueWithRelations[]);
      });
    },
    [baseFilters],
  );

  const filteredVenues = useMemo(() => {
    if (activeFilter === "all") return venues;
    return venues.filter((v) => v.status === activeFilter);
  }, [venues, activeFilter]);

  // Build the live SavedSearchFilters from all active filter sources.
  // Priority: advancedFilters (sheet) overrides baseFilters (onboarding/URL).
  const liveFilters = useMemo((): SavedSearchFilters => {
    const keyword = searchParams.get("q")?.trim() || undefined;
    const vibeParam = searchParams.get("vibe");
    const vibeTags = vibeParam
      ? vibeParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => validVibeIds.has(s))
      : undefined;

    // advancedFilters.areas / advancedFilters.budgetMax etc. are VenueFilters keys.
    // Fall back to baseFilters (onboarding-derived) when sheet doesn't override.
    const area =
      (advancedFilters.areas && advancedFilters.areas.length > 0
        ? advancedFilters.areas
        : baseFilters?.areas) ?? undefined;

    const budgetMax =
      advancedFilters.budgetMax ?? baseFilters?.budgetMax ?? undefined;

    const capacityMin =
      advancedFilters.guestCount ?? baseFilters?.guestCount ?? undefined;

    return {
      area: area && area.length > 0 ? area : undefined,
      budgetMax,
      capacityMin,
      vibeTags: vibeTags && vibeTags.length > 0 ? vibeTags : undefined,
      keyword,
    };
  }, [advancedFilters, baseFilters, searchParams]);

  const hasLiveFilters =
    (liveFilters.area && liveFilters.area.length > 0) ||
    liveFilters.budgetMax !== undefined ||
    liveFilters.capacityMin !== undefined ||
    (liveFilters.vibeTags && liveFilters.vibeTags.length > 0) ||
    (liveFilters.keyword && liveFilters.keyword.trim().length > 0);

  return (
    <>
      {/* Unified filter zone — E-5: collapsed to a 2-tier layout.
          Previously the zone rendered 4 eyebrow labels (絞り込み /
          必須条件 / ステータス / 雰囲気) which added visual noise without
          being informative — users already understand what the chip
          rows represent by looking at them. Keep just the top eyebrow
          + count, and let vertical rhythm (space-y-5) separate the
          groups. */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-eyebrow text-muted-foreground">
            絞り込み
          </span>
          <span className="tabular-nums text-[13px] font-normal text-[var(--gold-warm)]">
            {filteredVenues.length}件
          </span>
        </div>

        {conditionChips && <div>{conditionChips}</div>}

        <div className="flex items-center gap-3">
          <div className="flex-1 overflow-x-auto">
            <FilterChips chips={chips} onToggle={handleToggle} />
          </div>
          <VenueFilterSheet filters={advancedFilters} onApply={handleFilterApply} />
        </div>

        {vibeChips && <div>{vibeChips}</div>}
      </div>

      {/* E-10 v2: Save Search — reflects live client filter state */}
      {hasLiveFilters && (
        <div className="flex justify-end">
          <SaveSearchButton
            filters={liveFilters}
            atLimit={savedSearchCount >= 5}
          />
        </div>
      )}

      {isPending && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!isPending && venues.length === 0 && !searchQuery && (
        <EmptyState
          icon={Search}
          imageUrl="/images/empty-explore.png"
          imageAlt="式場を探す"
          title="まだ候補はありません"
          description="気になる 1 件から始めましょう。画面右下の「＋」から URL を貼るだけで始まります。"
          action={{ href: "/explore?addVenue=1", label: "式場を追加する" }}
        />
      )}

      {!isPending && venues.length === 0 && searchQuery && (
        <div className="flex flex-col items-center gap-3">
          <EmptyState
            icon={Search}
            title="該当する式場がありません"
            description={`「${searchQuery}」に一致する式場は見つかりませんでした。キーワードを変えてお試しください。`}
            action={{ href: "/explore", label: "検索をクリア" }}
          />
          <Link
            href="/explore?addVenue=1"
            prefetch={true}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
          >
            URLから式場を追加
          </Link>
        </div>
      )}

      {!isPending && venues.length > 0 && filteredVenues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Search className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="max-w-[300px] space-y-2">
            <h3 className="font-[family-name:var(--font-display)] text-base font-light tracking-wide">
              条件に合う式場が見つかりません
            </h3>
            <p className="text-sm leading-[1.8] text-muted-foreground">
              条件を変えてみると、新しい出会いがあるかもしれません
            </p>
          </div>
          {activeFilter !== "all" && (
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98]"
            >
              すべての状態を表示
            </button>
          )}
        </div>
      ) : (
        !isPending && venues.length > 0 && (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredVenues.map((venue, i) => (
                <motion.div
                  key={venue.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: Math.min(i, 4) * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  layout
                >
                  <VenueCard
                    venue={venue}
                    isFavorite={favoriteSet.has(venue.id)}
                    fitReason={fitReasons[venue.id] ?? null}
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

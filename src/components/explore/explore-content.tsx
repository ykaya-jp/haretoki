"use client";

import { useState, useMemo, useCallback, useTransition, useRef, useLayoutEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { FilterChips } from "@/components/explore/filter-chips";
import { VenueFilterSheet } from "@/components/explore/venue-filter-sheet";
import { SaveSearchButton } from "@/components/explore/save-search-button";
import { VenueCard } from "@/components/venues/venue-card";
import { HeartCoachMark } from "@/components/venues/heart-coach-mark";
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

/**
 * Threshold above which the /explore list switches from the animated
 * framer-motion map render to a window-virtualized render. Below the
 * threshold, virtualization overhead (layout-effect, observer, absolute
 * positioning) outweighs the savings on a short list, so we keep the
 * original code path for small result sets.
 */
const VIRTUALIZE_THRESHOLD = 50;

/**
 * Rough estimate of a VenueCard's rendered height at 375px viewport.
 * The virtualizer measures real heights after mount via the `measureElement`
 * ref, so this only controls the initial scrollbar size. Keep it in the
 * ballpark of the common case (photo 4:3 + header + price + one chip row).
 */
const CARD_ESTIMATE_HEIGHT_PX = 420;

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
  // Render-phase reset (React 19 pattern): track the last server-provided
  // snapshot identity so that when the parent re-renders with a different
  // `initialVenues` (e.g. user removed a personalized chip → URL params
  // update → server re-fetch), our local venue state resets to that snapshot.
  // Without this, the sheet-driven `setVenues` branch stayed in a stale
  // snapshot and chip removals had no visible effect — that was the
  // "ハッシュタグを消しても画面変わらない" bug. This is the allowed
  // "reset on prop change" pattern; we avoid `useEffect(() => setState())`
  // because it violates React 19's set-state-in-effect rule.
  const [venues, setVenues] = useState(initialVenues);
  const [lastInitial, setLastInitial] = useState(initialVenues);
  if (lastInitial !== initialVenues) {
    setLastInitial(initialVenues);
    setVenues(initialVenues);
  }
  const [activeFilter, setActiveFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<VenueFilters>({});
  const [isPending, startTransition] = useTransition();
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  // Ref for the first venue card's heart button area (used by HeartCoachMark)
  const firstCardHeartRef = useRef<HTMLDivElement | null>(null);

  // Read URL params for keyword and vibe tags (managed by parent components).
  const searchParams = useSearchParams();

  // TODO(myreview-02 item 3): ホームの totalVenues と explore の "すべて"
  // 件数が乖離する問題。原因は URL params (areas / styles / vibe / q)
  // が残ったまま "すべて" を押すと、ここで数える venues はすでに
  // サーバ側で絞り込まれているため。根本解決にはサーバ fetch と
  // クライアント表示の母集合を揃える (全件 fetch + クライアント絞込) か、
  // 絞込が効いているバッジを "3 / 7 件" のように分子/分母で見せる
  // 必要あり。後者が小さく、次 PR で対応予定。
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
          action={{ href: "/explore?addVenue=1", label: "式場を迎える" }}
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
          <VenueList
            venues={filteredVenues}
            favoriteSet={favoriteSet}
            fitReasons={fitReasons}
            firstCardHeartRef={firstCardHeartRef}
          />
        )
      )}
    </>
  );
}

/**
 * Renders the venue list with two strategies:
 *  - below {@link VIRTUALIZE_THRESHOLD}: the original framer-motion animated
 *    list (unchanged behaviour for the common case).
 *  - at or above the threshold: `useWindowVirtualizer` from
 *    `@tanstack/react-virtual`, which mounts only the cards near the
 *    viewport. This drops the DOM node count from O(N) to O(viewport),
 *    which is what saves frame time on 50+ item result sets.
 */
function VenueList({
  venues,
  favoriteSet,
  fitReasons,
  firstCardHeartRef,
}: {
  venues: VenueWithRelations[];
  favoriteSet: Set<string>;
  fitReasons: Record<string, string | null>;
  firstCardHeartRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (venues.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {venues.map((venue, i) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: Math.min(i, 4) * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              layout
            >
              <VenueRowInner
                venue={venue}
                isFirst={i === 0}
                isFavorite={favoriteSet.has(venue.id)}
                fitReason={fitReasons[venue.id] ?? null}
                firstCardHeartRef={firstCardHeartRef}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <VirtualVenueList
      venues={venues}
      favoriteSet={favoriteSet}
      fitReasons={fitReasons}
      firstCardHeartRef={firstCardHeartRef}
    />
  );
}

/**
 * Virtualized variant. Uses the window as the scroll container because
 * /explore scrolls the page — not an inner container — so mounting an
 * extra scroll wrapper would break the existing layout + sticky chip
 * zone. `scrollMargin` is read once on mount and pinned so virtualizer
 * offsets line up with our actual list origin.
 */
function VirtualVenueList({
  venues,
  favoriteSet,
  fitReasons,
  firstCardHeartRef,
}: {
  venues: VenueWithRelations[];
  favoriteSet: Set<string>;
  fitReasons: Record<string, string | null>;
  firstCardHeartRef: React.RefObject<HTMLDivElement | null>;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // `scrollMargin` needs to be a plain value (not a ref read) during render
  // because React 19 flags ref-access-in-render as a purity violation. We
  // measure the list's offset in a layout effect and store it in state so
  // the virtualizer reruns with the correct offset after mount.
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const offset = listRef.current?.offsetTop ?? 0;
    setScrollMargin(offset);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: venues.length,
    estimateSize: () => CARD_ESTIMATE_HEIGHT_PX,
    overscan: 4,
    // Gap between cards in the small-list variant is `space-y-4` (16px).
    // Applying it as `gap` lets the virtualizer account for it so items
    // don't visually collide at rest.
    gap: 16,
    scrollMargin,
    getItemKey: (i) => venues[i]?.id ?? i,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={listRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const venue = venues[virtualRow.index];
          if (!venue) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <VenueRowInner
                venue={venue}
                isFirst={virtualRow.index === 0}
                isFavorite={favoriteSet.has(venue.id)}
                fitReason={fitReasons[venue.id] ?? null}
                firstCardHeartRef={firstCardHeartRef}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single venue row used by both the small-list and virtualized paths.
 * Keeps the HeartCoachMark anchor attached to the first card regardless
 * of which render strategy is in play.
 */
function VenueRowInner({
  venue,
  isFirst,
  isFavorite,
  fitReason,
  firstCardHeartRef,
}: {
  venue: VenueWithRelations;
  isFirst: boolean;
  isFavorite: boolean;
  fitReason: string | null;
  firstCardHeartRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (isFirst) {
    return (
      <div className="relative">
        {/* Anchor div positioned at the heart button area (top-right of card) */}
        <div
          ref={firstCardHeartRef}
          className="pointer-events-none absolute right-3 top-3 z-20 h-12 w-12"
          aria-hidden="true"
        />
        <HeartCoachMark anchorRef={firstCardHeartRef} />
        <VenueCard venue={venue} isFavorite={isFavorite} fitReason={fitReason} />
      </div>
    );
  }
  return <VenueCard venue={venue} isFavorite={isFavorite} fitReason={fitReason} />;
}

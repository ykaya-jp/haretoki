import type { Metadata } from "next";
import { getVenues } from "@/server/actions/venues";
import type { VenueFilters } from "@/server/actions/venue-filters";
import { getFavorites } from "@/server/actions/favorites";
import { getFitReasons } from "@/server/actions/fit-reason";
import { filterVenuesByVibe } from "@/server/actions/vibe-search";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { ExploreContent } from "@/components/explore/explore-content";
import { ExploreAddVenue } from "@/components/explore/explore-add-venue";
import { AIRecommendations } from "@/components/venues/ai-recommendations";
import { getExploreAIRecommendationsSeed } from "@/server/actions/onboarding";
import { VenueSearchBar } from "@/components/venues/venue-search-bar";
import {
  VenuePersonalizedChips,
  type PersonalizedConditions,
} from "@/components/venues/venue-personalized-chips";
import { VibeFilterChips } from "@/components/explore/vibe-filter-chips";
import { listSavedSearches } from "@/server/actions/saved-searches";
import type { VibeTag } from "@/lib/vibe-tags";
import { VIBE_TAGS } from "@/lib/vibe-tags";

// URL-paste server actions invoked from this page chain together
// addVenueFromUrl (parent-page fetch + Claude extraction, ~30-50s) +
// confirmVenueFromUrl (photo upload + multi-page review crawl + Sonnet
// summary on merged corpus, ~50-90s). Total envelope easily reaches
// 100-130s — past the prior 120s cap, which left the function killed
// mid-runReviewSummary and the user landing on /venues/<id> with an
// empty "先輩カップルの声 はこれから" state. 300s is Vercel Pro's
// hard ceiling for serverless functions.
export const maxDuration = 300;

type ExploreSearchParams = {
  q?: string;
  styles?: string | string[];
  areas?: string | string[];
  guestCount?: string;
  budgetMax?: string;
  personalized?: string;
  addVenue?: string;
  vibe?: string;
};

function toArray(v: string | string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : [v];
  const cleaned = arr.map((s) => s.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function toNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const metadata: Metadata = {
  title: "式場をさがす",
  description: "候補の式場を一覧で比較。URLから追加、写真や見積もりをまとめて確認できます。",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<ExploreSearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  // Parse vibe tags from URL (?vibe=natural_light,garden)
  const validVibeIds = new Set(VIBE_TAGS.map((t) => t.id));
  const activeVibes: VibeTag[] = params.vibe
    ? (params.vibe
        .split(",")
        .map((s) => s.trim())
        .filter((s) => validVibeIds.has(s as VibeTag)) as VibeTag[])
    : [];

  // Parse URL-provided filters
  const urlFilters: PersonalizedConditions = {
    styles: toArray(params.styles),
    areas: toArray(params.areas),
    guestCount: toNumber(params.guestCount),
    budgetMax: toNumber(params.budgetMax),
  };

  // Only apply filters that the user put in the URL. Previously we
  // silently merged project.conditions (onboarding answers) into the
  // server-side WHERE clause on first visit, which made venues
  // inconsistent across /explore and /candidates: a couple could see
  // a venue in their Candidates tab but not on Explore because the
  // venue's ceremonyStyles didn't match the onboarding preference.
  // Onboarding data should behave like a *soft suggestion* — it's fine
  // to hydrate filter chips from it (see below), but it must not
  // silently exclude project-owned venues.
  const appliedConditions: PersonalizedConditions = urlFilters;

  const venueFilters: VenueFilters = {
    ...(query ? { query } : {}),
    ...(appliedConditions.styles ? { styles: appliedConditions.styles } : {}),
    ...(appliedConditions.areas ? { areas: appliedConditions.areas } : {}),
    ...(appliedConditions.guestCount !== undefined
      ? { guestCount: appliedConditions.guestCount }
      : {}),
    ...(appliedConditions.budgetMax !== undefined
      ? { budgetMax: appliedConditions.budgetMax }
      : {}),
  };

  const hasAnyFilter = Object.keys(venueFilters).length > 0;
  const hasAnyVibe = activeVibes.length > 0;

  // Resolve the authenticated project once so we can count the unfiltered
  // denominator alongside the filtered list fetch. Without this, the Explore
  // count pill showed only the numerator (e.g. "3件") while Home's Pulse
  // showed the unfiltered total (e.g. "7件 登録中"), leaving users unsure
  // whether "すべて" on Explore really meant everything (myreview-02 item 3).
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [venuesFromFilters, vibeVenues, favorites, aiSeed, savedSearches, totalVenueCount] = await Promise.all([
    getVenues(hasAnyFilter ? venueFilters : undefined),
    hasAnyVibe ? filterVenuesByVibe(activeVibes) : Promise.resolve(null),
    getFavorites("mine"),
    getExploreAIRecommendationsSeed(),
    listSavedSearches().catch(() => []),
    prisma.venue.count({ where: { projectId } }),
  ]);

  // When vibe filter is active, intersect with vibe results (OR match across vibes,
  // but venue must also satisfy other filters when they are set).
  let venues = venuesFromFilters;
  if (vibeVenues !== null) {
    const vibeIds = new Set(vibeVenues.map((v) => v.id));
    venues = venuesFromFilters.filter((v) => vibeIds.has(v.id));
  }

  const favoriteIds = favorites.map((f) => f.venue.id);
  const fitReasons = await getFitReasons(venues.map((v: { id: string }) => v.id));

  return (
    <div className="space-y-10">
      {/* Header — masthead + quiet tagline */}
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Explore</span>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-light tracking-[-0.01em]">
          式場を、見つける
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/80">
          まだ見ぬ式場を、見つける
        </p>
      </div>

      {/* FAB + Sheet (client component, shared open state) */}
      <ExploreAddVenue defaultOpen={params.addVenue === "1"} />

      {/* Search bar */}
      <VenueSearchBar initialQuery={query} />

      {/* AI Recommendations — always renders a stable container.
          Server-fetched seed (venueCount + conditions) is passed so the
          initial paint matches the final state and avoids the "appears
          then disappears" flicker users complained about. */}
      <AIRecommendations
        initialVenueCount={aiSeed.venueCount}
        initialConditions={aiSeed.conditions}
        shouldRequest={aiSeed.shouldRequest}
      />

      {/* Divider between AI recommendations and the user's own candidate
          list. The hairline + eyebrow heading gives the page a clear
          two-zone structure so users stop reading the AI block as part of
          the list (P11). */}
      <div aria-hidden className="h-px bg-border/40" />
      <p className="text-eyebrow text-muted-foreground/70">
        すべての候補
      </p>

      {/* Venue list with unified filter zone.
          ExploreContent renders the filter zone even when the list is empty,
          so users can always adjust filters after getting zero results. */}
      <ExploreContent
        venues={venues}
        favoriteIds={favoriteIds}
        baseFilters={hasAnyFilter ? venueFilters : undefined}
        totalVenueCount={totalVenueCount}
        hasServerFilter={hasAnyFilter || hasAnyVibe}
        fitReasons={fitReasons}
        savedSearchCount={savedSearches.length}
        conditionChips={
          (appliedConditions.styles?.length ||
            appliedConditions.areas?.length ||
            appliedConditions.guestCount !== undefined ||
            appliedConditions.budgetMax !== undefined) ? (
            <VenuePersonalizedChips conditions={appliedConditions} hideHeader />
          ) : undefined
        }
        vibeChips={<VibeFilterChips activeVibes={activeVibes} hideHeader />}
        searchQuery={query}
      />
    </div>
  );
}

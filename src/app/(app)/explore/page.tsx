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
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import Link from "next/link";
import type { VibeTag } from "@/lib/vibe-tags";
import { VIBE_TAGS } from "@/lib/vibe-tags";

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

  const hasUrlPersonalization =
    params.personalized === "1" ||
    urlFilters.styles !== undefined ||
    urlFilters.areas !== undefined ||
    urlFilters.guestCount !== undefined ||
    urlFilters.budgetMax !== undefined;

  // Fall back to project.conditions only on first visit (no personalization params in URL)
  let appliedConditions: PersonalizedConditions = urlFilters;
  if (!hasUrlPersonalization && !query) {
    const user = await requireUser();
    const { projectId } = await requireProjectMembership(user.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    });
    const c = (project?.conditions ?? {}) as {
      style?: string[];
      area?: string[];
      guestCount?: number;
      budget?: { min: number; max: number };
    };
    appliedConditions = {
      styles: c.style && c.style.length > 0 ? c.style : undefined,
      areas: c.area && c.area.length > 0 ? c.area : undefined,
      guestCount: typeof c.guestCount === "number" ? c.guestCount : undefined,
      budgetMax:
        typeof c.budget?.max === "number" && c.budget.max > 0 ? c.budget.max : undefined,
    };
  }

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

  const [venuesFromFilters, vibeVenues, favorites, aiSeed, savedSearches] = await Promise.all([
    getVenues(hasAnyFilter ? venueFilters : undefined),
    activeVibes.length > 0 ? filterVenuesByVibe(activeVibes) : Promise.resolve(null),
    getFavorites("mine"),
    getExploreAIRecommendationsSeed(),
    listSavedSearches().catch(() => []),
  ]);

  // When vibe filter is active, intersect with vibe results (OR match across vibes,
  // but venue must also satisfy other filters when they are set).
  let venues = venuesFromFilters;
  if (vibeVenues !== null) {
    const vibeIds = new Set(vibeVenues.map((v) => v.id));
    venues = venuesFromFilters.filter((v) => vibeIds.has(v.id));
  }

  const favoriteIds = favorites.map((f) => f.venue.id);
  // E-2 Fit Reasons — fetch after venues so we know which ids to ask for.
  // If conditions aren't set (new user), returns {} so cards render without
  // the gold italic line.
  const fitReasons = await getFitReasons(venues.map((v: { id: string }) => v.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-h1 font-serif font-extralight">式場を、見つける</h2>
        <p className="mt-1 text-meta text-muted-foreground">まだ知らない一つを</p>
      </div>

      {/* FAB + Sheet (client component, shared open state) */}
      <ExploreAddVenue defaultOpen={params.addVenue === "1"} />

      {/* Search bar */}
      <VenueSearchBar initialQuery={query} />

      {/* Personalized filter chips from onboarding conditions */}
      <VenuePersonalizedChips conditions={appliedConditions} />

      {/* R-2 気分で探す — vibe tag chips */}
      <VibeFilterChips activeVibes={activeVibes} />

      {/* AI Recommendations — always renders a stable container.
          Server-fetched seed (venueCount + conditions) is passed so the
          initial paint matches the final state and avoids the "appears
          then disappears" flicker users complained about. */}
      <AIRecommendations
        initialVenueCount={aiSeed.venueCount}
        initialConditions={aiSeed.conditions}
        shouldRequest={aiSeed.shouldRequest}
      />

      {/* Venue list with filters */}
      {venues.length === 0 ? (
        query ? (
          <div className="flex flex-col items-center gap-3">
            <EmptyState
              icon={Search}
              title="該当する式場がありません"
              description={`「${query}」に一致する式場は見つかりませんでした。キーワードを変えてお試しください。`}
              action={{ href: "/explore", label: "検索をクリア" }}
            />
            {/* Secondary CTA: let the user add a brand-new venue from URL when
                their search returned nothing. Reuses the AddVenueSheet auto-open
                pattern (?addVenue=1) already wired up in the header. */}
            <Link
              href="/explore?addVenue=1"
              prefetch={true}
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
            >
              URLから式場を追加
            </Link>
          </div>
        ) : (
          <EmptyState
            icon={Search}
            imageUrl="/images/empty-explore.png"
            imageAlt="式場を探す"
            title="式場さがしは、ここから"
            description="画面右下の「＋」からURLを貼るだけ。AIが自動で情報を読み取ります。"
          />
        )
      ) : (
        <ExploreContent
          venues={venues}
          favoriteIds={favoriteIds}
          baseFilters={hasAnyFilter ? venueFilters : undefined}
          fitReasons={fitReasons}
          savedSearchCount={savedSearches.length}
        />
      )}
    </div>
  );
}

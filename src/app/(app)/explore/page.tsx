import { getVenues } from "@/server/actions/venues";
import type { VenueFilters } from "@/server/actions/venue-filters";
import { getFavorites } from "@/server/actions/favorites";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { AddVenueSheet } from "@/components/explore/add-venue-sheet";
import { ExploreContent } from "@/components/explore/explore-content";
import { AIRecommendations } from "@/components/venues/ai-recommendations";
import { VenueSearchBar } from "@/components/venues/venue-search-bar";
import {
  VenuePersonalizedChips,
  type PersonalizedConditions,
} from "@/components/venues/venue-personalized-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import Link from "next/link";

type ExploreSearchParams = {
  q?: string;
  styles?: string | string[];
  areas?: string | string[];
  guestCount?: string;
  budgetMax?: string;
  personalized?: string;
  addVenue?: string;
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

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<ExploreSearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

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

  const [venues, favorites] = await Promise.all([
    getVenues(hasAnyFilter ? venueFilters : undefined),
    getFavorites("mine"),
  ]);

  const favoriteIds = favorites.map((f) => f.venue.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2>式場をさがす</h2>
          <AddVenueSheet defaultOpen={params.addVenue === "1"} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          URL貼付 or 検索で、気になる式場を集める場所
        </p>
      </div>

      {/* Search bar */}
      <VenueSearchBar initialQuery={query} />

      {/* Personalized filter chips from onboarding conditions */}
      <VenuePersonalizedChips conditions={appliedConditions} />

      {/* AI Recommendations — always visible */}
      <AIRecommendations />

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
            description="右上の「追加」からURLを貼るだけ。AIが自動で情報を読み取ります。"
          />
        )
      ) : (
        <ExploreContent
          venues={venues}
          favoriteIds={favoriteIds}
          baseFilters={hasAnyFilter ? venueFilters : undefined}
        />
      )}
    </div>
  );
}

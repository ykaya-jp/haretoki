import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getVenue } from "@/server/actions/venues";
import { getPartnerRatings } from "@/server/actions/ratings";
import { getFavorites } from "@/server/actions/favorites";
import { getVenueReviews, getVenueReviewEstimateAggregate } from "@/server/actions/reviews";
import { getVenuePlans } from "@/server/actions/plans";
import { VenuePhotoGallery } from "@/components/venues/venue-photo-gallery";
import { VenueHeader } from "@/components/venues/venue-header";
import { RatingSection } from "@/components/venues/rating-section";
import { EstimateSection } from "@/components/venues/estimate-section";
import { ReviewSection } from "@/components/venues/review-section";
import { PlanSection } from "@/components/venues/plan-section";
import { VenueActionBar } from "@/components/venues/venue-action-bar";
import { PartnerComparisonSummary } from "@/components/ratings/partner-comparison-summary";
import { VisitSection } from "@/components/visits/visit-section";
import { EstimateXRay } from "@/components/venues/estimate-xray";
import { EstimateWaterfallChart } from "@/components/venues/estimate-waterfall-chart";
import { VenueDetailBackLink } from "@/components/venues/back-link";
import { Skeleton } from "@/components/ui/skeleton";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Above-the-fold data is fetched synchronously so the header renders
  // immediately. getVenue already loads scores/estimates/visits in one query;
  // we reuse that single fetch rather than splitting it up.
  const [venue, favorites] = await Promise.all([
    getVenue(id),
    getFavorites("mine"),
  ]);

  if (!venue) notFound();

  const isFavorite = favorites.some((f) => f.venue.id === venue.id);

  // Extract user ratings into Record<dimension, score>
  const userRatings: Record<string, number> = {};
  for (const score of venue.scores) {
    if (score.source === "user_rating") {
      userRatings[score.dimension] = Number(score.score);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Back link — uses router.back() to preserve filter/scroll state on
          the referrer page (Explore, Candidates, Home all link here). */}
      <VenueDetailBackLink />

      {/* Photo Gallery — above the fold */}
      <VenuePhotoGallery
        venueId={venue.id}
        name={venue.name}
        photoUrls={venue.photoUrls}
      />

      {/* Venue Header — above the fold */}
      <VenueHeader
        name={venue.name}
        location={venue.location}
        accessInfo={venue.accessInfo}
        capacityMin={venue.capacityMin}
        capacityMax={venue.capacityMax}
        ceremonyStyles={venue.ceremonyStyles}
        status={venue.status}
      />

      {/* Rating Section — above the fold (needs synchronous userRatings) */}
      <Suspense
        fallback={<RatingSkeleton />}
      >
        <RatingWithPartner
          venueId={venue.id}
          userRatings={userRatings}
        />
      </Suspense>

      {/* Estimate Sections — synchronous data already loaded by getVenue,
          but wrap in Suspense so the charts can stream their client JS
          independently and users see the text first. */}
      {venue.estimates.length > 0 && (
        <EstimateSection
          venueId={venue.id}
          estimates={venue.estimates.map((e) => ({
            ...e,
            predictedFinal: e.predictedFinal,
            items: e.items.map((item) => ({ ...item })),
          }))}
        />
      )}

      {venue.estimates.length > 0 && venue.estimates[0].items.length > 0 && (
        <EstimateXRay
          items={venue.estimates[0].items.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            amount: item.amount,
            tier: item.tier,
            predictedUpgrade: item.predictedUpgrade ?? null,
            upgradeProbability: item.upgradeProbability
              ? Number(item.upgradeProbability)
              : null,
          }))}
          totalEstimate={venue.estimates[0].total}
          predictedFinal={venue.estimates[0].predictedFinal}
        />
      )}

      {venue.estimates.length > 0 && venue.estimates[0].predictedFinal && (
        <EstimateWaterfallChart
          initialTotal={venue.estimates[0].total}
          predictedFinal={venue.estimates[0].predictedFinal}
          items={venue.estimates[0].items.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            amount: item.amount,
            predictedUpgrade: item.predictedUpgrade ?? 0,
          }))}
        />
      )}

      {/* Below-the-fold sections — each streams independently via Suspense.
          This lets the server flush the HTML for the above-the-fold content
          before these queries finish, cutting perceived TTFB significantly. */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewsContent venueId={venue.id} />
      </Suspense>

      <Suspense fallback={<PlansSkeleton />}>
        <PlansContent venueId={venue.id} />
      </Suspense>

      <Suspense fallback={<VisitsSkeleton />}>
        <VisitsContent
          venueId={venue.id}
          venueName={venue.name}
          projectId={venue.projectId}
          visits={venue.visits}
        />
      </Suspense>

      {/* Action Bar */}
      <VenueActionBar
        venueId={venue.id}
        venueName={venue.name}
        isFavorite={isFavorite}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async child Server Components — each one is a Suspense boundary.
// ---------------------------------------------------------------------------

async function RatingWithPartner({
  venueId,
  userRatings,
}: {
  venueId: string;
  userRatings: Record<string, number>;
}) {
  const partnerRatingsData = await getPartnerRatings(venueId).catch(() => null);

  const partnerRatings: Record<string, number> = {};
  if (partnerRatingsData?.partnerRatings) {
    for (const [dim, score] of Object.entries(
      partnerRatingsData.partnerRatings.ratings,
    )) {
      partnerRatings[dim] = score;
    }
  }
  const hasPartner = Object.keys(partnerRatings).length > 0;

  return (
    <>
      <RatingSection
        venueId={venueId}
        initialRatings={userRatings}
        partnerRatings={hasPartner ? partnerRatings : undefined}
      />
      {hasPartner && (
        <PartnerComparisonSummary
          venueId={venueId}
          myRatings={userRatings}
          partnerRatings={partnerRatings}
        />
      )}
    </>
  );
}

async function ReviewsContent({ venueId }: { venueId: string }) {
  const [reviews, venueAgg] = await Promise.all([
    getVenueReviews(venueId),
    getVenueReviewEstimateAggregate(venueId),
  ]);
  return (
    <ReviewSection
      venueId={venueId}
      reviews={reviews.map((r) => ({
        id: r.id,
        source: r.source,
        sourceUrl: r.sourceUrl,
        aiSummary: r.aiSummary,
        sentiment: r.sentiment as Record<string, number> | null,
        rating: r.rating ? Number(r.rating) : null,
        categorySummary: r.categorySummary as Record<string, string> | null,
        isNegative: r.isNegative,
        estimateIncrease: r.estimateIncrease as {
          deltaYen?: number;
          deltaPct?: number;
          confidence?: "high" | "medium" | "low";
          note?: string;
        } | null,
      }))}
      venueEstimateAggregate={venueAgg}
    />
  );
}

async function PlansContent({ venueId }: { venueId: string }) {
  const plans = await getVenuePlans(venueId);
  return (
    <PlanSection
      venueId={venueId}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        basePrice: p.basePrice,
        guestCountMin: p.guestCountMin,
        guestCountMax: p.guestCountMax,
        includedItems: (p.includedItems as string[]) ?? [],
        excludedItems: (p.excludedItems as string[]) ?? [],
        bringInItems:
          (p.bringInItems as Array<{ item: string; fee?: number }>) ?? [],
        dressAllowance: p.dressAllowance,
        dressAllowanceNote: p.dressAllowanceNote,
        dressBrideCount: p.dressBrideCount,
        dressGroomCount: p.dressGroomCount,
        dressBudgetCapYen: p.dressBudgetCapYen,
        campaigns:
          (p.campaigns as Array<{ name: string; discount?: string }>) ?? [],
        notes: p.notes,
      }))}
    />
  );
}

// The visits payload is already loaded inside getVenue's single query; this
// wrapper exists purely to keep the rendering symmetric with the other
// Suspense children. It resolves immediately.
async function VisitsContent({
  venueId,
  venueName,
  projectId,
  visits,
}: {
  venueId: string;
  venueName: string;
  projectId: string;
  visits: NonNullable<Awaited<ReturnType<typeof getVenue>>>["visits"];
}) {
  return (
    <VisitSection
      venueId={venueId}
      venueName={venueName}
      projectId={projectId}
      visits={visits.map((v) => ({
        id: v.id,
        scheduledAt: v.scheduledAt,
        status: v.status,
        completedAt: v.completedAt,
        title: v.title,
        memo: v.memo,
        checklist:
          v.checklist?.map((c) => ({
            id: c.id,
            item: c.item,
            category: c.category,
            status: c.status,
            memo: c.memo,
            photoUrls: c.photoUrls,
          })) ?? [],
        notes:
          v.notes?.map((n) => ({
            id: n.id,
            content: n.content,
            tags: n.tags,
            locationLat: n.locationLat ? Number(n.locationLat) : null,
            locationLng: n.locationLng ? Number(n.locationLng) : null,
            createdAt: n.createdAt,
            media:
              n.media?.map((m) => ({
                id: m.id,
                type: m.type,
                mediaUrl: m.mediaUrl,
              })) ?? [],
          })) ?? [],
      }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton fallbacks — approximate real layout to avoid layout shift when
// each Suspense boundary resolves.
// ---------------------------------------------------------------------------

function RatingSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function VisitsSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

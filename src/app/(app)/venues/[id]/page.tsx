import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getVenueHeader,
  getVenueEstimates,
  getVenueVisits,
} from "@/server/actions/venues";
import { getPartnerRatings } from "@/server/actions/ratings";
import { getFavorites } from "@/server/actions/favorites";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { VibeTagEditor } from "@/components/venues/vibe-tag-editor";
import { getVenueReviews, getVenueReviewEstimateAggregate } from "@/server/actions/reviews";
import { getVenuePlans } from "@/server/actions/plans";
import { VenuePhotoGallery } from "@/components/venues/venue-photo-gallery";
import { VenueHeader } from "@/components/venues/venue-header";
import { RatingSection } from "@/components/venues/rating-section";
import { EstimateSection } from "@/components/venues/estimate-section";
import { MoneyReality } from "@/components/venues/money-reality";
import { getMoneyReality } from "@/server/actions/money-reality";
import { ReviewSection } from "@/components/venues/review-section";
import { VenueWhisper } from "@/components/venues/venue-whisper";
import { PlanSection } from "@/components/venues/plan-section";
import { VenueActionBar } from "@/components/venues/venue-action-bar";
import { PartnerComparisonSummary } from "@/components/ratings/partner-comparison-summary";
import { VisitSection } from "@/components/visits/visit-section";
import { EstimateXRay } from "@/components/venues/estimate-xray";
import { EstimateWaterfallChart } from "@/components/venues/estimate-waterfall-chart";
import { VenueDetailBackLink } from "@/components/venues/back-link";
import { VenueUpdatedBanner } from "@/components/venues/venue-updated-banner";
import { VenueSegmentsNav } from "@/components/venues/venue-segments-nav";
import { VenueFactSheet } from "@/components/venues/venue-fact-sheet";
import { VenueAmenitiesSection } from "@/components/venues/venue-amenities-section";
import { VenueCostBreakdown } from "@/components/venues/venue-cost-breakdown";
import { VenueCuisineSection } from "@/components/venues/venue-cuisine-section";
import { Skeleton } from "@/components/ui/skeleton";

const VENUE_SECTIONS = [
  { id: "overview", label: "概要" },
  { id: "estimate", label: "見積" },
  { id: "visit", label: "見学" },
  { id: "review", label: "口コミ" },
  { id: "ai", label: "AI解析" },
] as const;

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  console.log("[VenueDetailPage:enter]", { id });

  let user: Awaited<ReturnType<typeof requireUser>>;
  let membership: Awaited<ReturnType<typeof requireProjectMembership>>;
  let venue: Awaited<ReturnType<typeof getVenueHeader>>;
  let favorites: Awaited<ReturnType<typeof getFavorites>>;

  try {
    user = await requireUser();
    console.log("[VenueDetailPage:requireUser-ok]", { id, userId: user.id });
  } catch (err) {
    console.error("[VenueDetailPage:requireUser-fail]", { id, err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err });
    throw err;
  }
  try {
    membership = await requireProjectMembership(user.id);
    console.log("[VenueDetailPage:membership-ok]", { id, projectId: membership.projectId });
  } catch (err) {
    console.error("[VenueDetailPage:membership-fail]", { id, err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err });
    throw err;
  }
  const isOwner = membership.role === "owner";
  try {
    [venue, favorites] = await Promise.all([
      getVenueHeader(id),
      getFavorites("mine"),
    ]);
    console.log("[VenueDetailPage:fetch-ok]", { id, found: !!venue, favoritesCount: favorites.length });
  } catch (err) {
    console.error("[VenueDetailPage:fetch-fail]", { id, err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err });
    throw err;
  }

  if (!venue) {
    console.log("[VenueDetailPage:notFound]", { id });
    notFound();
  }

  // TEMP diagnostic — log the full venue shape so Vercel runtime-logs
  // surface any weird values that might be tripping the child renders
  // for specific venue IDs (2cc925ca, eaeff163 are currently breaking).
  // Prisma Decimal serializes poorly through JSON.stringify so convert
  // known decimal fields to strings up front.
  console.log("[VenueDetailPage:diagnostic]", {
    venueId: venue.id,
    name: venue.name,
    status: venue.status,
    photoUrls: venue.photoUrls,
    sourceUrls: venue.sourceUrls,
    vibeTags: venue.vibeTags,
    ceremonyStyles: venue.ceremonyStyles,
    location: venue.location,
    phoneNumber: venue.phoneNumber,
    latitude: venue.latitude,
    longitude: venue.longitude,
    serviceFeeRate:
      venue.serviceFeeRate == null ? null : String(venue.serviceFeeRate),
    cuisineTypes: venue.cuisineTypes,
    closedDays: venue.closedDays,
    scoresCount: venue.scores?.length ?? 0,
  });

  const isFavorite = favorites.some((f) => f.venue.id === venue.id);

  // Extract user ratings into Record<dimension, score>
  const userRatings: Record<string, number> = {};
  for (const score of venue.scores) {
    if (score.source === "user_rating") {
      userRatings[score.dimension] = Number(score.score);
    }
  }

  // TEMP: step 2 — add VenuePhotoGallery to the minimal render. If the
  // detail page now errors where step 1 rendered fine, the photo
  // component (or its next/image call on a fallback URL) is the
  // culprit. If it still renders, move on to the next suspect.
  console.log("[VenueDetailPage:step2-photo-only]", { id });
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>DEBUG step 2: {venue.name}</h1>
      <VenuePhotoGallery
        venueId={venue.id}
        name={venue.name}
        photoUrls={venue.photoUrls}
      />
      <pre style={{ fontSize: 12, marginTop: 24 }}>
        photos: {venue.photoUrls.length}
        {"\n"}
        first: {venue.photoUrls[0] ?? "(none)"}
      </pre>
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

async function EstimatesContent({ venueId }: { venueId: string }) {
  const [estimates, reviewEstimateAgg] = await Promise.all([
    getVenueEstimates(venueId),
    getVenueReviewEstimateAggregate(venueId),
  ]);

  if (estimates.length === 0) return null;

  const moneyReality = await getMoneyReality(estimates[0].id).catch(() => null);

  const reviewMeanFinal =
    reviewEstimateAgg?.deltaYen != null
      ? estimates[0].total + reviewEstimateAgg.deltaYen
      : undefined;

  return (
    <>
      <EstimateSection
        venueId={venueId}
        estimates={estimates.map((e) => ({
          ...e,
          predictedFinal: e.predictedFinal,
          // Coerce Prisma Decimal objects to plain numbers so the payload
          // can cross the Server → Client Component boundary without the
          // 'Only plain objects can be passed' warning.
          items: e.items.map((item) => ({
            ...item,
            amount: Number(item.amount),
            upgradeProbability:
              item.upgradeProbability != null
                ? Number(item.upgradeProbability)
                : null,
          })),
        }))}
      />

      {estimates[0].items.length > 0 && (
        <EstimateXRay
          items={estimates[0].items.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            amount: item.amount,
            tier: item.tier,
            predictedUpgrade: item.predictedUpgrade ?? null,
            upgradeProbability: item.upgradeProbability
              ? Number(item.upgradeProbability)
              : null,
          }))}
          totalEstimate={estimates[0].total}
          predictedFinal={estimates[0].predictedFinal}
        />
      )}

      {estimates[0].predictedFinal && (
        <EstimateWaterfallChart
          initialTotal={estimates[0].total}
          predictedFinal={estimates[0].predictedFinal}
          items={estimates[0].items.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            amount: item.amount,
            predictedUpgrade: item.predictedUpgrade ?? 0,
          }))}
          reviewMeanFinal={reviewMeanFinal}
          reviewSampleCount={reviewEstimateAgg?.sampleCount ?? undefined}
          reviewStdDevYen={reviewEstimateAgg?.standardDeviation ?? undefined}
        />
      )}

      {moneyReality && <MoneyReality report={moneyReality} />}
    </>
  );
}

async function ReviewsContent({ venueId }: { venueId: string }) {
  const [reviews, venueAgg] = await Promise.all([
    getVenueReviews(venueId),
    getVenueReviewEstimateAggregate(venueId),
  ]);
  return (
    <div className="space-y-5">
      {/* E-9 Venue Whisper: distilled 2-axis summary at the top. Falls back
          to no render when no reviews analyzed yet (0 noise). */}
      <VenueWhisper
        reviews={reviews.map((r) => ({
          categorySummary: r.categorySummary,
          isNegative: r.isNegative,
        }))}
        reviewEstimateAggregate={venueAgg}
      />

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
    </div>
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

async function VisitsContent({
  venueId,
  venueName,
  projectId,
}: {
  venueId: string;
  venueName: string;
  projectId: string;
}) {
  const visits = await getVenueVisits(venueId);
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

function EstimatesSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
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

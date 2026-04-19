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
import { RefreshVenueButton } from "@/components/venues/refresh-venue-button";
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

  // Fetch only the above-the-fold header + favorites synchronously.
  // requireUser / requireProjectMembership are React.cache'd, so the repeated
  // calls inside the Suspense children (getVenueEstimates, getVenueVisits, …)
  // reuse the same cached result — no extra DB round-trips.
  let user: Awaited<ReturnType<typeof requireUser>>;
  let membership: Awaited<ReturnType<typeof requireProjectMembership>>;
  let venue: Awaited<ReturnType<typeof getVenueHeader>>;
  let favorites: Awaited<ReturnType<typeof getFavorites>>;
  try {
    user = await requireUser();
    membership = await requireProjectMembership(user.id);
    [venue, favorites] = await Promise.all([
      getVenueHeader(id),
      getFavorites("mine"),
    ]);
  } catch (err) {
    // TEMP diagnostic for the "式場情報を読み込めませんでした" boundary —
    // the old Next.js log truncates the real message to "Route /venues/
    // [id]...". Log the full stack + venueId so Vercel runtime-logs can
    // surface it.
    console.error("[VenueDetailPage] top-level fetch failed", {
      venueId: id,
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }

  const isOwner = membership.role === "owner";

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
    <div className="space-y-10 pb-36">
      {/* Back link — uses router.back() to preserve filter/scroll state on
          the referrer page (Explore, Candidates, Home all link here). */}
      <VenueDetailBackLink variant="compact" />

      {/* Merged-import banner — present only when ?updated=1, self-scrubs. */}
      <VenueUpdatedBanner />

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

      {/* Owner-only refresh — re-runs the URL-import pipeline so deep
          extraction columns backfill for venues imported before those
          fields existed (R3). Hidden when there's no source URL to
          refresh from. */}
      {isOwner && (
        <div className="flex justify-end">
          <RefreshVenueButton
            venueId={venue.id}
            hasSourceUrl={(venue.sourceUrls ?? []).length > 0}
          />
        </div>
      )}

      {/* Sticky segmented control — scroll-spy via IntersectionObserver */}
      <VenueSegmentsNav sections={[...VENUE_SECTIONS]} />

      {/* ===== Overview section ===== */}
      <section id="overview" className="space-y-4">
        <div
          aria-hidden="true"
          className="h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] to-transparent"
        />

        {/* Rating Section — needs synchronous userRatings, partner fetch streams */}
        <Suspense fallback={<RatingSkeleton />}>
          <RatingWithPartner venueId={venue.id} userRatings={userRatings} />
        </Suspense>

        {/* Fact Sheet — external rating ★, address, phone, map.
            Each sub-field is null-safe; section hides itself when no data. */}
        <VenueFactSheet
          venueName={venue.name}
          externalRatingValue={venue.externalRatingValue}
          externalReviewCount={venue.externalReviewCount}
          postalCode={venue.postalCode}
          streetAddress={venue.streetAddress}
          latitude={venue.latitude}
          longitude={venue.longitude}
          phoneNumber={venue.phoneNumber}
        />
      </section>

      {/* ===== Estimate section ===== */}
      <section id="estimate" className="space-y-4">
        {/* Estimate sections — fetched in this Suspense child, streams independently */}
        <Suspense fallback={<EstimatesSkeleton />}>
          <EstimatesContent venueId={venue.id} />
        </Suspense>

        {/* Cost Breakdown — venue-published base fees (挙式料 / 演出料 /
            サービス料率). Complements the user's own estimate above.
            Hides when all three fields are null. */}
        <VenueCostBreakdown
          ceremonyFeeExact={venue.ceremonyFeeExact}
          productionFeeMin={venue.productionFeeMin}
          productionFeeMax={venue.productionFeeMax}
          serviceFeeRate={
            venue.serviceFeeRate != null ? Number(venue.serviceFeeRate) : null
          }
        />
      </section>

      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-[oklch(0.70_0.13_80/0.35)] to-transparent"
      />

      {/* Amenities — 設備と過ごし方 chip grid (parking / shuttle / lodging /
          2nd-party / barrier-free / operating hours / closed days).
          Sits above Visit so the user sees facility facts before planning
          a tour. Returns null when zero chips build. */}
      <VenueAmenitiesSection
        hasParking={venue.hasParking}
        parkingCapacity={venue.parkingCapacity}
        hasShuttle={venue.hasShuttle}
        hasAccommodation={venue.hasAccommodation}
        acceptsSecondParty={venue.acceptsSecondParty}
        barrierFree={venue.barrierFree}
        operatingHours={venue.operatingHours}
        closedDays={venue.closedDays}
      />

      {/* ===== Visit section ===== */}
      <section id="visit" className="space-y-4">
        {/* Below-the-fold sections — each streams independently via Suspense. */}
        <Suspense fallback={<VisitsSkeleton />}>
          <VisitsContent
            venueId={venue.id}
            venueName={venue.name}
            projectId={venue.projectId}
          />
        </Suspense>
      </section>

      {/* ===== Review section ===== */}
      <section id="review" className="space-y-4">
        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsContent venueId={venue.id} />
        </Suspense>
      </section>

      {/* Cuisine — 料理・シェフ. Sits just before AI Analysis so the
          reader anchors the AI opinion to concrete cuisine data. Null-safe. */}
      <VenueCuisineSection
        cuisineTypes={venue.cuisineTypes}
        chefCredentials={venue.chefCredentials}
      />

      {/* ===== AI analysis section ===== */}
      <section id="ai" className="space-y-4">
        <Suspense fallback={<PlansSkeleton />}>
          <PlansContent venueId={venue.id} />
        </Suspense>

        {/* VibeTag editor — owner only */}
        {isOwner && (
          <VibeTagEditor venueId={venue.id} initialTags={venue.vibeTags} />
        )}
      </section>

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

async function EstimatesContent({ venueId }: { venueId: string }) {
  const [estimates, reviewEstimateAgg] = await Promise.all([
    getVenueEstimates(venueId),
    getVenueReviewEstimateAggregate(venueId),
  ]);

  if (estimates.length === 0) return null;

  // E-6: Money Reality for the most recent estimate (full static analysis,
  // no Claude). Catch so a bad report never blocks the estimate UI.
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

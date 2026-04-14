import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getVenue } from "@/server/actions/venues";
import { getPartnerRatings } from "@/server/actions/ratings";
import { getFavorites } from "@/server/actions/favorites";
import { getVenueReviews } from "@/server/actions/reviews";
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

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue, partnerRatingsData, favorites, reviews, plans] = await Promise.all([
    getVenue(id),
    getPartnerRatings(id).catch(() => null),
    getFavorites("mine"),
    getVenueReviews(id),
    getVenuePlans(id),
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

  // Extract partner ratings
  const partnerRatings: Record<string, number> = {};
  if (partnerRatingsData?.partnerRatings) {
    for (const [dim, score] of Object.entries(
      partnerRatingsData.partnerRatings.ratings,
    )) {
      partnerRatings[dim] = score;
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Back link */}
      <Link
        href="/explore"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground -ml-1 active:opacity-70"
      >
        <ChevronLeft className="h-4 w-4" />
        戻る
      </Link>

      {/* Photo Gallery */}
      <VenuePhotoGallery
        venueId={venue.id}
        name={venue.name}
        photoUrls={venue.photoUrls}
      />

      {/* Venue Header */}
      <VenueHeader
        name={venue.name}
        location={venue.location}
        accessInfo={venue.accessInfo}
        capacityMin={venue.capacityMin}
        capacityMax={venue.capacityMax}
        ceremonyStyles={venue.ceremonyStyles}
        status={venue.status}
      />

      {/* Rating Section */}
      <RatingSection
        venueId={venue.id}
        initialRatings={userRatings}
        partnerRatings={
          Object.keys(partnerRatings).length > 0 ? partnerRatings : undefined
        }
      />

      {/* Partner Comparison Summary */}
      {Object.keys(partnerRatings).length > 0 && (
        <PartnerComparisonSummary
          venueId={venue.id}
          myRatings={userRatings}
          partnerRatings={partnerRatings}
        />
      )}

      {/* Estimate Section */}
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

      {/* Estimate X-Ray */}
      {venue.estimates.length > 0 && venue.estimates[0].items.length > 0 && (
        <EstimateXRay
          items={venue.estimates[0].items.map((item) => ({
            category: item.category,
            itemName: item.itemName,
            amount: item.amount,
            tier: item.tier,
            predictedUpgrade: item.predictedUpgrade ?? null,
            upgradeProbability: item.upgradeProbability ? Number(item.upgradeProbability) : null,
          }))}
          totalEstimate={venue.estimates[0].total}
          predictedFinal={venue.estimates[0].predictedFinal}
        />
      )}

      {/* Waterfall Chart — estimate cost increase visualization */}
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

      {/* Review Section */}
      <ReviewSection
        venueId={venue.id}
        reviews={reviews.map(r => ({
          id: r.id,
          source: r.source,
          sourceUrl: r.sourceUrl,
          aiSummary: r.aiSummary,
          sentiment: r.sentiment as Record<string, number> | null,
          rating: r.rating ? Number(r.rating) : null,
          categorySummary: r.categorySummary as Record<string, string> | null,
          isNegative: r.isNegative,
        }))}
      />

      {/* Plan Section */}
      <PlanSection
        plans={plans.map(p => ({
          id: p.id,
          name: p.name,
          basePrice: p.basePrice,
          guestCountMin: p.guestCountMin,
          guestCountMax: p.guestCountMax,
          includedItems: (p.includedItems as string[]) ?? [],
          excludedItems: (p.excludedItems as string[]) ?? [],
          bringInItems: (p.bringInItems as Array<{ item: string; fee?: number }>) ?? [],
          dressAllowance: p.dressAllowance,
          campaigns: (p.campaigns as Array<{ name: string; discount?: string }>) ?? [],
          notes: p.notes,
        }))}
      />

      {/* Visit Section */}
      <VisitSection
        venueId={venue.id}
        venueName={venue.name}
        projectId={venue.projectId}
        visits={venue.visits.map(v => ({
          id: v.id,
          scheduledAt: v.scheduledAt,
          status: v.status,
          completedAt: v.completedAt,
          title: v.title,
          memo: v.memo,
          checklist: v.checklist?.map(c => ({ id: c.id, item: c.item, category: c.category, status: c.status, memo: c.memo, photoUrls: c.photoUrls })) ?? [],
          notes: v.notes?.map(n => ({
            id: n.id,
            content: n.content,
            tags: n.tags,
            locationLat: n.locationLat ? Number(n.locationLat) : null,
            locationLng: n.locationLng ? Number(n.locationLng) : null,
            createdAt: n.createdAt,
            media: n.media?.map(m => ({ id: m.id, type: m.type, mediaUrl: m.mediaUrl })) ?? [],
          })) ?? [],
        }))}
      />

      {/* Action Bar */}
      <VenueActionBar venueId={venue.id} venueName={venue.name} isFavorite={isFavorite} />
    </div>
  );
}

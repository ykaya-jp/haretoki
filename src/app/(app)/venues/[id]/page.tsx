import { notFound } from "next/navigation";
import { getVenue } from "@/server/actions/venues";
import { getPartnerRatings } from "@/server/actions/ratings";
import { getFavorites } from "@/server/actions/favorites";
import { getVenueReviews } from "@/server/actions/reviews";
import { PhotoCarousel } from "@/components/venues/photo-carousel";
import { VenueHeader } from "@/components/venues/venue-header";
import { RatingSection } from "@/components/venues/rating-section";
import { EstimateSection } from "@/components/venues/estimate-section";
import { ReviewSection } from "@/components/venues/review-section";
import { VenueActionBar } from "@/components/venues/venue-action-bar";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue, partnerRatingsData, favorites, reviews] = await Promise.all([
    getVenue(id),
    getPartnerRatings(id).catch(() => null),
    getFavorites("mine"),
    getVenueReviews(id),
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
      {/* Photo Gallery */}
      <PhotoCarousel
        photos={venue.photoUrls}
        alt={venue.name}
        aspectRatio="4/3"
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
        }))}
      />

      {/* Visit Section - placeholder for R3 */}
      <section className="space-y-2">
        <h2 className="text-base">見学記録</h2>
        <p className="text-sm text-muted-foreground">
          見学の記録をここに残せます（Release 3で実装予定）
        </p>
      </section>

      {/* Action Bar */}
      <VenueActionBar venueId={venue.id} isFavorite={isFavorite} />
    </div>
  );
}

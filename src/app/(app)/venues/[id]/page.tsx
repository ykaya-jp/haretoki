import { notFound } from "next/navigation";
import { MapPin, Users, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueStatusSelect } from "@/components/venues/venue-status-select";
import { VenueRatingsSection } from "@/components/venues/venue-ratings-section";
import { EstimateSection } from "@/components/venues/estimate-section";
import { getVenue } from "@/server/actions/venues";
import { getPartnerRatings } from "@/server/actions/ratings";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [venue, partnerRatingsData] = await Promise.all([
    getVenue(id),
    getPartnerRatings(id).catch(() => null),
  ]);

  if (!venue) notFound();

  // Extract existing user_rating scores into a Record<dimension, score>
  const existingScores: Record<string, number> = {};
  for (const s of venue.scores) {
    if (s.source === "user_rating") {
      existingScores[s.dimension] = Number(s.score);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold">{venue.name}</h1>
            <VenueStatusSelect
              venueId={venue.id}
              currentStatus={venue.status}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {venue.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {venue.location}
              </span>
            )}
            {(venue.capacityMin || venue.capacityMax) && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {venue.capacityMin && venue.capacityMax
                  ? `${venue.capacityMin}〜${venue.capacityMax}名`
                  : venue.capacityMax
                    ? `〜${venue.capacityMax}名`
                    : `${venue.capacityMin}名〜`}
              </span>
            )}
          </div>

          {venue.accessInfo && (
            <p className="mt-1 text-sm text-muted-foreground">
              {venue.accessInfo}
            </p>
          )}
        </div>
      </div>

      {/* Source URLs */}
      {venue.sourceUrls.length > 0 && (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-base">参考リンク</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {venue.sourceUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {url}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ratings */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">評価</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueRatingsSection
            venueId={venue.id}
            initialScores={existingScores}
            ownerRatings={partnerRatingsData?.ownerRatings}
            partnerRatings={partnerRatingsData?.partnerRatings}
          />
        </CardContent>
      </Card>

      {/* Estimates */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">見積もり</CardTitle>
        </CardHeader>
        <CardContent>
          <EstimateSection
            venueId={venue.id}
            estimates={venue.estimates.map((e) => ({
              ...e,
              predictedFinal: e.predictedFinal,
              items: e.items.map((item) => ({
                ...item,
              })),
            }))}
          />
        </CardContent>
      </Card>

      {/* Visit Notes - Phase 2 placeholder */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">見学メモ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 2で見学メモ・写真記録機能が追加されます
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

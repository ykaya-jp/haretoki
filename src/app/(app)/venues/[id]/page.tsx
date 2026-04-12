import { notFound } from "next/navigation";
import { MapPin, Users, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { getVenue } from "@/server/actions/venues";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await getVenue(id);

  if (!venue) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold">{venue.name}</h1>
            <VenueStatusBadge status={venue.status} />
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

      {/* Placeholder sections for future tasks */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">評価</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            見学後に評価を追加できます
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">見積もり</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            見積もりはまだ登録されていません
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">見学メモ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            見学メモはまだありません
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

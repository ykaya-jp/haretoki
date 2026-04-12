import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { getScoreColor } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Venue, VenueScore } from "@/generated/prisma/client";

type VenueWithScores = Venue & { scores: VenueScore[] };

function calcAverageScore(scores: VenueScore[]): number | null {
  const userScores = scores.filter((s) => s.source === "user_rating");
  if (userScores.length === 0) return null;
  const sum = userScores.reduce((acc, s) => acc + Number(s.score), 0);
  return sum / userScores.length;
}

export function VenueCard({ venue }: { venue: VenueWithScores }) {
  const avgScore = calcAverageScore(venue.scores);

  return (
    <Link href={`/venues/${venue.id}`}>
      <Card className="shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <span className="text-lg" role="img" aria-label="venue">
              🏛
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{venue.name}</span>
              <VenueStatusBadge status={venue.status} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {venue.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {venue.location}
                </span>
              )}
              {(venue.capacityMin || venue.capacityMax) && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {venue.capacityMin && venue.capacityMax
                    ? `${venue.capacityMin}〜${venue.capacityMax}名`
                    : venue.capacityMax
                      ? `〜${venue.capacityMax}名`
                      : `${venue.capacityMin}名〜`}
                </span>
              )}
            </div>
          </div>

          {avgScore !== null && (
            <span
              className={cn(
                "shrink-0 text-lg font-bold",
                getScoreColor(avgScore),
              )}
            >
              {avgScore.toFixed(1)}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

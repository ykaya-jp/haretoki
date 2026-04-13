import Link from "next/link";
import { Star } from "lucide-react";
import { PhotoCarousel } from "@/components/venues/photo-carousel";
import { HeartButton } from "@/components/venues/heart-button";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import type { Venue, VenueScore, Estimate } from "@/generated/prisma/client";

type VenueWithScores = Venue & {
  scores: VenueScore[];
  estimates?: Estimate[];
};

interface VenueCardProps {
  venue: VenueWithScores;
  isFavorite?: boolean;
}

function calcAverageScore(scores: VenueScore[]): number | null {
  const userScores = scores.filter((s) => s.source === "user_rating");
  if (userScores.length === 0) return null;
  const sum = userScores.reduce((acc, s) => acc + Number(s.score), 0);
  return sum / userScores.length;
}

export function VenueCard({ venue, isFavorite = false }: VenueCardProps) {
  const avgScore = calcAverageScore(venue.scores);

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.98]">
      {/* Photo section */}
      <div className="relative">
        <Link href={`/venues/${venue.id}`}>
          <PhotoCarousel
            photos={venue.photoUrls}
            alt={venue.name}
            aspectRatio="4/3"
          />
        </Link>

        {/* Status badge - top left */}
        <div className="absolute left-3 top-3">
          <VenueStatusBadge status={venue.status} />
        </div>

        {/* Heart button - top right */}
        <div className="absolute right-3 top-3">
          <HeartButton venueId={venue.id} initialFavorite={isFavorite} />
        </div>
      </div>

      {/* Info section */}
      <Link href={`/venues/${venue.id}`} className="block p-4">
        {/* Venue name */}
        <h3 className="truncate font-serif text-base font-medium tracking-[0.05em]">
          {venue.name}
        </h3>

        {/* Score + Location */}
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {avgScore !== null && (
            <>
              <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
              <span className="tabular-nums font-medium text-foreground">
                {avgScore.toFixed(1)}
              </span>
              <span className="mx-0.5">·</span>
            </>
          )}
          {venue.location && <span>{venue.location}</span>}
        </div>

        {/* Capacity + Price */}
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {(venue.capacityMin || venue.capacityMax) && (
            <>
              <span>
                着席
                {venue.capacityMin && venue.capacityMax
                  ? `${venue.capacityMin}〜${venue.capacityMax}名`
                  : venue.capacityMax
                    ? `〜${venue.capacityMax}名`
                    : `${venue.capacityMin}名〜`}
              </span>
              {venue.estimates?.[0] && <span className="mx-0.5">·</span>}
            </>
          )}
          {venue.estimates?.[0] && (
            <span className="tabular-nums font-medium text-[var(--gold-warm)]">
              ¥{(venue.estimates[0].total / 10000).toFixed(0)}万〜
            </span>
          )}
        </div>

        {/* Style tags */}
        {venue.ceremonyStyles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {venue.ceremonyStyles.map((style) => (
              <span
                key={style}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {style}
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}

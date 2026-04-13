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
  const hasCost = venue.costMin || venue.costMax;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 active:scale-[0.98]">
      {/* Photo section — larger, with gradient overlay */}
      <div className="relative">
        <Link href={`/venues/${venue.id}`}>
          <PhotoCarousel
            photos={venue.photoUrls}
            alt={venue.name}
            aspectRatio="4/3"
          />
          {/* Gradient overlay at bottom of photo */}
          {venue.photoUrls.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent" />
          )}
        </Link>

        {/* Status badge - top left */}
        <div className="absolute left-3 top-3">
          <VenueStatusBadge status={venue.status} />
        </div>

        {/* Score badge - top right (before heart) */}
        {avgScore !== null && (
          <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
            <span className="tabular-nums text-sm font-medium text-white">
              {avgScore.toFixed(1)}
            </span>
          </div>
        )}

        {/* Heart button - top right */}
        <div className="absolute right-3 top-3">
          <HeartButton venueId={venue.id} initialFavorite={isFavorite} />
        </div>
      </div>

      {/* Info section — generous padding */}
      <Link href={`/venues/${venue.id}`} className="block p-6">
        {/* Venue name — serif, larger */}
        <h3 className="truncate font-serif text-lg font-medium tracking-[0.05em]">
          {venue.name}
        </h3>

        {/* Location */}
        {venue.location && (
          <p className="mt-1 text-sm text-muted-foreground">{venue.location}</p>
        )}

        {/* Cost + Capacity row */}
        <div className="mt-2 flex items-center gap-2 text-sm">
          {hasCost && (
            <span className="tabular-nums font-medium text-[var(--gold-warm)]">
              {venue.costMin && venue.costMax
                ? `${(venue.costMin / 10000).toFixed(0)}〜${(venue.costMax / 10000).toFixed(0)}万円`
                : venue.costMax
                  ? `〜${(venue.costMax / 10000).toFixed(0)}万円`
                  : `${(venue.costMin! / 10000).toFixed(0)}万円〜`}
            </span>
          )}
          {!hasCost && venue.estimates?.[0] && (
            <span className="tabular-nums font-medium text-[var(--gold-warm)]">
              ¥{(venue.estimates[0].total / 10000).toFixed(0)}万〜
            </span>
          )}
          {(hasCost || venue.estimates?.[0]) && (venue.capacityMin || venue.capacityMax) && (
            <span className="text-muted-foreground">·</span>
          )}
          {(venue.capacityMin || venue.capacityMax) && (
            <span className="text-muted-foreground">
              着席
              {venue.capacityMin && venue.capacityMax
                ? `${venue.capacityMin}〜${venue.capacityMax}名`
                : venue.capacityMax
                  ? `〜${venue.capacityMax}名`
                  : `${venue.capacityMin}名〜`}
            </span>
          )}
        </div>

        {/* Style tags + dress info */}
        {(venue.ceremonyStyles.length > 0 || venue.dressBringIn) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.ceremonyStyles.map((style) => (
              <span
                key={style}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {style}
              </span>
            ))}
            {venue.dressBringIn && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                持ち込み{venue.dressBringIn === "allowed" ? "可" : venue.dressBringIn === "not_allowed" ? "不可" : "要相談"}
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}

import { Star } from "lucide-react";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { PhotoCarousel } from "@/components/venues/photo-carousel";
import { HeartButton } from "@/components/venues/heart-button";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { computeCompositeScore } from "@/lib/venue-score";
import type { Venue, VenueScore, Estimate } from "@/generated/prisma/client";

type VenueWithScores = Venue & {
  scores: VenueScore[];
  estimates?: Estimate[];
};

interface VenueCardProps {
  venue: VenueWithScores;
  isFavorite?: boolean;
}

export function VenueCard({ venue, isFavorite = false }: VenueCardProps) {
  const avgScore = computeCompositeScore(venue.scores);
  const hasCost = venue.costMin || venue.costMax;

  // V1 Visual: hotel-brochure feel — 3:2 photo, larger serif name,
  // metadata · separated, gold eyebrow price, generous radius (24px).
  const priceLabel: string | null = hasCost
    ? venue.costMin && venue.costMax
      ? `${(venue.costMin / 10000).toFixed(0)}〜${(venue.costMax / 10000).toFixed(0)}万円`
      : venue.costMax
        ? `〜${(venue.costMax / 10000).toFixed(0)}万円`
        : `${(venue.costMin! / 10000).toFixed(0)}万円〜`
    : venue.estimates?.[0]
      ? `¥${(venue.estimates[0].total / 10000).toFixed(0)}万〜`
      : null;

  const capacityLabel: string | null =
    venue.capacityMin || venue.capacityMax
      ? `着席${
          venue.capacityMin && venue.capacityMax
            ? `${venue.capacityMin}〜${venue.capacityMax}名`
            : venue.capacityMax
              ? `〜${venue.capacityMax}名`
              : `${venue.capacityMin}名〜`
        }`
      : null;

  const metaParts = [venue.location, capacityLabel].filter(
    (s): s is string => Boolean(s),
  );

  return (
    <div className="group overflow-hidden rounded-[var(--r-lg)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out md:hover:shadow-[var(--shadow-elevated)] md:hover:-translate-y-0.5 active:scale-[0.98] active:duration-100">
      {/* Photo section — 3:2 hotel-brochure ratio, gold hairline below */}
      <div className="relative border-b border-[var(--gold-subtle)]/40">
        <PrefetchLink href={`/venues/${venue.id}`}>
          <PhotoCarousel
            photos={venue.photoUrls}
            alt={venue.name}
            aspectRatio="3/2"
          />
          {/* Gradient overlay at bottom of photo */}
          {venue.photoUrls.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
          )}
        </PrefetchLink>

        {/* Status badge - top left */}
        <div className="absolute left-3 top-3">
          <VenueStatusBadge status={venue.status} />
        </div>

        {/* Score badge - bottom left */}
        {avgScore !== null && (
          <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
            <span className="tabular-nums text-sm font-normal text-white">
              {avgScore.toFixed(1)}
            </span>
          </div>
        )}

        {/* Heart button - top right */}
        <div className="absolute right-3 top-3">
          <HeartButton venueId={venue.id} initialFavorite={isFavorite} />
        </div>
      </div>

      {/* Info section — generous padding, hotel-brochure typography */}
      <PrefetchLink href={`/venues/${venue.id}`} className="block p-6">
        {/* Price as eyebrow — gold, uppercase tracking, tabular */}
        {priceLabel && (
          <p className="text-eyebrow tabular-nums text-[var(--gold-warm)] mb-2">
            {priceLabel}
          </p>
        )}

        {/* Venue name — bigger, serif, extralight */}
        <h3 className="truncate text-h2 font-serif font-extralight tracking-[-0.01em]">
          {venue.name}
        </h3>

        {/* Metadata — location · capacity, meta size, bullet separators */}
        {metaParts.length > 0 && (
          <p className="mt-2 text-meta text-muted-foreground">
            {metaParts.join(" · ")}
          </p>
        )}

        {/* Style tags + dress info */}
        {(venue.ceremonyStyles.length > 0 || venue.dressBringIn) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {venue.ceremonyStyles.map((style) => (
              <span
                key={style}
                className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground"
              >
                {style}
              </span>
            ))}
            {venue.dressBringIn && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground">
                持ち込み{venue.dressBringIn === "allowed" ? "可" : venue.dressBringIn === "not_allowed" ? "不可" : "要相談"}
              </span>
            )}
          </div>
        )}
      </PrefetchLink>
    </div>
  );
}

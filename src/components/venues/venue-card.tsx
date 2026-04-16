import { Star, Sparkles } from "lucide-react";
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
  /**
   * E-2 Fit Reason: AI-generated one-liner like
   * "天井 12m と緑の中庭 — ふたりの『光と緑』に合います".
   * Null or undefined = render no fit line (conditions not set yet, or
   * generation failed). Shown between photo and info block in gold italics.
   */
  fitReason?: string | null;
}

export function VenueCard({ venue, isFavorite = false, fitReason = null }: VenueCardProps) {
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

  const isDecided = venue.status === "selected";

  return (
    <div
      className="group relative overflow-hidden rounded-[var(--r-lg)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out md:hover:shadow-[var(--shadow-elevated)] md:hover:-translate-y-0.5 active:scale-[0.98] active:duration-100"
      style={
        isDecided
          ? {
              boxShadow:
                "0 0 0 2px color-mix(in oklab, var(--gold-warm) 55%, transparent), 0 1px 3px rgba(42,35,32,0.04), 0 12px 28px color-mix(in oklab, var(--gold-warm) 14%, transparent)",
            }
          : undefined
      }
    >
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

        {/* "晴れの日" chip — decided venue only, bottom right */}
        {isDecided && (
          <div
            aria-label="決まった場所"
            className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.12em] uppercase text-white backdrop-blur-sm"
            style={{
              background:
                "color-mix(in oklab, var(--gold-warm) 85%, transparent)",
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.15), 0 6px 16px color-mix(in oklab, var(--gold-warm) 30%, transparent)",
            }}
          >
            晴れの日
          </div>
        )}
      </div>

      {/* E-2 Fit Reason — AI 1-line match reason (optional, gold italic) */}
      {fitReason && (
        <p
          aria-label="AI による相性コメント"
          className="flex items-start gap-2 px-6 pt-5 text-[13px] leading-relaxed font-light italic tracking-[0.01em] text-[var(--gold-warm)]"
        >
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.6}
          />
          <span>{fitReason}</span>
        </p>
      )}

      {/* Info section — generous padding, hotel-brochure typography */}
      <PrefetchLink href={`/venues/${venue.id}`} className={fitReason ? "block px-6 pt-3 pb-6" : "block p-6"}>
        {/* Price as eyebrow — gold, uppercase tracking, tabular */}
        {priceLabel && (
          <p className="text-eyebrow tabular-nums text-[var(--gold-warm)] mb-2">
            {priceLabel}
          </p>
        )}

        {/* Venue name — bigger, serif, extralight */}
        <h3 className="truncate text-h2 font-[family-name:var(--font-display)] font-extralight tracking-[-0.01em]">
          {venue.name}
        </h3>

        {/* Metadata — location · capacity, meta size, bullet separators */}
        {metaParts.length > 0 && (
          <p className="mt-2 text-meta text-muted-foreground">
            {metaParts.join(" · ")}
          </p>
        )}

        {/* Style tags + dress info — both fields are optional at the type
            level because some callers (e.g. /candidates favorites loader)
            stripped them previously; fall back to empty list / null so the
            render can't crash if a consumer forgets to map them through. */}
        {((venue.ceremonyStyles?.length ?? 0) > 0 || venue.dressBringIn) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(venue.ceremonyStyles ?? []).map((style) => (
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

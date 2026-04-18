import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { ComparisonVenue } from "@/lib/comparison-types";
import { computeCompositeScore } from "@/lib/venue-score";

/**
 * Sticky venue header that sits on top of each column.
 *
 * Layout contract: three rows with fixed heights stacked so that every
 * column's star row lands on the exact same vertical baseline. The v2
 * implementation used `flex items-center` which let shorter names collapse
 * the column and pushed the star up — that's what created the "star
 * drift" bug from Phase 1 findings.
 *
 * Heights are intentional:
 * - Photo: 60px tall (88 wide, 3:2 ish)   — keeps the card compact
 * - Name:  36px tall clamp-2              — accommodates 1- or 2-line names
 * - Rating: 20px tall tabular-nums        — last baseline never moves
 *
 * Star uses tabular-nums so 4.5 and 5.0 align digit-for-digit across
 * columns (no "4.5" being narrower than "5.0").
 */

interface ComparisonHeaderColumnProps {
  venue: ComparisonVenue;
}

export function ComparisonHeaderColumn({ venue }: ComparisonHeaderColumnProps) {
  const composite = computeCompositeScore(venue.scores);
  // Prefer Haretoki's composite (includes user rating weight); fall back
  // to external rating only when no scores exist.
  const rating = composite ?? venue.externalRatingValue;
  const ratingSuffix =
    venue.externalReviewCount !== null && venue.externalReviewCount > 0
      ? `(${venue.externalReviewCount.toLocaleString("ja-JP")})`
      : null;

  return (
    <Link
      href={`/venues/${venue.id}`}
      className="flex flex-col items-center gap-1.5 px-2 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      {/* Photo — fixed 88x60 so every column's photo row is identical height */}
      <div className="h-[60px] w-[88px] overflow-hidden rounded-lg bg-muted">
        {venue.photoUrls[0] ? (
          <Image
            src={venue.photoUrls[0]}
            alt=""
            width={88}
            height={60}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : null}
      </div>

      {/* Name — fixed 36px height clamp-2 so baselines line up even when
          some names are 1 line and others are 2 */}
      <p
        className="line-clamp-2 text-center font-[family-name:var(--font-display)] text-[13px] font-light leading-[1.35] tracking-[-0.005em]"
        style={{ minHeight: "36px" }}
      >
        {venue.name}
      </p>

      {/* Rating row — fixed 20px so when some venues have a rating and
          others don't, the row below (first field label) still starts at
          the same y across columns */}
      <div
        className="flex items-center justify-center gap-1 text-[11px] text-[var(--gold-warm)]"
        style={{ height: "20px" }}
      >
        {rating !== null ? (
          <>
            <Star className="h-3 w-3 fill-current" strokeWidth={0} />
            <span className="tabular-nums font-medium">{rating.toFixed(1)}</span>
            {ratingSuffix && (
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {ratingSuffix}
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">—</span>
        )}
      </div>
    </Link>
  );
}

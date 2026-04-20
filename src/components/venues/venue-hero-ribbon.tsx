import { Star } from "lucide-react";

interface VenueHeroRibbonProps {
  /** Total estimate in yen from the couple's latest estimate — null when none recorded. */
  estimateTotal: number | null;
  /** External rating value (e.g. 4.47). Null hides the rating column. */
  externalRatingValue: number | null;
  /** External review count. Optional even when rating exists. */
  externalReviewCount: number | null;
}

/**
 * Hero ribbon — the first "decision-grade" fact panel directly below
 * the photo. Lifts two signals to the top of the page so couples can
 * judge fit in under two seconds:
 *
 *   left  col  — 総額目安 (their own estimate) or "見積もりはまだ" placeholder
 *   right col  — ★ external rating + review count (hidden when absent)
 *
 * Pattern borrowed from Zola / Booking / The Knot PDP. Display-scale
 * numeric so the numbers read from across the room; copy register
 * stays quiet so the hero itself still leads visually.
 */
export function VenueHeroRibbon({
  estimateTotal,
  externalRatingValue,
  externalReviewCount,
}: VenueHeroRibbonProps) {
  const hasPrice = estimateTotal != null && estimateTotal > 0;
  const hasRating = externalRatingValue != null && externalRatingValue > 0;

  // Section is invisible when neither signal is available — keeps the
  // page compact for brand-new venues with no data.
  if (!hasPrice && !hasRating) return null;

  const priceMan = hasPrice ? Math.round(estimateTotal! / 10000) : null;

  return (
    <section
      aria-label="この式場のあらまし"
      className="grid grid-cols-2 divide-x divide-border/60 rounded-2xl bg-card px-2 py-4 shadow-[var(--shadow-card-low)]"
    >
      {/* Price column — user's own latest estimate total. Falls back to
          an inviting "まだ見積もりがない" placeholder so the column isn't
          blank when rating alone is present. */}
      <div className="flex flex-col items-center justify-center gap-1 px-4">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          総額目安
        </p>
        {hasPrice ? (
          <p className="flex items-baseline gap-0.5 text-foreground">
            <span className="text-[11px] text-muted-foreground">¥</span>
            <span className="font-[family-name:var(--font-display)] text-[26px] font-light leading-none tabular-nums">
              {priceMan}
            </span>
            <span className="text-[11px] text-muted-foreground">万〜</span>
          </p>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">見積もりはまだ</p>
        )}
      </div>

      {/* Rating column — external star average + sample size. */}
      <div className="flex flex-col items-center justify-center gap-1 px-4">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          先輩の評価
        </p>
        {hasRating ? (
          <div className="flex items-baseline gap-1.5">
            <Star
              aria-hidden="true"
              className="h-4 w-4 translate-y-[2px] fill-[var(--gold-warm)] text-[var(--gold-warm)]"
              strokeWidth={1.4}
            />
            <span className="font-[family-name:var(--font-display)] text-[26px] font-light leading-none tabular-nums text-[var(--gold-warm)]">
              {externalRatingValue!.toFixed(2)}
            </span>
            {externalReviewCount != null && externalReviewCount > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                ({externalReviewCount.toLocaleString("ja-JP")})
              </span>
            )}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">口コミはこれから</p>
        )}
      </div>
    </section>
  );
}

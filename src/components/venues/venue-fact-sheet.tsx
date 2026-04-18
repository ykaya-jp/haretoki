"use client";

import { MapPin, Phone, Star } from "lucide-react";
import { useUpdatedHighlight } from "./use-updated-highlight";
import { cn } from "@/lib/utils";

interface VenueFactSheetProps {
  externalRatingValue: number | null;
  externalReviewCount: number | null;
  postalCode: string | null;
  streetAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  phoneNumber: string | null;
  /** Falls back for the map's aria-label and the Google Maps deep link text. */
  venueName: string;
}

/**
 * Fact Sheet — 基本情報 block rendered between Overview and Estimate on
 * `/venues/{id}`. Surfaces externalRating★ + review count, postal + street
 * address, tap-to-call phone, and a static OpenStreetMap iframe embed.
 *
 * Design notes:
 *   - Every subfield is independently nullable. The whole section is hidden
 *     when nothing is renderable (guard in the page, not here) — but defensive
 *     nulls in here too so the layout never shows empty rows.
 *   - Map uses OSM (no API key, no remotePatterns addition needed). A
 *     deep-link out to Google Maps is offered for driving directions since
 *     that's what most users will actually want to open.
 *   - `tabular-nums` on all numeric fields so the star rating, phone, and
 *     postal code line up cleanly on mobile. Phone is a `tel:` anchor with
 *     proper digit-stripping so iOS dials correctly.
 */
export function VenueFactSheet({
  externalRatingValue,
  externalReviewCount,
  postalCode,
  streetAddress,
  latitude,
  longitude,
  phoneNumber,
  venueName,
}: VenueFactSheetProps) {
  const highlight = useUpdatedHighlight();

  const hasRating =
    externalRatingValue != null && externalRatingValue > 0;
  const hasAddress = !!postalCode || !!streetAddress;
  const hasPhone = !!phoneNumber;
  const hasMap = latitude != null && longitude != null;

  // Section is invisible when truly nothing to show.
  if (!hasRating && !hasAddress && !hasPhone && !hasMap) {
    return null;
  }

  // OSM embed bbox — ~0.008 degrees around the pin (~900m square) gives
  // enough context to recognize the neighborhood on mobile without pinch.
  const bboxPad = 0.008;
  const osmEmbed =
    hasMap
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude! - bboxPad}%2C${latitude! - bboxPad}%2C${longitude! + bboxPad}%2C${latitude! + bboxPad}&layer=mapnik&marker=${latitude}%2C${longitude}`
      : null;

  // Google Maps deep link — name-based search is more reliable than lat/lng
  // for "get me driving directions to this specific venue" intent.
  const googleMapsUrl = hasMap
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}&query_place_id=`
    : null;

  // Phone dial URL — strip everything except digits and leading +.
  const phoneDialUrl = phoneNumber
    ? `tel:${phoneNumber.replace(/[^\d+]/g, "")}`
    : null;

  return (
    <section
      aria-label="基本情報"
      className={cn(
        "space-y-4 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(42,35,32,0.04),0_4px_12px_rgba(42,35,32,0.05)] transition-[box-shadow,outline] duration-500",
        highlight && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--gold-warm)" }}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          基本情報
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* External rating row */}
      {hasRating && (
        <div className="flex items-baseline gap-2">
          <Star
            aria-hidden="true"
            className="h-4 w-4 translate-y-[2px] fill-[var(--gold-warm)] text-[var(--gold-warm)]"
            strokeWidth={1.4}
          />
          <span className="font-[family-name:var(--font-display)] text-[22px] font-light leading-none tabular-nums text-[var(--gold-warm)]">
            {externalRatingValue!.toFixed(2)}
          </span>
          {externalReviewCount != null && externalReviewCount > 0 && (
            <span className="text-[12px] tabular-nums text-muted-foreground">
              （{externalReviewCount.toLocaleString("ja-JP")} 件の口コミ）
            </span>
          )}
        </div>
      )}

      {/* Address + phone rail */}
      {(hasAddress || hasPhone) && (
        <dl className="space-y-2.5 text-[13px] leading-relaxed">
          {hasAddress && (
            <div className="flex items-start gap-2.5">
              <MapPin
                aria-hidden="true"
                className="mt-[3px] h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.6}
              />
              <div className="min-w-0">
                <dt className="sr-only">住所</dt>
                <dd className="text-foreground">
                  {postalCode && (
                    <span className="mr-2 tabular-nums text-muted-foreground">
                      〒{postalCode}
                    </span>
                  )}
                  {streetAddress && <span>{streetAddress}</span>}
                </dd>
              </div>
            </div>
          )}
          {hasPhone && phoneDialUrl && (
            <div className="flex items-start gap-2.5">
              <Phone
                aria-hidden="true"
                className="mt-[3px] h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.6}
              />
              <div className="min-w-0">
                <dt className="sr-only">電話番号</dt>
                <dd>
                  <a
                    href={phoneDialUrl}
                    className="tabular-nums text-[var(--gold-warm)] underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {phoneNumber}
                  </a>
                </dd>
              </div>
            </div>
          )}
        </dl>
      )}

      {/* Map embed + Google Maps CTA */}
      {hasMap && osmEmbed && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border/70">
            {/* aspect 16:10 — tall enough to see the neighborhood, short
                enough to not dominate the section on mobile. */}
            <iframe
              title={`${venueName} の地図`}
              src={osmEmbed}
              loading="lazy"
              className="block aspect-[16/10] w-full border-0 bg-muted"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-[var(--gold-warm)] underline-offset-4 hover:underline"
            >
              Google Maps で開く →
            </a>
          )}
        </div>
      )}
    </section>
  );
}

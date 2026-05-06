"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import type { ComparisonVenue } from "@/lib/comparison-types";

/**
 * Photo cross-venue comparison grid — surfaces each venue's photo
 * gallery side-by-side so couples can compare visual atmosphere
 * without bouncing between venue detail pages.
 *
 * Layout:
 *   - Each venue gets a horizontal mini-carousel (3 photos visible,
 *     scroll for more) under its name.
 *   - Tap any photo → /venues/[id] for full gallery + lightbox.
 *   - Self-hides if no venue has photos.
 *
 * No new fetch — reuses ComparisonVenue.photoUrls already in the matrix.
 */
export function PhotoComparisonGrid({
  venues,
}: {
  venues: ComparisonVenue[];
}) {
  const venuesWithPhotos = venues.filter((v) => v.photoUrls.length > 0);
  const [expanded, setExpanded] = useState(false);

  if (venuesWithPhotos.length === 0) return null;

  // Compact mode: show first 1 photo per venue + "もっと見る" CTA.
  // Expanded: show 3 photos per venue.
  const photosPerVenue = expanded ? 3 : 1;

  return (
    <section
      aria-label="写真で比べる"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <Camera
            className="h-4 w-4 self-center text-[var(--gold-warm)]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <p className="text-eyebrow text-[var(--gold-warm)]">写真で比べる</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-fluid-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded ? "1 枚に戻す" : "3 枚ずつ見る"}
        </button>
      </div>

      <p className="mt-2 text-fluid-xs leading-relaxed text-muted-foreground">
        会場の雰囲気は、数字だけでは伝わりません。
      </p>

      <ul className="mt-3 space-y-3">
        {venuesWithPhotos.map((venue) => (
          <li key={venue.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/venues/${venue.id}`}
                prefetch={true}
                className="font-[family-name:var(--font-display)] text-fluid-sm font-light text-foreground hover:underline"
              >
                {venue.name}
              </Link>
              <span className="tabular-nums text-fluid-xs text-muted-foreground">
                {venue.photoUrls.length} 枚
              </span>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {venue.photoUrls.slice(0, photosPerVenue).map((url, i) => (
                <Link
                  key={`${venue.id}-${i}`}
                  href={`/venues/${venue.id}`}
                  prefetch={true}
                  className="relative block h-28 w-44 shrink-0 overflow-hidden rounded-xl bg-muted"
                  aria-label={`${venue.name} の写真 ${i + 1} 枚目`}
                >
                  <Image
                    src={url}
                    alt={`${venue.name} ${i + 1}`}
                    fill
                    sizes="176px"
                    className="object-cover transition-transform duration-200 active:scale-[0.98]"
                  />
                </Link>
              ))}
              {venue.photoUrls.length > photosPerVenue && (
                <Link
                  href={`/venues/${venue.id}`}
                  prefetch={true}
                  className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-fluid-xs text-muted-foreground hover:border-[var(--gold-warm)] hover:text-[var(--gold-warm)]"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  もっと
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

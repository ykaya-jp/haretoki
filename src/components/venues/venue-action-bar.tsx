"use client";

import { HeartButton } from "@/components/venues/heart-button";
import { ShareButton } from "@/components/venues/share-button";
import { HaloTap } from "@/components/ui/halo-tap";
import Link from "next/link";

interface VenueActionBarProps {
  venueId: string;
  venueName: string;
  isFavorite: boolean;
}

/**
 * Sticky bottom ActionBar — Heart + Share + primary CTA only.
 *
 * Destructive "この式場を削除" was previously sitting next to the primary
 * "比べる" link at 375px; couples mis-tapped it. Delete has moved to
 * VenueOverflowMenu (top-right of the page header), matching the
 * Airbnb / Zola / Resy pattern of never placing destructive actions
 * next to primary CTAs.
 */
export function VenueActionBar({ venueId, venueName, isFavorite }: VenueActionBarProps) {
  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border/40 bg-card/80 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <HeartButton venueId={venueId} initialFavorite={isFavorite} />
        <ShareButton venueName={venueName} />
        <HaloTap className="flex-1 rounded-full">
          <Link
            href={`/candidates?view=compare&venueIds=${venueId}`}
            prefetch={true}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
          >
            {/* Verb unified to "比べる" across both states so the CTA's
                action doesn't seem to change when the couple toggles
                the heart. The destination is now the consolidated
                compare view with the current venue preselected, so
                ♡ vs non-♡ no longer branches to different routes. */}
            {isFavorite ? "ほかの式場と比べる" : "候補に入れて比べる"}
          </Link>
        </HaloTap>
      </div>
    </div>
  );
}

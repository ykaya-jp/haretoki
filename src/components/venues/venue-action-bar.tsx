"use client";

import { HeartButton } from "@/components/venues/heart-button";
import { ShareButton } from "@/components/venues/share-button";
import Link from "next/link";

interface VenueActionBarProps {
  venueId: string;
  venueName: string;
  isFavorite: boolean;
}

export function VenueActionBar({ venueId, venueName, isFavorite }: VenueActionBarProps) {
  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border/40 bg-card/80 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <HeartButton venueId={venueId} initialFavorite={isFavorite} />
        <ShareButton venueName={venueName} />
        <Link
          href={`/venues/${venueId}/checklist`}
          prefetch={true}
          className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-transform active:scale-95 active:bg-muted"
        >
          チェック
        </Link>
        <Link
          href="/candidates"
          prefetch={true}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
        >
          {isFavorite ? "ほかの式場と比べる" : "候補に入れて比べる"}
        </Link>
      </div>
    </div>
  );
}

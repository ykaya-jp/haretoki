"use client";

import { HeartButton } from "@/components/venues/heart-button";
import Link from "next/link";

interface VenueActionBarProps {
  venueId: string;
  isFavorite: boolean;
}

export function VenueActionBar({ venueId, isFavorite }: VenueActionBarProps) {
  return (
    <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 border-t border-border bg-card px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <HeartButton venueId={venueId} initialFavorite={isFavorite} />
        <Link
          href="/candidates"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
        >
          {isFavorite ? "ほかの式場と比べる" : "お気に入りに追加して比べる"}
        </Link>
      </div>
    </div>
  );
}

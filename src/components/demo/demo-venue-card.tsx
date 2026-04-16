"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoData, type DemoVenue } from "./demo-data-provider";
import { motion } from "framer-motion";

interface DemoVenueCardProps {
  venue: DemoVenue;
}

// Visually mirrors <VenueCard> (V1 brochure tokens) but sources favorite
// state + photo mocks from the demo provider and uses a local-state heart.
export function DemoVenueCard({ venue }: DemoVenueCardProps) {
  const { favorites, toggleFavorite } = useDemoData();
  const isFavorite = favorites.has(venue.id);

  const priceLabel = `${(venue.costMin / 10000).toFixed(0)}〜${(venue.costMax / 10000).toFixed(0)}万円`;
  const capacityLabel = `着席${venue.capacityMin}〜${venue.capacityMax}名`;
  const metaParts = [venue.location, capacityLabel];

  return (
    <div className="group overflow-hidden rounded-[var(--r-lg)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out md:hover:shadow-[var(--shadow-elevated)] md:hover:-translate-y-0.5 active:scale-[0.98] active:duration-100">
      <div className="relative border-b border-[var(--gold-subtle)]/40">
        <Link href={`/demo/venues/${venue.id}`} className="block">
          <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
            {venue.photoUrls[0] ? (
              <Image
                src={venue.photoUrls[0]}
                alt={venue.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
                // Demo images may not exist — swallow fetch errors by rendering a
                // muted placeholder background underneath.
                unoptimized
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-[var(--gold-subtle)]/50 text-[var(--gold-warm)]"
              >
                <span className="font-[family-name:var(--font-display)] text-lg">{venue.name.slice(0, 2)}</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
        </Link>

        {venue.rating !== null && (
          <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
            <span className="tabular-nums text-sm font-normal text-white">
              {venue.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Demo heart — local-only state */}
        <div className="absolute right-3 top-3">
          <motion.button
            type="button"
            onClick={() => toggleFavorite(venue.id)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-[background-color,box-shadow] duration-200 hover:bg-card active:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)] focus-visible:ring-offset-2"
            whileTap={{ scale: 1.15 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <motion.div
              key={isFavorite ? "filled" : "empty"}
              initial={{ scale: 0.3 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
            >
              <Heart
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  isFavorite ? "fill-primary text-primary" : "fill-none text-primary/70",
                )}
              />
            </motion.div>
          </motion.button>
        </div>
      </div>

      <Link href={`/demo/venues/${venue.id}`} className="block p-6">
        <p className="text-eyebrow tabular-nums text-[var(--gold-warm)] mb-2">
          {priceLabel}
        </p>
        <h3 className="truncate text-h2 font-[family-name:var(--font-display)] font-extralight tracking-[-0.01em]">
          {venue.name}
        </h3>
        <p className="mt-2 text-meta text-muted-foreground">{metaParts.join(" · ")}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {venue.ceremonyStyles.map((style) => (
            <span
              key={style}
              className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground"
            >
              {style}
            </span>
          ))}
        </div>
      </Link>
    </div>
  );
}

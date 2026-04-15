"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Camera } from "lucide-react";
import { VenueImage } from "@/components/ui/venue-image";
import { PhotoLightbox } from "@/components/venues/photo-lightbox";
import { cn } from "@/lib/utils";

interface PhotoCarouselProps {
  photos: string[];
  alt: string;
  aspectRatio?: "4/3" | "16/9" | "3/2";
  onAddPhotoClick?: () => void;
}

// embla-carousel-react (~10KB gzipped) is only needed for 2+ photos. Single
// photos render a plain <Image>, so we dynamic-import the carousel shell to
// keep it out of the initial bundle for detail pages with 0 or 1 photo.
const PhotoCarouselEmbla = dynamic(
  () =>
    import("./photo-carousel-embla").then((m) => m.PhotoCarouselEmbla),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-muted"
      />
    ),
  },
);

export function PhotoCarousel({
  photos,
  alt,
  aspectRatio = "4/3",
  onAddPhotoClick,
}: PhotoCarouselProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (photos.length === 0) {
    const baseClasses = cn(
      "flex flex-col items-center justify-center gap-3 rounded-2xl",
      "border-2 border-dashed border-border bg-muted/30",
      "transition-all duration-200",
      aspectRatio === "4/3"
        ? "aspect-[4/3]"
        : aspectRatio === "3/2"
          ? "aspect-[3/2]"
          : "aspect-video",
    );
    if (onAddPhotoClick) {
      return (
        <button
          type="button"
          onClick={onAddPhotoClick}
          className={cn(
            baseClasses,
            "hover:border-[var(--gold-warm)] hover:bg-[var(--gold-subtle)]",
            "active:scale-[0.98] cursor-pointer",
          )}
          aria-label="写真を追加"
        >
          <Camera className="h-8 w-8 text-[var(--gold-warm)]" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              写真を追加しましょう
            </p>
            <p className="mt-1 text-xs text-muted-foreground">タップして選ぶ</p>
          </div>
        </button>
      );
    }
    return (
      <div className={baseClasses}>
        <Camera className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground">
          写真はまだありません
        </span>
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label={`${alt} の写真を拡大表示`}
          className={cn(
            "group relative block w-full overflow-hidden rounded-[var(--r-lg)] border-b border-[var(--gold-subtle)]/40 transition active:scale-[0.995]",
            aspectRatio === "4/3"
              ? "aspect-[4/3]"
              : aspectRatio === "3/2"
                ? "aspect-[3/2]"
                : "aspect-video",
          )}
        >
          <VenueImage
            src={photos[0]}
            alt={`${alt} - 写真`}
            fill
            priority
            tone="hero"
            className="rounded-[var(--r-lg)] object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[oklch(0_0_0_/_0.12)]"
          />
        </button>
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex ?? 0}
          open={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
        />
      </>
    );
  }

  return (
    <>
      <PhotoCarouselEmbla
        photos={photos}
        alt={alt}
        aspectRatio={aspectRatio}
        onPhotoClick={(i) => setLightboxIndex(i)}
      />
      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}

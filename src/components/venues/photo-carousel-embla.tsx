"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VenueImage } from "@/components/ui/venue-image";
import { cn } from "@/lib/utils";

interface PhotoCarouselEmblaProps {
  photos: string[];
  alt: string;
  aspectRatio: "4/3" | "16/9" | "3/2";
  onPhotoClick?: (index: number) => void;
}

// Multi-photo carousel. Split out from photo-carousel.tsx so that the
// embla-carousel-react dependency is only pulled in when the venue has 2+
// photos. For single-photo venues we render a plain <Image> without embla,
// which keeps the initial JS payload lighter on detail pages that only ever
// show one photo.
export function PhotoCarouselEmbla({
  photos,
  alt,
  aspectRatio,
  onPhotoClick,
}: PhotoCarouselEmblaProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!emblaApi) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi.scrollNext();
      }
    },
    [emblaApi],
  );

  return (
    /* APG carousel pattern: a region with aria-roledescription
       takes tabIndex=0 + arrow-key handlers so keyboard users can
       reach the carousel and navigate slides. jsx-a11y treats
       region as non-interactive, hence the rule disables with
       rationale on the carousel root. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="写真カルーセル"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)] focus-visible:ring-offset-2 rounded-2xl"
    >
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {photos.map((photo, index) => (
            /* Slide is only interactive when onPhotoClick is wired
               up (lightbox open). Without it, the slide is purely
               visual and binds no listeners. With it, role=button +
               tabIndex=0 + Enter/Space keyboard handler match the
               ESLint rule's "real interactive element" requirement.
               jsx-a11y can't statically narrow the conditional, so
               disable the both-paths rules on the slide opener. */
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              key={index}
              className={cn(
                "relative min-w-0 flex-[0_0_100%]",
                aspectRatio === "4/3"
                  ? "aspect-[4/3]"
                  : aspectRatio === "3/2"
                    ? "aspect-[3/2]"
                    : "aspect-video",
                onPhotoClick && "cursor-zoom-in",
              )}
              aria-label={`写真 ${index + 1}/${photos.length}`}
              role={onPhotoClick ? "button" : undefined}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={onPhotoClick ? 0 : undefined}
              onClick={onPhotoClick ? () => onPhotoClick(index) : undefined}
              onKeyDown={
                onPhotoClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPhotoClick(index);
                      }
                    }
                  : undefined
              }
            >
              <VenueImage
                src={photo}
                alt={`${alt} - 写真 ${index + 1}`}
                fill
                priority={index === 0}
                tone={index === selectedIndex ? "hero" : "default"}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {/* Bottom gradient overlay — only on the active item. Leaves
                  room for caption overlays and adds photographic depth. */}
              {index === selectedIndex && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[oklch(0_0_0_/_0.12)]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Navigation buttons */}
      {selectedIndex > 0 && (
        <button
          type="button"
          onClick={() => scrollTo(selectedIndex - 1)}
          aria-label="前の写真"
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(1_0_0_/_0.85)] text-foreground backdrop-blur-sm transition-all duration-200 hover:bg-[oklch(1_0_0_/_0.95)] active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
      )}
      {selectedIndex < photos.length - 1 && (
        <button
          type="button"
          onClick={() => scrollTo(selectedIndex + 1)}
          aria-label="次の写真"
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[oklch(1_0_0_/_0.85)] text-foreground backdrop-blur-sm transition-all duration-200 hover:bg-[oklch(1_0_0_/_0.95)] active:scale-95"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </button>
      )}
      {/* Caption band — venue name + slide counter on the active slide only.
          Additive overlay: does not intercept touch (pointer-events: none).
          Rendered only when 2+ photos so it doesn't clutter single-photo cards. */}
      {photos.length >= 2 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 flex max-w-[70%] items-center gap-2 rounded-full border border-border/40 bg-background/85 px-3 py-1.5 text-[11px] tracking-[0.04em] text-[var(--gold-warm)] shadow-[0_1px_4px_rgba(0,0,0,0.08)] backdrop-blur-sm animate-in fade-in duration-500"
        >
          <span className="truncate font-medium text-foreground/80">{alt}</span>
          <span className="tabular-nums text-[var(--gold-warm)]">
            {selectedIndex + 1}/{photos.length}
          </span>
        </div>
      )}
      {/* Dot indicators — visual dot is 6-8px, tap target is 44x44px.
          Rails over 5 dots (6+ photos) overflow 375px viewports, so we
          swap to a compact counter pill that's always horizontally
          centered and never wraps. Still navigable — swipe + the
          top-left counter still work. */}
      {photos.length <= 5 ? (
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2">
          {photos.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`写真 ${index + 1}`}
              aria-current={selectedIndex === index ? "true" : undefined}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full transition-all duration-200",
                  index === selectedIndex
                    ? "h-2.5 w-2.5 bg-primary-foreground ring-1 ring-[var(--gold-warm)] ring-offset-2 ring-offset-transparent"
                    : "h-1.5 w-1.5 bg-primary-foreground/50 hover:bg-primary-foreground/70",
                )}
              />
            </button>
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] tabular-nums text-foreground/80 shadow-[0_1px_4px_rgba(0,0,0,0.08)] backdrop-blur-sm"
        >
          {selectedIndex + 1} / {photos.length}
        </div>
      )}
    </div>
  );
}

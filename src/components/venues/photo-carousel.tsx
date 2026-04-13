"use client";

import { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";

interface PhotoCarouselProps {
  photos: string[];
  alt: string;
  aspectRatio?: "4/3" | "16/9";
}

export function PhotoCarousel({ photos, alt, aspectRatio = "4/3" }: PhotoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-muted",
          aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-video"
        )}
      >
        <span className="text-sm text-muted-foreground">写真なし</span>
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-2xl",
          aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-video"
        )}
      >
        <img
          src={photos[0]}
          alt={`${alt} - 写真`}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="式場写真"
      className="relative"
    >
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {photos.map((photo, index) => (
            <div
              key={index}
              className={cn(
                "min-w-0 flex-[0_0_100%]",
                aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-video"
              )}
              aria-label={`写真 ${index + 1}/${photos.length}`}
            >
              <img
                src={photo}
                alt={`${alt} - 写真 ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollTo(index)}
            aria-label={`写真 ${index + 1} に移動`}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              "bg-white/60 hover:bg-white"
            )}
          />
        ))}
      </div>
    </div>
  );
}

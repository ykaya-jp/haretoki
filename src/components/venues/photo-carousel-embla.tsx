"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoCarouselEmblaProps {
  photos: string[];
  alt: string;
  aspectRatio: "4/3" | "16/9";
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
                "relative min-w-0 flex-[0_0_100%]",
                aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-video",
              )}
              aria-label={`写真 ${index + 1}/${photos.length}`}
            >
              <Image
                src={photo}
                alt={`${alt} - 写真 ${index + 1}`}
                fill
                priority={index === 0}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
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
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {selectedIndex < photos.length - 1 && (
        <button
          type="button"
          onClick={() => scrollTo(selectedIndex + 1)}
          aria-label="次の写真"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 active:scale-95"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => scrollTo(index)}
            aria-label={`写真 ${index + 1} に移動`}
            className={cn(
              "rounded-full transition-all",
              index === selectedIndex
                ? "h-2 w-2 bg-white"
                : "h-1.5 w-1.5 bg-white/50 hover:bg-white/70",
            )}
          />
        ))}
      </div>
    </div>
  );
}

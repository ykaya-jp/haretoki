"use client";

import { useState, useCallback } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Modal lightbox for checklist item photos — full-screen with prev/next arrows. */
export function PhotoLightbox({
  photos,
  initialIndex = 0,
  open,
  onOpenChange,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);

  if (photos.length === 0) return null;

  const current = photos[index] ?? photos[0];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-ending-style:opacity-0 data-starting-style:opacity-0"
        >
          <div className="relative flex max-h-full max-w-full flex-col items-center gap-3">
            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute -top-2 right-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:bg-black/80"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <div className="relative h-[calc(100dvh-160px)] w-[min(100vw-2rem,680px)]">
              <Image
                src={current}
                alt={`写真 ${index + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 680px"
                unoptimized
              />
            </div>

            {/* Arrows + counter */}
            {photos.length > 1 && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={prev}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/40"
                  aria-label="前の写真"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="tabular-nums text-sm text-white/80">
                  {index + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={next}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white active:bg-white/40"
                  aria-label="次の写真"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface PhotoThumbnailsProps {
  photoUrls: string[];
  /** Max thumbnails to show (default 3). */
  maxShow?: number;
  className?: string;
}

/** Horizontal row of 56x56 photo thumbnails — tapping opens the lightbox. */
export function PhotoThumbnails({ photoUrls, maxShow = 3, className }: PhotoThumbnailsProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const visible = photoUrls.slice(0, maxShow);
  const remaining = photoUrls.length - maxShow;

  if (photoUrls.length === 0) return null;

  return (
    <>
      <div className={cn("flex gap-2", className)}>
        {visible.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => {
              setStartIndex(i);
              setLightboxOpen(true);
            }}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md active:opacity-75"
            aria-label={`写真を拡大 ${i + 1}`}
          >
            <Image
              src={url}
              alt={`写真 ${i + 1}`}
              fill
              className="object-cover"
              sizes="56px"
              unoptimized
            />
            {i === maxShow - 1 && remaining > 0 && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-xs font-medium text-white tabular-nums">
                +{remaining}
              </div>
            )}
          </button>
        ))}
      </div>
      <PhotoLightbox
        photos={photoUrls}
        initialIndex={startIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

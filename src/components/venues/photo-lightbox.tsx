"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

/** Full-screen photo lightbox with keyboard + swipe navigation.
 *  Replaced framer-motion with CSS transitions to avoid pulling the full
 *  framer-motion bundle into the photo-carousel initial chunk. */
export function PhotoLightbox({
  photos,
  initialIndex,
  open,
  onClose,
}: PhotoLightboxProps) {
  // Track previousInitialIndex to detect parent-driven index updates without
  // calling setState inside an effect (React 19 render-phase reset pattern).
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex);
  const [index, setIndex] = useState(initialIndex);
  const [photoKey, setPhotoKey] = useState(0);
  // Track mounted state so CSS enter animation fires on open
  const [visible, setVisible] = useState(false);
  const prevOpenRef = useRef(false);

  // Render-phase sync: if parent changes initialIndex, reset index immediately.
  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex);
    setIndex(initialIndex);
  }

  // Drive the CSS enter/exit transition
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Trigger enter: defer one frame so the browser applies initial opacity:0
      const id = requestAnimationFrame(() => setVisible(true));
      prevOpenRef.current = true;
      return () => cancelAnimationFrame(id);
    }
    if (!open && prevOpenRef.current) {
      setVisible(false);
      prevOpenRef.current = false;
    }
  }, [open]);

  const prev = useCallback(() => {
    setIndex((i) => {
      const next = Math.max(0, i - 1);
      if (next !== i) setPhotoKey((k) => k + 1);
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      const next = Math.min(photos.length - 1, i + 1);
      if (next !== i) setPhotoKey((k) => k + 1);
      return next;
    });
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, prev, next]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`式場写真 ${index + 1} / ${photos.length} 枚`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-all duration-150 hover:bg-background active:scale-95"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          right: "calc(env(safe-area-inset-right) + 12px)",
        }}
      >
        <X className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Prev button */}
      {index > 0 && (
        <button
          type="button"
          onClick={prev}
          aria-label="前の写真"
          className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-all duration-150 hover:bg-background active:scale-95"
          style={{ left: "calc(env(safe-area-inset-left) + 12px)" }}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
      )}

      {/* Next button */}
      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={next}
          aria-label="次の写真"
          className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-all duration-150 hover:bg-background active:scale-95"
          style={{ right: "calc(env(safe-area-inset-right) + 12px)" }}
        >
          <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
        </button>
      )}

      {/* Photo — CSS opacity cross-fade on key change */}
      <div
        key={photoKey}
        className="relative flex h-full w-full items-center justify-center px-14"
        style={{
          paddingLeft: "max(3.5rem, env(safe-area-inset-left))",
          paddingRight: "max(3.5rem, env(safe-area-inset-right))",
          animation: "lightbox-photo-enter 0.2s ease forwards",
        }}
      >
        <div className="relative h-full w-full max-h-[85vh]">
          <Image
            src={photos[index]}
            alt={`式場写真 ${index + 1}`}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Dots indicator */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
          aria-hidden="true"
        >
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setIndex(i); setPhotoKey((k) => k + 1); }}
              aria-label={`写真 ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                className={
                  i === index
                    ? "block h-2.5 w-2.5 rounded-full bg-[var(--gold-warm)] ring-1 ring-[var(--gold-warm)] ring-offset-2 ring-offset-background transition-all duration-200"
                    : "block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 transition-all duration-200 hover:bg-muted-foreground/70"
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

/** Full-screen photo lightbox with keyboard + swipe navigation. */
export function PhotoLightbox({
  photos,
  initialIndex,
  open,
  onClose,
}: PhotoLightboxProps) {
  // Use initialIndex as the key source; parent passes updated initialIndex
  // before setting open=true, so we can derive index from initialIndex directly.
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(photos.length - 1, i + 1));
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label={`式場写真 ${index + 1} / ${photos.length} 枚`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-all duration-150 hover:bg-background active:scale-95"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
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
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}

          {/* Photo */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full items-center justify-center px-14"
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
            </motion.div>
          </AnimatePresence>

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
                  onClick={() => setIndex(i)}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

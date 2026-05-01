"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, X } from "lucide-react";

const STORAGE_KEY = "haretoki:heart-coach-seen";

interface HeartCoachMarkProps {
  /** ref pointing to the first heart button element to anchor the coach mark near */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** First-visit coach mark that appears once beside the first heart button.
 *  Replaced framer-motion with CSS transition to reduce bundle size. */
export function HeartCoachMark({ anchorRef }: HeartCoachMarkProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    setMounted(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    // Show only if not yet seen
    if (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
      return;
    }

    // Check if anchor is in viewport via IntersectionObserver
    const el = anchorRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          // Defer one frame so CSS enter animation fires
          requestAnimationFrame(() => setMounted(true));
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [anchorRef]);

  useEffect(() => {
    if (!visible) return;

    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(() => {
      dismiss();
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="absolute right-0 top-14 z-20 flex w-max max-w-[180px] flex-col"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1) translateY(0)" : "scale(0.9) translateY(-4px)",
        transition: "opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Arrow pointing upward toward the heart button */}
      <div
        aria-hidden="true"
        className="ml-auto mr-4 h-0 w-0"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderBottom: "6px solid var(--gold-subtle, #f5efe6)",
        }}
      />
      <div
        className="relative rounded-2xl px-3.5 py-2.5 shadow-[0_2px_12px_rgba(42,35,32,0.12)]"
        style={{ background: "var(--gold-subtle, #f5efe6)" }}
      >
        <div className="flex items-center gap-1.5">
          <Heart
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-primary/70"
            strokeWidth={1.8}
          />
          <p className="text-[12px] leading-[1.5] text-foreground font-light tracking-[0.01em]">
            タップで候補に入れる
          </p>
        </div>
        <button
          type="button"
          aria-label="閉じる"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm">
            <X className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
          </span>
        </button>
      </div>
    </div>
  );
}

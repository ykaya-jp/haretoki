"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SegmentSection {
  id: string;
  label: string;
}

interface VenueSegmentsNavProps {
  sections: SegmentSection[];
}

/** Sticky segmented control with IntersectionObserver scroll-spy. */
export function VenueSegmentsNav({ sections }: VenueSegmentsNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const OFFSET = 80; // px below sticky nav to trigger activation

    const observers: IntersectionObserver[] = sections.map((section) => {
      const el = document.getElementById(section.id);
      if (!el) return null as unknown as IntersectionObserver;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (isScrollingRef.current) return;
          if (entry.isIntersecting) {
            setActiveId(section.id);
          }
        },
        {
          // -25% at top gives enough breathing room past the sticky
          // nav; -70% at bottom lets even the last section activate
          // before its midpoint exits the viewport. Previous setting
          // (-60% bottom) meant the final section never reached the
          // active threshold, so the tab lied about where you were.
          rootMargin: `-${OFFSET}px 0px -70% 0px`,
          threshold: 0,
        },
      );
      observer.observe(el);
      return observer;
    });

    return () => {
      observers.forEach((obs) => obs?.disconnect());
    };
  }, [sections]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;

    setActiveId(id);
    isScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

    // Offset by sticky nav height (approx 56px) + extra breathing room
    const navHeight = 56;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
    window.scrollTo({ top, behavior: "smooth" });

    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  }

  return (
    <nav
      aria-label="セクション切り替え"
      // W21-4: pt-[env(...)] lifts the segment row below the notch on
      // standalone-PWA. The inner padding row keeps its 8px breathing
      // gap; only the outer chrome carries the safe-area inset.
      className="sticky top-0 z-20 border-b border-border/40 bg-card/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/55"
    >
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        <div className="flex gap-2 py-2" role="tablist">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                id={`tab-${section.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={section.id}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleClick(section.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[13px] transition-colors active:scale-[0.97]",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

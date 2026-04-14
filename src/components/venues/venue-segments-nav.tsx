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
          rootMargin: `-${OFFSET}px 0px -60% 0px`,
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
      className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm"
    >
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
        <div className="flex gap-2 py-2" role="tablist">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={section.id}
                onClick={() => handleClick(section.id)}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-4 text-sm transition-colors active:scale-[0.97]",
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

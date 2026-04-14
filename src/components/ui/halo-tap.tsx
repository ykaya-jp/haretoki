"use client";

import { useCallback, useRef } from "react";
import type { CSSProperties, MouseEvent, TouchEvent, ReactNode } from "react";

interface HaloTapProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * HaloTap — wraps a CTA and fires a gold ring ripple on every tap (250ms).
 * Aria-hidden + pointer-events-none on the ring itself; safe to wrap any element.
 * Compatible with active:scale-[0.98] on child buttons.
 */
export function HaloTap({ children, className, style }: HaloTapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  const triggerRipple = useCallback((x: number, y: number) => {
    const ring = ringRef.current;
    const container = containerRef.current;
    if (!ring || !container) return;

    const rect = container.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    // Reset animation by removing and re-adding class
    ring.classList.remove("halo-animate");
    ring.style.left = `${cx}px`;
    ring.style.top = `${cy}px`;

    // Force reflow so the animation restarts cleanly
    void ring.offsetWidth;
    ring.classList.add("halo-animate");
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      triggerRipple(e.clientX, e.clientY);
    },
    [triggerRipple],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      if (touch) triggerRipple(touch.clientX, touch.clientY);
    },
    [triggerRipple],
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={style}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}
      {/* Gold ring — aria-hidden so screen readers ignore it */}
      <span
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--gold-warm)] opacity-0"
        style={{ width: 0, height: 0 }}
      />
    </div>
  );
}

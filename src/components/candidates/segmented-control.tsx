"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface SegmentedControlProps {
  segments: {
    id: string;
    label: string;
    disabled?: boolean;
    disabledHint?: string;
  }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function SegmentedControl({ segments, activeId, onChange }: SegmentedControlProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAndSelect = (targetIndex: number) => {
    const target = segments[targetIndex];
    if (!target || target.disabled) return;
    onChange(target.id);
    // Defer focus so React has time to commit roving tabindex updates.
    requestAnimationFrame(() => {
      tabRefs.current[targetIndex]?.focus();
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    // Skip disabled tabs, wrap around.
    const total = segments.length;
    for (let step = 1; step <= total; step++) {
      const next = (currentIndex + delta * step + total * step) % total;
      if (!segments[next]?.disabled) {
        focusAndSelect(next);
        return;
      }
    }
  };

  return (
    <div role="tablist" className="relative flex gap-1 rounded-full bg-muted p-1">
      {segments.map((segment, index) => (
        <button
          key={segment.id}
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          type="button"
          role="tab"
          aria-selected={activeId === segment.id}
          aria-disabled={segment.disabled}
          tabIndex={activeId === segment.id ? 0 : -1}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onClick={() => {
            if (segment.disabled) {
              if (segment.disabledHint) {
                toast.info(segment.disabledHint);
              }
              return;
            }
            onChange(segment.id);
          }}
          className={cn(
            "relative z-10 flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 active:scale-[0.97]",
            // Subtle gold "ink" underline that expands only on the active tab.
            // Purely decorative (no ARIA role); the motion pill + aria-selected
            // remain the source of truth for state.
            "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-px after:bg-[var(--gold-warm)] after:transition-[width,opacity] after:duration-300 after:ease-out",
            activeId === segment.id
              ? "text-foreground after:w-5 after:opacity-80"
              : "text-muted-foreground hover:text-foreground after:w-0 after:opacity-0",
            segment.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {activeId === segment.id && (
            <motion.div
              layoutId="segmented-indicator"
              className="absolute inset-0 rounded-full bg-card shadow-sm"
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          )}
          <span className="relative z-10">{segment.label}</span>
        </button>
      ))}
    </div>
  );
}

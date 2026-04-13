"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SegmentedControlProps {
  segments: { id: string; label: string; disabled?: boolean }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function SegmentedControl({ segments, activeId, onChange }: SegmentedControlProps) {
  return (
    <div className="relative flex gap-1 rounded-2xl bg-muted/60 p-1.5 shadow-inner">
      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          onClick={() => !segment.disabled && onChange(segment.id)}
          disabled={segment.disabled}
          className={cn(
            "relative z-10 flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-[400ms]",
            activeId === segment.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/70",
            segment.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {activeId === segment.id && (
            <motion.div
              layoutId="segmented-indicator"
              className="absolute inset-0 rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)]"
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          )}
          {/* Gold underline indicator for active tab */}
          {activeId === segment.id && (
            <motion.div
              layoutId="segmented-gold-bar"
              className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--gold-warm)]"
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          )}
          <span className="relative z-10">{segment.label}</span>
        </button>
      ))}
    </div>
  );
}

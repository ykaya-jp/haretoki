"use client";

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
  return (
    <div className="relative flex gap-1 rounded-full bg-muted p-1">
      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          onClick={() => {
            if (segment.disabled) {
              if (segment.disabledHint) {
                toast.info(segment.disabledHint);
              }
              return;
            }
            onChange(segment.id);
          }}
          aria-disabled={segment.disabled}
          className={cn(
            "relative z-10 flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
            activeId === segment.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
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

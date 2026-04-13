"use client";

import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  segments: { id: string; label: string; disabled?: boolean }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function SegmentedControl({ segments, activeId, onChange }: SegmentedControlProps) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {segments.map((segment) => (
        <button
          key={segment.id}
          type="button"
          onClick={() => !segment.disabled && onChange(segment.id)}
          disabled={segment.disabled}
          className={cn(
            "flex-1 rounded-full px-4 py-2 text-sm transition-all",
            activeId === segment.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
            segment.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}

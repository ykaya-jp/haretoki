"use client";

import { cn } from "@/lib/utils";

interface FilterChip {
  id: string;
  label: string;
  active: boolean;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onToggle: (id: string) => void;
}

export function FilterChips({ chips, onToggle }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onToggle(chip.id)}
          className={cn(
            "min-h-[44px] whitespace-nowrap rounded-full border px-4 text-sm transition-all duration-150 ease-out active:scale-95",
            chip.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted hover:border-foreground/20"
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

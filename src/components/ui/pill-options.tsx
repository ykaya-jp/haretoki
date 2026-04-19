"use client";

import { cn } from "@/lib/utils";

interface PillOption {
  id: string;
  label: string;
}

interface PillOptionsProps {
  options: PillOption[];
  selected: string[];
  onToggle: (id: string) => void;
  multiSelect?: boolean;
}

export function PillOptions({ options, selected, onToggle, multiSelect = true }: PillOptionsProps) {
  const handleSelect = (id: string) => {
    if (!multiSelect && selected.includes(id)) return;
    onToggle(id);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option.id)}
            aria-pressed={isSelected}
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-sm transition-all duration-200 active:scale-[0.97]",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_22%,transparent)]"
                : "border-border bg-card text-foreground hover:border-[color-mix(in_oklab,var(--gold-warm)_45%,transparent)] hover:bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--card))] hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

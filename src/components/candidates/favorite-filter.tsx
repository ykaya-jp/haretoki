"use client";

import { cn } from "@/lib/utils";

type FavoriteFilter = "mine" | "partner" | "both";

interface FavoriteFilterProps {
  active: FavoriteFilter;
  onChange: (filter: FavoriteFilter) => void;
}

const FILTERS: { id: FavoriteFilter; label: string }[] = [
  { id: "mine", label: "自分" },
  { id: "partner", label: "パートナー" },
  { id: "both", label: "おふたり" },
];

export function FavoriteFilter({ active, onChange }: FavoriteFilterProps) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-muted p-1">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 active:scale-[0.97]",
            active === f.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

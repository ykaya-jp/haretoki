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
  { id: "both", label: "二人とも" },
];

export function FavoriteFilter({ active, onChange }: FavoriteFilterProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-all duration-[400ms] active:scale-[0.97]",
            active === f.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

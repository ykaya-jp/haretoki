"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { VIBE_TAGS, type VibeTag } from "@/lib/vibe-tags";
import { cn } from "@/lib/utils";

interface VibeFilterChipsProps {
  activeVibes: VibeTag[];
}

export function VibeFilterChips({ activeVibes }: VibeFilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSet = new Set(activeVibes);

  const handleToggle = useCallback(
    (id: VibeTag) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = new Set(activeSet);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        params.delete("vibe");
      } else {
        params.set("vibe", Array.from(next).join(","));
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [activeSet, pathname, router, searchParams],
  );

  return (
    <div
      className="flex gap-2 overflow-x-auto py-1 scrollbar-hide"
      style={{ scrollSnapType: "x mandatory" }}
    >
      {VIBE_TAGS.map((tag) => {
        const isActive = activeSet.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleToggle(tag.id)}
            style={{ scrollSnapAlign: "start" }}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] transition-all duration-150 ease-out active:scale-95",
              isActive
                ? "border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] bg-[var(--gold-subtle)] text-foreground"
                : "border-border bg-card text-foreground hover:bg-muted hover:border-foreground/20",
            )}
          >
            <span role="img" aria-hidden="true" className="text-[11px]">
              {tag.emoji}
            </span>
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}

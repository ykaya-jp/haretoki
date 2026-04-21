"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { VIBE_TAGS, type VibeTag } from "@/lib/vibe-tags";
import { cn } from "@/lib/utils";

interface VibeFilterChipsProps {
  activeVibes: VibeTag[];
  /** When true, suppresses the section header (used inside UnifiedFilterZone) */
  hideHeader?: boolean;
}

export function VibeFilterChips({ activeVibes, hideHeader = false }: VibeFilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSet = useMemo(() => new Set(activeVibes), [activeVibes]);

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

  const activeCount = activeSet.size;

  return (
    <div className="space-y-2">
      {!hideHeader && (
        <div className="flex items-baseline justify-between">
          <p className="text-[10.5px] tracking-[0.16em] uppercase text-muted-foreground">
            雰囲気でしぼる
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("vibe");
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              }}
              className="text-[11px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
            >
              すべて外す
            </button>
          )}
        </div>
      )}
      {hideHeader && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            式場の雰囲気で絞り込み（例: 自然光、ガーデン）
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("vibe");
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              }}
              className="shrink-0 text-[11px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
            >
              すべて外す
            </button>
          )}
        </div>
      )}
      <div
        className="-mx-6 flex gap-2 overflow-x-auto px-6 py-1 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {VIBE_TAGS.map((tag) => {
          const isActive = activeSet.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleToggle(tag.id)}
              aria-pressed={isActive}
              style={{ scrollSnapAlign: "start" }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] transition-all duration-150 ease-out active:scale-95",
                isActive
                  ? "border-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)] bg-[var(--gold-subtle)] text-[var(--gold-warm)] shadow-[0_1px_2px_rgba(201,164,76,0.12),0_4px_12px_color-mix(in_oklab,var(--gold-warm)_14%,transparent)]"
                  : "border-border bg-card text-foreground/85 hover:bg-muted hover:border-foreground/25",
              )}
            >
              <span aria-hidden="true" className="text-[11px]">
                {tag.emoji}
              </span>
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

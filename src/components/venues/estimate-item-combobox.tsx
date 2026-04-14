"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTIMATE_PRESETS, type EstimateCategory } from "@/lib/estimate-presets";

interface EstimateItemComboboxProps {
  value: string;
  onChange: (name: string, category: EstimateCategory) => void;
  placeholder?: string;
}

/** Combobox for estimate item names with preset suggestions and free-text fallback. */
export function EstimateItemCombobox({
  value,
  onChange,
  placeholder = "項目名",
}: EstimateItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep query in sync when parent value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filtered = query.trim()
    ? ESTIMATE_PRESETS.filter((p) =>
        p.name.includes(query) || p.categoryLabel.includes(query),
      )
    : ESTIMATE_PRESETS;

  function selectPreset(name: string, category: EstimateCategory) {
    setQuery(name);
    onChange(name, category);
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    onChange(e.target.value, "other");
    setOpen(true);
  }

  // Group filtered results by categoryLabel
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, p) => {
    if (!acc[p.categoryLabel]) acc[p.categoryLabel] = [];
    acc[p.categoryLabel].push(p);
    return acc;
  }, {});

  const hasExactMatch = ESTIMATE_PRESETS.some((p) => p.name === query.trim());
  const showFreeTextOption = query.trim() && !hasExactMatch;

  return (
    <div ref={containerRef} className="relative">
      {/* Input trigger */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
        <ChevronDown
          className={cn(
            "absolute right-2.5 h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {/* Search icon indicator */}
          {query.trim() && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {filtered.length} 件
              </span>
            </div>
          )}

          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([label, presets]) => (
              <div key={label}>
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                  {label}
                </div>
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="flex h-9 w-full items-center px-3 text-left text-sm hover:bg-accent active:bg-accent/80"
                    onPointerDown={(e) => {
                      // Prevent blur on input before click registers
                      e.preventDefault();
                      selectPreset(preset.name, preset.category);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              候補が見つかりません
            </div>
          )}

          {/* Free-text option */}
          {showFreeTextOption && (
            <div className="border-t border-border">
              <button
                type="button"
                className="flex h-9 w-full items-center px-3 text-left text-sm text-muted-foreground hover:bg-accent active:bg-accent/80"
                onPointerDown={(e) => {
                  e.preventDefault();
                  selectPreset(query.trim(), "other");
                }}
              >
                「{query.trim()}」を自由入力で使う
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

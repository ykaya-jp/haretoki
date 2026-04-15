"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface VenueSearchBarProps {
  initialQuery?: string;
}

/**
 * Sticky search bar for venue list.
 * Debounces input by 300ms and syncs the value to the URL as ?q=.
 * Skips sync while an IME composition is in progress, to avoid
 * firing Server Actions on intermediate kana conversions.
 */
export function VenueSearchBar({ initialQuery = "" }: VenueSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const composingRef = useRef(false);

  // Debounce: push URL update 300ms after the last keystroke.
  // Do not push while the user is still composing a Japanese IME word.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (composingRef.current) return;
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        if (params.get("q") === trimmed) return;
        params.set("q", trimmed);
      } else {
        if (!params.has("q")) return;
        params.delete("q");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);

    return () => clearTimeout(handle);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border/40 bg-background/85 px-4 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="式場名・エリアで検索"
          aria-label="式場を検索"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setValue(e.currentTarget.value);
          }}
          className="h-11 pl-10"
        />
      </div>
    </div>
  );
}

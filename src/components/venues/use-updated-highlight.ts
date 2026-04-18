"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Client hook that returns `true` for 2 s when the URL carries `?updated=1`
 * (the merged-import flow). Sections call this and conditionally add a
 * `ring-2 ring-primary/30` outline so the user sees "which blocks got new
 * info" after a URL re-import. The banner (`venue-updated-banner.tsx`) is
 * what explains the state in words — this hook is the per-section visual
 * echo.
 *
 * Self-scrub of the query param is owned by the banner component to avoid
 * double-replace races; this hook only reads.
 */
export function useUpdatedHighlight(durationMs: number = 2000): boolean {
  const search = useSearchParams();
  const hasUpdated = search.get("updated") === "1";
  const [highlight, setHighlight] = useState(hasUpdated);

  useEffect(() => {
    if (!hasUpdated) {
      setHighlight(false);
      return;
    }
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), durationMs);
    return () => clearTimeout(t);
  }, [hasUpdated, durationMs]);

  return highlight;
}

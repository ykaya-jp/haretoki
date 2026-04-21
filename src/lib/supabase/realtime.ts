"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProjectVenueIds } from "@/server/actions/venues";

const DEBOUNCE_MS = 400;

/**
 * Subscribe to Postgres changes for a project and refresh the page on updates.
 * Changes to visit_ratings, venue_favorites, and visits are filtered by the
 * project's venue id set so we don't react to unrelated projects.
 * Multiple events within DEBOUNCE_MS are coalesced into a single router.refresh().
 */
export function useRealtimeSync(projectId: string) {
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      router.refresh();
    }, DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      // Fetch venue ids for filter; fall back to no filter on error.
      let venueIds: string[] = [];
      try {
        venueIds = await getProjectVenueIds();
      } catch {
        // Non-critical: subscribe without filter rather than blocking realtime.
      }

      if (cancelled) return;

      const venueFilter =
        venueIds.length > 0 ? `venue_id=in.(${venueIds.join(",")})` : undefined;

      const channel = supabase
        .channel(`project-${projectId}-v3`)
        // Tables with project_id column — filter directly
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            filter: `project_id=eq.${projectId}`,
          },
          debouncedRefresh
        )
        // visits — filter by venue_id set
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "visits",
            ...(venueFilter ? { filter: venueFilter } : {}),
          },
          debouncedRefresh
        )
        // venue_favorites — filter by venue_id set
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "venue_favorites",
            ...(venueFilter ? { filter: venueFilter } : {}),
          },
          debouncedRefresh
        )
        // visit_ratings — no direct venue_id; subscribe without filter
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "visit_ratings" },
          debouncedRefresh
        )
        // visit_notes / checklist items
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "visit_notes" },
          debouncedRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "visit_checklist_items" },
          debouncedRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "venue_scores" },
          debouncedRefresh
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = subscribe();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [projectId, supabase, debouncedRefresh]);
}

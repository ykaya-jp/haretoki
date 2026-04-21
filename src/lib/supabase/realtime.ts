"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getProjectVenueIds, getProjectVisitIds } from "@/server/actions/venues";

const DEBOUNCE_MS = 400;

/**
 * Subscribe to Postgres changes for a project and refresh the page on updates.
 * Features:
 * - visit_ratings filtered by project visit IDs (fix: was unfiltered)
 * - BroadcastChannel collapses refreshes across same-project tabs (fix: was N refreshes)
 * - onAuthStateChange reconnect on token refresh / expiry (fix: was silent drop)
 */
export function useRealtimeSync(projectId: string) {
  const router = useRouter();
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to unsubscribe from the current channel so we can re-subscribe on auth change.
  const cleanupRef = useRef<(() => void) | null>(null);

  /** Debounce a router.refresh() within this tab. */
  const scheduleLocal = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      router.refresh();
    }, DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    // BroadcastChannel: share refresh signals across tabs for the same project.
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`haretoki-realtime-${projectId}`);
      bc.onmessage = (e: MessageEvent<{ type: string }>) => {
        if (e.data?.type === "refresh") scheduleLocal();
      };
    } catch {
      // BroadcastChannel not available (e.g., older Safari) — fall back gracefully.
    }

    /** Broadcast + schedule refresh in this tab. */
    const debouncedRefresh = () => {
      try {
        bc?.postMessage({ type: "refresh" });
      } catch {
        // ignore postMessage errors
      }
      scheduleLocal();
    };

    let cancelled = false;

    async function subscribe() {
      // Fetch venue ids and visit ids for filters; fall back to no filter on error.
      let venueIds: string[] = [];
      let visitIds: string[] = [];
      try {
        [venueIds, visitIds] = await Promise.all([
          getProjectVenueIds(),
          getProjectVisitIds(),
        ]);
      } catch {
        // Non-critical: subscribe without fine-grained filter rather than blocking realtime.
      }

      if (cancelled) return;

      const venueFilter =
        venueIds.length > 0 ? `venue_id=in.(${venueIds.join(",")})` : undefined;
      const visitFilter =
        visitIds.length > 0 ? `visit_id=in.(${visitIds.join(",")})` : undefined;

      const channel = supabase
        .channel(`project-${projectId}-v4`)
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
        // visit_ratings — filter by visit_id set (fix #1: was unfiltered)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "visit_ratings",
            ...(visitFilter ? { filter: visitFilter } : {}),
          },
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

      cleanupRef.current = () => {
        supabase.removeChannel(channel);
      };
    }

    subscribe();

    // Fix #3: reconnect when auth token is refreshed or user signs back in.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        // Tear down the old channel and re-subscribe with fresh credentials.
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (!cancelled) {
          subscribe();
        }
      } else if (event === "SIGNED_OUT") {
        cleanupRef.current?.();
        cleanupRef.current = null;
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      cleanupRef.current?.();
      cleanupRef.current = null;
      authListener.subscription.unsubscribe();
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, [projectId, supabase, scheduleLocal]);
}

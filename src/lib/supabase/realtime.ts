"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribe to Postgres changes for a project and refresh the page on updates.
 *
 * NOTE: For Supabase Realtime to work, you must enable Realtime on the relevant
 * tables (venues, venue_scores, project_members, visits, visit_ratings, estimates,
 * decisions) in the Supabase Dashboard:
 *   Database > Replication > Source > Enable the tables you want to listen to.
 */
export function useRealtimeSync(projectId: string) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleChange = () => {
      router.refresh();
    };

    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          filter: `project_id=eq.${projectId}`,
        },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_ratings" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_notes" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_checklist_items" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_favorites" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_scores" },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router, supabase]);
}

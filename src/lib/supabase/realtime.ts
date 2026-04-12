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
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router, supabase]);
}

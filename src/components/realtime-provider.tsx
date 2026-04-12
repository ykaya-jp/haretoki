"use client";

import { useRealtimeSync } from "@/lib/supabase/realtime";

interface RealtimeProviderProps {
  projectId: string;
  children: React.ReactNode;
}

/**
 * Wraps children and subscribes to Supabase Realtime for the given project.
 * When any project-related table changes, the page auto-refreshes.
 */
export function RealtimeProvider({ projectId, children }: RealtimeProviderProps) {
  useRealtimeSync(projectId);
  return <>{children}</>;
}

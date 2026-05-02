"use client";

import { useRealtimeSync } from "@/lib/supabase/realtime";
import { useRealtimeProject } from "@/lib/realtime/use-realtime-project";

interface RealtimeProviderProps {
  projectId: string;
  /** Authenticated viewer's user id. Required so the broadcast hook
   *  can suppress own-actions from triggering self-toasts. Optional
   *  to keep this provider drop-in compatible with non-auth surfaces
   *  (e.g. invitation guest flows that happen to render shared bits). */
  viewerUserId?: string;
  children: React.ReactNode;
}

/**
 * Wraps children with the two complementary realtime layers:
 *
 *   1. `useRealtimeSync` — Postgres CDC → router.refresh on any
 *      project-table change. Has been in place since the app shipped.
 *   2. `useRealtimeProject` (Phase 3 L3 wave 1) — Supabase Broadcast
 *      → toast + router.refresh, carries actor + intent so couples
 *      see "{partner name}が評価を残しました" instead of an opaque
 *      page reflow.
 *
 * Both are mounted here so every (app)-route gets them once. The
 * broadcast layer is a no-op when `viewerUserId` isn't provided
 * (e.g. transient guest contexts) — the CDC layer keeps refreshing
 * regardless.
 */
export function RealtimeProvider({
  projectId,
  viewerUserId,
  children,
}: RealtimeProviderProps) {
  useRealtimeSync(projectId);
  useRealtimeProject({ projectId, viewerUserId: viewerUserId ?? "" });
  return <>{children}</>;
}

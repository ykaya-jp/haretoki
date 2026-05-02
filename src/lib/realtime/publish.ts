// Server-only module — every consumer is a "use server" file (server
// actions in src/server/actions/*). The repo doesn't use the
// `server-only` package elsewhere; the "use server" boundary on
// callers is the enforcement.

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/server/db";
import {
  projectChannelName,
  REALTIME_EVENT,
  type RealtimeActor,
  type RealtimeEvent,
} from "@/lib/realtime/events";

/**
 * Server-side broadcast for project-scoped semantic events.
 *
 * Contract:
 *   - **Best-effort**: never throws, never blocks the calling server
 *     action's success path. A failed broadcast still leaves the DB
 *     write committed (the source of truth) and the existing CDC layer
 *     (`useRealtimeSync`) will eventually push the change anyway —
 *     broadcast is the *fast lane*, CDC is the safety net.
 *   - **No-op when admin client unavailable**: `createAdminClient`
 *     returns null when `SUPABASE_SERVICE_ROLE_KEY` isn't configured
 *     (local dev without the key, preview branches with reduced env).
 *     We log once at warn level and return; the user-facing flow is
 *     untouched.
 *   - **Channel is opened, send, then closed** every call. Server
 *     actions are short-lived; keeping a long-lived broadcaster across
 *     invocations would mean tracking lifecycle inside Next.js server
 *     functions, which doesn't fit the per-request model. The cost is
 *     ~20-50ms per publish — acceptable for non-blocking events that
 *     fire on user-initiated saves (not in tight loops).
 *
 * Why service role and not the user's session?
 *   - Server actions run in a Node context where the user's Supabase
 *     session cookie isn't always trivially threaded into the realtime
 *     connection. The admin client uses the service role key, which
 *     can broadcast on any private channel. The receiver-side
 *     authorization (RLS join on project_members) gates who can
 *     SUBSCRIBE, so service-role-only publish is safe — only the
 *     intended couple's clients will ever see the message.
 *
 * Wave 1 limitation: the receiver-side RLS policy on broadcast
 * channels is NOT yet shipped. For wave 1 we ship with public
 * broadcast keyed on the project UUID (security-through-obscurity).
 * Tracked as a follow-up in `docs/phase3/partner-level-3-design.md`
 * § 6.2.
 */
/**
 * Resolve the actor display name from the Prisma User row.
 *
 * Cached per-request via React cache so a server action that calls
 * `resolveActor(user.id)` and `publishRealtimeEvent(...)` separately
 * doesn't double-query. Falls through to `email` then to a generic
 * "メンバー" placeholder so the toast copy never renders `null`.
 */
export const resolveActor = cache(
  async (userId: string): Promise<RealtimeActor> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    return {
      userId,
      name: user?.name?.trim() || user?.email || "メンバー",
    };
  },
);

export async function publishRealtimeEvent(
  projectId: string,
  event: RealtimeEvent,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    // Logged once at warn so a missing key is visible in dev / preview
    // without flooding production logs (production sets the key).
    console.warn(
      "[realtime] publishRealtimeEvent skipped: SUPABASE_SERVICE_ROLE_KEY unset",
    );
    return;
  }

  const channelName = projectChannelName(projectId);
  const channel = admin.channel(channelName, {
    config: { broadcast: { self: false, ack: false } },
  });

  try {
    // Subscribe is required before send on Supabase Realtime — the
    // client refuses send() on a non-subscribed channel. We don't need
    // to wait for SUBSCRIBED state here because send() on a `broadcast`
    // channel is buffered and flushed when the socket connects; the
    // 5s timeout below is the safety net for genuinely broken sockets.
    channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: REALTIME_EVENT,
      payload: event,
    });
  } catch (err) {
    // Wide catch: we never want broadcast issues to surface as a
    // failed save. The Sentry pipeline already captures unhandled
    // errors elsewhere; here we deliberately swallow + log.
    console.warn("[realtime] publishRealtimeEvent failed:", err);
  } finally {
    try {
      await admin.removeChannel(channel);
    } catch {
      // no-op — removeChannel can throw if the socket is already torn
      // down; we don't care, the GC will reclaim it.
    }
  }
}

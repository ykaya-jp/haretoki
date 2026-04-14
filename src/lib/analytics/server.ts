/**
 * Server-side PostHog capture for Server Actions.
 *
 * Uses `posthog-node` so events fire even when the user's browser doesn't
 * reach the client-side `track()` path (e.g. when a server action redirects
 * before hydration resumes). Safe no-op when NEXT_PUBLIC_POSTHOG_KEY is unset.
 */

import { PostHog } from "posthog-node";

let client: PostHog | null = null;
let initAttempted = false;

function getClient(): PostHog | null {
  if (initAttempted) return client;
  initAttempted = true;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  client = new PostHog(key, {
    host,
    // Small batch window so events in short-lived serverless invocations
    // actually flush before the function returns.
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties });
    // Flush is fire-and-forget — we don't want analytics to delay the action.
    await ph.flush().catch(() => {});
  } catch {
    // Never let analytics fail a user-facing action.
  }
}

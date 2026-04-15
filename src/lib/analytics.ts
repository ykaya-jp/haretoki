/**
 * Lightweight analytics facade.
 *
 * Client-side: wraps `posthog-js` when NEXT_PUBLIC_POSTHOG_KEY is configured.
 * Server-side: delegates to `captureServerEvent` (posthog-node) — import
 * directly from "@/lib/analytics/server" in Server Actions to avoid bundling
 * the Node SDK into the client graph.
 *
 * All calls are no-ops when the key is missing, so feature code can emit
 * events unconditionally without guarding for local/dev environments.
 */

export type AnalyticsProps = Record<string, unknown>;

/**
 * Client-side event capture. Safe to call from Server Components during SSR
 * (it becomes a no-op); the real capture fires after hydration when the
 * PostHog provider has initialised the global instance.
 */
export function track(event: string, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  // The provider attaches posthog to `window` via posthog-js import side-effects;
  // we look it up dynamically so this module stays framework-agnostic and
  // doesn't force posthog-js into every client bundle that imports `track`.
  const ph = (window as unknown as { posthog?: { capture?: (e: string, p?: AnalyticsProps) => void } }).posthog;
  if (!ph?.capture) return;
  try {
    ph.capture(event, props);
  } catch {
    // Analytics must never break the product flow.
  }
}

"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/**
 * PostHog provider.
 *
 * Initialises posthog-js on mount when NEXT_PUBLIC_POSTHOG_KEY is set, and
 * captures `$pageview` events on route changes. If the key is missing the
 * provider renders children untouched — this keeps local/dev environments
 * free of analytics calls and network errors.
 *
 * We intentionally disable posthog-js's built-in pageview capture
 * (`capture_pageview: false`) because Next.js App Router navigations don't
 * trigger full page reloads, so we fire `$pageview` ourselves via the
 * pathname/searchParams hooks.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });

    // Expose on window so the shared `track()` helper (which must stay
    // framework-agnostic) can find the running instance.
    (window as unknown as { posthog: typeof posthog }).posthog = posthog;
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || !pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

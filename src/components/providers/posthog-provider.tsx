"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type posthogType from "posthog-js";

type PostHog = typeof posthogType;

async function loadPostHog(): Promise<PostHog | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (typeof window !== "undefined") {
    const existing = (window as unknown as { posthog?: PostHog }).posthog;
    if (existing) return existing;
  }
  const mod = await import("posthog-js");
  const posthog = mod.default;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  (window as unknown as { posthog: PostHog }).posthog = posthog;
  return posthog;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const schedule = (cb: () => void) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback;
      if (typeof ric === "function") ric(cb);
      else window.setTimeout(cb, 1500);
    };
    schedule(() => {
      void loadPostHog();
    });
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
  const posthogRef = useRef<PostHog | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    const fire = (ph: PostHog) => ph.capture("$pageview", { $current_url: url });
    if (posthogRef.current) {
      fire(posthogRef.current);
      return;
    }
    void loadPostHog().then((ph) => {
      if (!ph) return;
      posthogRef.current = ph;
      fire(ph);
    });
  }, [pathname, searchParams]);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js on mount. Kept as a thin client-only component so
 * the main layout can stay a Server Component; the registration itself
 * only runs on the browser.
 *
 * Skipped in development (HMR + SW caching fights) and on non-secure
 * origins (registration would throw anyway). Failures are logged as
 * warnings — a broken SW registration is a nice-to-have regression,
 * not a user-visible error, so we don't surface it through Sentry.
 */
export function ServiceWorkerRegistry() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });
  }, []);

  return null;
}

"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

/**
 * Retry button for the static /offline page. Mounted as a Client
 * Component so the surrounding page can stay statically pre-rendered
 * — important because the service worker pre-caches /offline on
 * install and a static HTML response is the fastest possible
 * fallback when the network is gone.
 */
export function OfflineRetryButton() {
  const [retrying, setRetrying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setRetrying(true);
        // Small delay so the spin animation has time to register before
        // the page tears down.
        window.setTimeout(() => window.location.reload(), 150);
      }}
      disabled={retrying}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-[15px] text-foreground shadow-[var(--shadow-card)] transition active:scale-[0.98] disabled:opacity-60"
    >
      <RefreshCw
        className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      {retrying ? "ひらいています…" : "もう一度ひらく"}
    </button>
  );
}

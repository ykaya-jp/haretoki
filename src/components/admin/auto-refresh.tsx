"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Phase 4 launch-readiness — auto-refresh control for operator
 * dashboards that present live data (`/admin/health` first; the
 * pattern is reusable for any other admin surface that needs to
 * be glance-able on a wall display).
 *
 * Why client + setInterval rather than `revalidate = 300`:
 *   - The Server Component itself uses `connection()` to opt out
 *     of cache (live Supabase probe is per-request), so a static
 *     `revalidate` doesn't apply.
 *   - `router.refresh()` re-runs the server render and surgically
 *     reconciles into the existing tree without losing client
 *     state (scroll position, opened details, badge counts in
 *     other tabs of the same browser).
 *   - The operator can pause refresh via the toggle when they're
 *     mid-investigation and don't want the page jumping out from
 *     under them.
 *
 * Visual: a small footer-pill ("自動更新 5 分ごと · 残り 4:32 · 一時停止")
 * — same operator-tool aesthetic as the rest of /admin (no brand
 * gold-warm; this surface is read-only diagnostics).
 *
 * Reduced-motion respected via the toggle being a button with
 * focus ring; nothing animates on its own.
 */

interface AutoRefreshProps {
  /** Refresh interval in milliseconds. Default 5 minutes. */
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function AutoRefresh({
  intervalMs = DEFAULT_INTERVAL_MS,
}: AutoRefreshProps) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  // Track when the next refresh fires so we can show a countdown.
  // Re-anchored every time the interval ticks (or pause toggles).
  const [nextAt, setNextAt] = useState<number>(() => Date.now() + intervalMs);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (paused) return;

    // Re-anchor the countdown via rAF defer (matches the project's
    // standard set-state-in-effect avoidance recipe — see
    // OnboardingPartnerHint, PartnerCanRateHint, partner-comparison-
    // summary.tsx). Synchronously calling setNextAt here would trip
    // React 19's `set-state-in-effect` rule.
    const raf = requestAnimationFrame(() => {
      setNextAt(Date.now() + intervalMs);
    });

    const refreshTimer = setInterval(() => {
      router.refresh();
      setNextAt(Date.now() + intervalMs);
    }, intervalMs);

    // Drive the countdown display at 1 Hz — cheap, always wall-clock
    // accurate. setState lives inside a setInterval callback (= event
    // handler), so the purity rule doesn't apply.
    const tickTimer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(refreshTimer);
      clearInterval(tickTimer);
    };
  }, [paused, intervalMs, router]);

  const remainingMs = paused ? 0 : Math.max(0, nextAt - now);
  const intervalLabel = `${Math.round(intervalMs / 60_000)} 分`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground"
    >
      <span aria-hidden="true" className="font-mono">
        {paused ? "⏸" : "↻"}
      </span>
      <span>
        自動更新 {intervalLabel}ごと
        {!paused && (
          <>
            {" · "}
            <span className="tabular-nums">残り {formatRemaining(remainingMs)}</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="ml-1 inline-flex min-h-7 items-center rounded-full border border-border/60 px-2 text-[10.5px] font-medium text-foreground/80 transition-colors hover:bg-background"
      >
        {paused ? "再開" : "一時停止"}
      </button>
    </div>
  );
}

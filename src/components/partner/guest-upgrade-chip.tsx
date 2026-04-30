"use client";

import { useEffect, useState } from "react";

/**
 * Subtle upgrade hint chip shown above the "ここから参加する" CTA on the
 * Level 1 guest view.
 *
 * Behavior:
 *   - 30 秒 (or 2+ screens) の後に 1 回だけ box-shadow pulse
 *   - `prefers-reduced-motion` ユーザーには pulse を出さず静的コピーのみ
 *   - DOM 上は常に visible なので、アニメーション無効でも情報は伝わる
 *
 * Initial `pulseOn` is computed from `screenCount >= 2` during render (pure)
 * so we don't trip React 19's set-state-in-effect purity lint. The
 * 30-second timer path runs entirely in the effect.
 */
export function GuestUpgradeChip({ screenCount }: { screenCount: number }) {
  const [pulseOn, setPulseOn] = useState(() => screenCount >= 2);

  useEffect(() => {
    if (screenCount >= 2) return; // already pulsing; nothing to do
    // Respect reduced-motion preference — no pulse, static copy only.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const t = window.setTimeout(() => setPulseOn(true), 30_000);
    return () => window.clearTimeout(t);
  }, [screenCount]);

  return (
    <p
      aria-live="polite"
      className="mx-auto w-fit rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-[11.5px] text-muted-foreground"
      style={{
        transition: "box-shadow 2s ease-in-out",
        boxShadow: pulseOn
          ? "0 0 0 8px color-mix(in oklab, var(--gold-warm) 0%, transparent)"
          : "0 0 0 0 color-mix(in oklab, var(--gold-warm) 40%, transparent)",
      }}
    >
      参加すると、あなたの印象も残せます。
    </p>
  );
}

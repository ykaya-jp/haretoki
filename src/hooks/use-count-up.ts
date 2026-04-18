"use client";

import { useEffect, useState } from "react";

/**
 * useCountUp — animates a numeric value from 0 (or previous stored value)
 * to `target` on mount. Persists the last-seen value in localStorage so
 * that only increases trigger a visible count-up; repeat renders render
 * the final value immediately.
 *
 * Respects `prefers-reduced-motion` by returning the target synchronously.
 */
export function useCountUp(
  target: number,
  storageKey: string,
  durationMs = 800,
): number {
  const [value, setValue] = useState<number>(() => {
    if (typeof window === "undefined") return target;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return target;
    const prev = Number(window.localStorage.getItem(storageKey) ?? "0");
    return Number.isFinite(prev) ? prev : 0;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const prev = Number(window.localStorage.getItem(storageKey) ?? "0");
    const start = Number.isFinite(prev) ? prev : 0;

    if (prefersReduced || target <= start) {
      setValue(target);
      window.localStorage.setItem(storageKey, String(target));
      return;
    }

    let raf = 0;
    const startTs = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (target - start) * eased);
      setValue(next);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        window.localStorage.setItem(storageKey, String(target));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, storageKey, durationMs]);

  return value;
}

"use client";

import { useCallback } from "react";

/**
 * useHaptic — opt-in tactile feedback for high-signal interactions.
 *
 * Wraps `navigator.vibrate` with two guards that the platform itself
 * does not enforce:
 *
 *   1. `prefers-reduced-motion: reduce` — users who opt out of motion
 *      generally also dislike haptics; honour the same OS-level signal.
 *   2. SSR safety — `navigator` is undefined during render, and the
 *      Vibration API is iOS-Safari-blocked anyway, so `vibrate` may
 *      not be a function. Both branches no-op silently.
 *
 * Three named patterns map to high-level intent so callers stay
 * declarative:
 *
 *   - `select`  10ms  — light click, e.g. toggle a chip / heart on
 *   - `success` [12, 60, 18] — short-pause-long, e.g. saved a record
 *   - `impact`  25ms  — solid tap, e.g. confirmed a destructive step
 *
 * The hook returns a stable callback so consumers can pass it into
 * `useTransition` callbacks or memoised handlers without re-rendering.
 *
 * Usage:
 *   const haptic = useHaptic();
 *   <button onClick={() => { haptic("success"); save(); }}>保存</button>
 */

export type HapticIntent = "select" | "success" | "impact";

const PATTERNS: Record<HapticIntent, number | number[]> = {
  // Short single pulse — feels like a click. Used for toggles where
  // the visual change is small (heart fill colour, chip outline) so
  // the haptic is the dominant feedback channel.
  select: 10,
  // Short-pause-long — reads as "completed". Used for saves /
  // confirmations that already trigger a sonner toast; the haptic
  // is supplemental, not primary.
  success: [12, 60, 18],
  // Single solid tap — reads as "committed". Used sparingly for
  // confirmed destructive steps (delete, decision) where we want the
  // user to feel the commit.
  impact: 25,
};

/**
 * Detects whether the current environment supports `navigator.vibrate`
 * AND the user has not opted out of motion. Cheap to call per-event
 * (no listener wiring) since matchMedia is a synchronous lookup.
 */
function canHaptic(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  }
  return true;
}

export function useHaptic() {
  return useCallback((intent: HapticIntent) => {
    if (!canHaptic()) return;
    try {
      // navigator.vibrate returns false on illegal patterns or when
      // the user-agent declines (e.g. battery saver, no recent user
      // gesture); we ignore the boolean — best-effort UX, not
      // critical-path behaviour.
      navigator.vibrate(PATTERNS[intent]);
    } catch {
      // Swallow: some browsers throw on disallowed patterns instead
      // of returning false. Either way, the haptic is supplemental
      // and must never break the parent interaction.
    }
  }, []);
}

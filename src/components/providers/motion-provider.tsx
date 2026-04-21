"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Async-load the full feature set so framer-motion is excluded from the
 * shared First-Load JS chunk. Features are fetched once on the client and
 * cached by the browser thereafter.
 *
 * Uses `domMax` instead of `domAnimation` because SwipeCompare /
 * swipe-card.tsx relies on drag gestures (drag / dragConstraints /
 * dragElastic) which `domAnimation` omits. `domMax` adds ~6KB gz over
 * `domAnimation` but is required for drag to work at runtime.
 *
 * `reducedMotion="user"` makes every framer animation automatically shrink
 * to a near-zero-duration cross-fade when the user has
 * `prefers-reduced-motion: reduce` set at the OS level.
 */
const loadFeatures = () =>
  import("framer-motion").then((m) => m.domMax);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

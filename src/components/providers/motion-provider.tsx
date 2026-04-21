"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Async-load the full feature set so framer-motion is excluded from the
 * shared First-Load JS chunk. Features are fetched once on the client and
 * cached by the browser thereafter.
 *
 * `reducedMotion="user"` makes every framer animation automatically shrink
 * to a near-zero-duration cross-fade when the user has
 * `prefers-reduced-motion: reduce` set at the OS level.
 */
const loadFeatures = () =>
  import("framer-motion").then((m) => m.domAnimation);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

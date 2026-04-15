"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * MotionProvider — global framer-motion configuration.
 *
 * `reducedMotion="user"` makes every framer animation automatically shrink
 * to a near-zero-duration cross-fade (no translate / scale) when the user
 * has `prefers-reduced-motion: reduce` set at the OS level. This is the
 * framer-native counterpart to the CSS `@media (prefers-reduced-motion)`
 * block in globals.css, covering motion that would otherwise bypass CSS.
 *
 * Kept as a client component because MotionConfig relies on React context.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

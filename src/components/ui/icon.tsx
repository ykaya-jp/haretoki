import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Icon — project-wide wrapper around lucide-react icons.
 *
 * Normalizes two things that were inconsistent across the codebase:
 *   1. strokeWidth: lucide defaults to 2, which reads heavy next to
 *      our light serif headings. 1.75 is our "soft luxe" default.
 *      Decorative icons (Sparkles, Bell) should pass 1.5; functional
 *      icons (Search, ChevronRight) keep 1.75 unless explicit.
 *   2. fill="none" is always set so that icons never accidentally
 *      fill with currentColor when placed inside colored pills.
 *
 * Pass any lucide icon via `icon={Sparkles}` and forward the rest of
 * the lucide props (size, className, strokeWidth override, etc.).
 */
export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export function Icon({ icon: LucideGlyph, strokeWidth = 1.75, fill = "none", ...rest }: IconProps) {
  return <LucideGlyph strokeWidth={strokeWidth} fill={fill} {...rest} />;
}

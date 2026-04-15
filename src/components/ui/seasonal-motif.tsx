"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Seasonal decorative motif — a tiny gold-hairline SVG that rotates through
 * four Japanese seasonal flowers based on the current month. Purely
 * decorative: `aria-hidden` by default.
 *
 * Contract:
 * - Jan-Mar  → 梅  (plum blossom)
 * - Apr-Jun  → 桜  (cherry blossom)
 * - Jul-Sep  → 紫陽花 (hydrangea)
 * - Oct-Dec  → 紅葉 (maple leaf)
 *
 * Each SVG is intentionally simple: 1-1.25px strokes, currentColor,
 * default opacity 0.5. All sized via viewBox 0 0 24 24 so `size` maps
 * cleanly to pixel dimensions.
 */

export type SeasonalMotifSize = "sm" | "md";
export type SeasonName = "plum" | "sakura" | "hydrangea" | "maple";

interface SeasonalMotifProps {
  /** Override season detection (useful for tests & storybook). */
  season?: SeasonName;
  /** Motif size — sm=16px (inline), md=32px (hero). Default "sm". */
  size?: SeasonalMotifSize;
  /** Positioning / color overrides. Default tints in gold-warm via `text-` utility. */
  className?: string;
  /** If provided, the SVG becomes a labelled graphic. Otherwise aria-hidden. */
  ariaLabel?: string;
}

function seasonFromMonth(month: number): SeasonName {
  // month is 1-12
  if (month <= 3) return "plum";
  if (month <= 6) return "sakura";
  if (month <= 9) return "hydrangea";
  return "maple";
}

const SIZE_PX: Record<SeasonalMotifSize, number> = {
  sm: 16,
  md: 32,
};

export function SeasonalMotif({
  season,
  size = "sm",
  className,
  ariaLabel,
}: SeasonalMotifProps) {
  // useMemo so we don't recompute on every render, but evaluate client-side
  // to pick up the user's local month.
  const resolvedSeason = useMemo<SeasonName>(() => {
    if (season) return season;
    return seasonFromMonth(new Date().getMonth() + 1);
  }, [season]);

  const dim = SIZE_PX[size];
  const commonSvgProps = {
    width: dim,
    height: dim,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn(
      "text-[var(--gold-warm)] opacity-50",
      className,
    ),
    // Decorative by default; labelled only when the caller needs it.
    "aria-hidden": ariaLabel ? undefined : true,
    role: ariaLabel ? "img" : undefined,
    "aria-label": ariaLabel,
  };

  switch (resolvedSeason) {
    case "plum":
      // 梅 — 5-petal blossom with a tiny center stamen cluster.
      return (
        <svg {...commonSvgProps}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="12"
              cy="7.5"
              rx="2.6"
              ry="3.4"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sakura":
      // 桜 — 5-petal blossom with notched tips (rendered via petal paths).
      return (
        <svg {...commonSvgProps}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              // Petal: leaf shape with a small notch at the tip.
              d="M12 4 C 13.6 5.2, 14.2 7.6, 13 9.2 C 12.5 8.5, 11.5 8.5, 11 9.2 C 9.8 7.6, 10.4 5.2, 12 4 Z"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
          <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "hydrangea":
      // 紫陽花 — cluster of 4 small 4-petal florets.
      return (
        <svg {...commonSvgProps}>
          {[
            { cx: 9, cy: 9 },
            { cx: 15, cy: 9 },
            { cx: 9, cy: 15 },
            { cx: 15, cy: 15 },
          ].map(({ cx, cy }, i) => (
            <g key={i} transform={`translate(${cx - 12} ${cy - 12})`}>
              {[0, 90, 180, 270].map((deg) => (
                <ellipse
                  key={deg}
                  cx="12"
                  cy="10.3"
                  rx="1.2"
                  ry="1.7"
                  transform={`rotate(${deg} 12 12)`}
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case "maple":
    default:
      // 紅葉 — stylized 5-lobe maple leaf with a short stem.
      return (
        <svg {...commonSvgProps}>
          <path d="M12 4 L13.2 7 L16.5 6 L14.8 9.3 L18.5 10 L15.3 12 L17.5 14.8 L13.6 14.2 L13.2 17.5 L12 15 L10.8 17.5 L10.4 14.2 L6.5 14.8 L8.7 12 L5.5 10 L9.2 9.3 L7.5 6 L10.8 7 Z" />
          <line x1="12" y1="15" x2="12" y2="20" />
        </svg>
      );
  }
}

export default SeasonalMotif;

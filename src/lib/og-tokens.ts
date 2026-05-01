/**
 * Shared OG (Open Graph) brand tokens.
 *
 * Used by every `opengraph-image.tsx` under `src/app/**`. Hex literals,
 * not CSS variables — `next/og` (satori) does not resolve `var(--*)` and
 * does not support `oklch()`. The values match the sRGB resolutions of
 * the corresponding `--*` tokens in `src/app/globals.css`.
 *
 * Brand metaphor for OG framing: 曇り (cloudy) → 晴れ間 (gold) → 晴れ
 * (cream). The sky gradient + sun composition lives in each OG file
 * directly because satori's render rules vary across layouts.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

/** Sky / surface palette — sRGB hex. */
export const OG_COLORS = {
  /** Warm gold accent — same hue as `--gold-warm`. AI / brand mark. */
  goldWarm: "#C9A84C",
  /** Lighter gold — splash background, hairline glow. */
  goldSoft: "#E8D89A",
  /** Cool top-of-sky haze — represents 曇り (cloudy). */
  cloudHaze: "#E4DED2",
  /** Ink body text — same hue as `--foreground` in light mode. */
  ink: "#2A2320",
  /** Cream surface — same as `--background` in light mode. */
  cream: "#FDFAF4",
  /** Soft sub-text on cream surface. */
  inkMuted: "#7A6E62",
} as const;

/**
 * The canonical "morning sky" gradient used by every brand-frame OG
 * (root, compare, coach). Top haze fades into a gold band, then settles
 * into cream — the exact 曇り → 晴れ間 → 晴れ metaphor of the product.
 */
export const OG_SKY_GRADIENT = `linear-gradient(180deg, ${OG_COLORS.cloudHaze} 0%, ${OG_COLORS.cloudHaze} 18%, ${OG_COLORS.goldSoft} 48%, ${OG_COLORS.cream} 78%, ${OG_COLORS.cream} 100%)`;

/** Brand eyebrow — appears top-left in every OG. */
export const OG_BRAND_EYEBROW = "HARETOKI";
/** Bottom-right brand stamp. */
export const OG_BRAND_FOOTER = "晴れ時 · haretoki.app";

import { ImageResponse } from "next/og";
import { OG_COLORS } from "@/lib/og-tokens";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 } as const;
export const contentType = "image/png" as const;

/**
 * Favicon — served at `/icon`.
 *
 * Replaces the legacy `/icons/logo.png` favicon (a wordmark, which
 * degraded to an unreadable blob below ~24px). The dynamic icon
 * route renders a minimal "晴れ時" brand mark — a soft gold sun on
 * a cream disk — that stays legible at 16px tab favicons all the
 * way up to 32px desktop bookmarks.
 *
 * Tokens come from `@/lib/og-tokens` so any brand-color retune
 * (gold-warm, cream) propagates here, the OG card, and apple-icon
 * in one edit. `next/og` (satori) does not resolve CSS variables;
 * the og-tokens file holds the sRGB hex authority.
 *
 * Why a single 32x32 instead of a multi-size icon array: Next.js
 * auto-injects a `<link rel="icon" sizes="32x32">`; modern browsers
 * happily downscale to 16x16 from a 32 source. A separate 16x16
 * route exists in older recipes but adds a per-favicon round-trip
 * for negligible visual gain — the disk + sun composition is
 * simple enough that downscaling is lossless in practice.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.cream,
          borderRadius: "50%",
          // Inset gold ring — reads as a horizon glow framing the sun.
          // 1px on a 32px canvas is a pixel-perfect hairline that
          // anti-aliases cleanly.
          boxShadow: `inset 0 0 0 1px ${OG_COLORS.goldSoft}`,
        }}
      >
        {/* The sun itself — soft radial gold disk centered on the
            canvas. We use a flat fill rather than a radial-gradient
            because satori's gradient support is partial and a flat
            fill at this size reads identical to the eye. */}
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: OG_COLORS.goldWarm,
          }}
        />
      </div>
    ),
    { ...size },
  );
}

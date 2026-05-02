import { ImageResponse } from "next/og";
import { OG_COLORS } from "@/lib/og-tokens";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 } as const;
export const contentType = "image/png" as const;

/**
 * iOS / iPadOS home-screen icon — served at `/apple-icon`.
 *
 * 180x180 is the canonical apple-touch-icon size; iOS and iPadOS
 * downscale to 167 / 152 / 120 etc. from this single source, which
 * is why we ship one file instead of the legacy multi-size set.
 *
 * iOS auto-rounds the corners (~22% radius) and renders a subtle
 * specular gloss on older iOS; we bake the rounded corners and the
 * gold halo INTO the image so the icon also reads correctly when
 * pinned to the App Library or a desktop wallpaper-style launcher
 * that does NOT round-mask. The mark itself is centered with ~18%
 * safe-zone padding — well inside Apple's 9% safe-zone guidance —
 * so the radial halo never gets clipped.
 *
 * Composition is deliberately the same as `src/app/icon.tsx`
 * (cream disk + gold sun + horizon halo), scaled up. Couples who
 * see the favicon and the home-screen icon side-by-side recognise
 * them as the same brand mark; the 180px canvas just lets us
 * render the halo softly instead of a flat ring.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "180px",
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Cream background — `--background` light-mode hex. iOS
          // dark-mode home screens still render this in light mode
          // because the launcher wallpaper rarely matches dark mode
          // exactly; a cream icon stays legible on either.
          background: OG_COLORS.cream,
          // 22% rounded corners — matches iOS App Library masking so
          // the icon looks correct when displayed in non-rounded
          // contexts (older Android launchers, share sheets, the
          // Safari "Add to Home Screen" preview).
          borderRadius: "40px",
        }}
      >
        {/* Soft gold halo — a softly-blurred warm disk that mimics
            the brand's "morning sun" mark. We layer two divs so the
            halo can be wider than the sun without affecting the
            sun's hard edge. */}
        <div
          style={{
            position: "absolute",
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${OG_COLORS.goldSoft}88 0%, ${OG_COLORS.goldSoft}33 45%, transparent 70%)`,
            display: "flex",
          }}
        />
        {/* The sun — flat warm gold, ~50% of the canvas. Sized so a
            5% gold-soft halo around the rim still stays inside the
            22% rounded corner radius. */}
        <div
          style={{
            position: "relative",
            width: "92px",
            height: "92px",
            borderRadius: "50%",
            background: OG_COLORS.goldWarm,
            // Inner highlight — gives the disk a soft "morning sun
            // through haze" lift. Top-left light source matches the
            // rest of the brand artwork (hero chapel image, OG card).
            boxShadow:
              "inset 6px 6px 14px rgba(255,255,255,0.18), inset -4px -4px 10px rgba(0,0,0,0.05)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

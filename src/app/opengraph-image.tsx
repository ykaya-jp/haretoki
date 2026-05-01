import { ImageResponse } from "next/og";
import {
  OG_BRAND_EYEBROW,
  OG_BRAND_FOOTER,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OG_SKY_GRADIENT,
} from "@/lib/og-tokens";

export const runtime = "nodejs";
export const alt =
  "晴れ時 — 結婚式場の比較・評価・最終決定をAIが支援するパートナー";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Brand OG used as the default for every route that does NOT define its
 * own `opengraph-image.tsx`. Composes the canonical 晴れ時 morning-sky
 * frame: 曇り (top) → gold sun → cream (bottom), with the brand mark
 * centered. Replaces the static /og-image.png referenced from
 * src/app/layout.tsx for routes that fall back to the root metadata.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: OG_SKY_GRADIENT,
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Sun — soft warm disk diffused behind the haze */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "640px",
            height: "640px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${OG_COLORS.goldWarm}55 0%, ${OG_COLORS.goldSoft}22 45%, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* HARETOKI eyebrow — top-left */}
        <div
          style={{
            position: "absolute",
            top: "48px",
            left: "72px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: "28px",
              height: "2px",
              background: OG_COLORS.goldWarm,
              display: "flex",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              letterSpacing: "0.28em",
              color: OG_COLORS.goldWarm,
              textTransform: "uppercase",
            }}
          >
            {OG_BRAND_EYEBROW}
          </span>
        </div>

        {/* Center composition */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
          }}
        >
          {/* Eyebrow tagline */}
          <div
            style={{
              fontSize: "16px",
              letterSpacing: "0.32em",
              color: OG_COLORS.goldWarm,
              textTransform: "uppercase",
              marginBottom: "28px",
              display: "flex",
            }}
          >
            for the day you say yes
          </div>

          {/* Gold hairline */}
          <div
            style={{
              width: "56px",
              height: "1.5px",
              background: `linear-gradient(to right, transparent, ${OG_COLORS.goldWarm}, transparent)`,
              marginBottom: "36px",
              display: "flex",
            }}
          />

          {/* Brand wordmark — 明朝 light, large */}
          <div
            style={{
              fontSize: "112px",
              fontWeight: 300,
              color: OG_COLORS.ink,
              lineHeight: 1.1,
              letterSpacing: "0.04em",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            晴れ時
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "26px",
              color: OG_COLORS.ink,
              opacity: 0.78,
              fontWeight: 300,
              letterSpacing: "0.06em",
              marginBottom: "12px",
              display: "flex",
              textAlign: "center",
              maxWidth: "880px",
            }}
          >
            式場選びを、もっと納得のいくものに。
          </div>

          {/* Sub-tagline */}
          <div
            style={{
              fontSize: "18px",
              color: OG_COLORS.inkMuted,
              fontWeight: 400,
              letterSpacing: "0.08em",
              display: "flex",
              textAlign: "center",
              maxWidth: "780px",
            }}
          >
            見積もりの落とし穴を先回り、ふたりの好みを見える化する中立ツール。
          </div>
        </div>

        {/* Bottom corner — brand mark */}
        <div
          style={{
            position: "absolute",
            bottom: "36px",
            right: "72px",
            fontSize: "12px",
            letterSpacing: "0.22em",
            color: OG_COLORS.ink,
            opacity: 0.45,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          {OG_BRAND_FOOTER}
        </div>
      </div>
    ),
    { ...size },
  );
}

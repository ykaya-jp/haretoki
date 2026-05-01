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
export const alt = "晴れ時 — AIコーチ";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Coach OG. Coach sessions are private (DMs to a Claude-backed coach
 * scoped to one project), so the share image is brand-frame only —
 * no message body, no transcript snippet. Shape cue: a single soft
 * gold sparkle + a chat-bubble silhouette to communicate "AI partner
 * conversation" at OG-thumbnail scale.
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
        {/* Sun, warm and centered */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${OG_COLORS.goldWarm}55 0%, ${OG_COLORS.goldSoft}1f 50%, transparent 72%)`,
            display: "flex",
          }}
        />

        {/* HARETOKI eyebrow */}
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
            {OG_BRAND_EYEBROW} · COACH
          </span>
        </div>

        {/* Center — chat bubble silhouette + headline */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "20px",
            zIndex: 3,
          }}
        >
          {/* Chat-bubble silhouette pair — couple speaking */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "10px",
              marginBottom: "44px",
            }}
          >
            <div
              style={{
                width: "200px",
                height: "60px",
                borderRadius: "30px 30px 30px 6px",
                background: `linear-gradient(135deg, ${OG_COLORS.goldSoft}cc 0%, ${OG_COLORS.cream}ee 100%)`,
                border: `1px solid ${OG_COLORS.goldSoft}`,
                display: "flex",
              }}
            />
            <div
              style={{
                width: "240px",
                height: "60px",
                borderRadius: "30px 30px 6px 30px",
                background: `linear-gradient(135deg, ${OG_COLORS.cream}ee 0%, ${OG_COLORS.goldSoft}aa 100%)`,
                border: `1px solid ${OG_COLORS.goldSoft}`,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "18px",
              }}
            >
              {/* gold sparkle hint inside the AI bubble */}
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: OG_COLORS.goldWarm,
                  opacity: 0.8,
                  display: "flex",
                }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: "16px",
              letterSpacing: "0.32em",
              color: OG_COLORS.goldWarm,
              textTransform: "uppercase",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            your morning-light coach
          </div>

          <div
            style={{
              fontSize: "76px",
              fontWeight: 300,
              color: OG_COLORS.ink,
              letterSpacing: "0.04em",
              marginBottom: "20px",
              display: "flex",
            }}
          >
            AIコーチに、ふたりで聞く。
          </div>

          <div
            style={{
              fontSize: "22px",
              color: OG_COLORS.ink,
              opacity: 0.78,
              fontWeight: 300,
              letterSpacing: "0.06em",
              display: "flex",
              textAlign: "center",
              maxWidth: "900px",
            }}
          >
            見積もりの落とし穴・候補の比較・決め方の迷いを、その場で。
          </div>
        </div>

        {/* Bottom corner brand stamp */}
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

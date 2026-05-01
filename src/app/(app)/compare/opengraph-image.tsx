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
export const alt = "晴れ時 — ふたりの比較ボード";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Compare board OG. Couples actually share `/compare` between the two
 * accounts ("見て、こう並んだよ"), so the OG is meant to feel like a
 * candid table-of-contents rather than a conversion banner. Three soft
 * "venue cards" sit under the headline as a visual cue for what the
 * destination contains.
 *
 * No project-side data: `/compare` is auth-gated so a public crawler
 * cannot resolve `projectId`, and the use-case is partner-to-partner
 * sharing where the recipient signs in to see the actual board.
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
        {/* Sun, soft */}
        <div
          style={{
            position: "absolute",
            top: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${OG_COLORS.goldWarm}44 0%, ${OG_COLORS.goldSoft}1a 50%, transparent 72%)`,
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
            {OG_BRAND_EYEBROW} · COMPARE
          </span>
        </div>

        {/* Center — headline + tagline + venue chip trio */}
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
            two side by side
          </div>

          <div
            style={{
              fontSize: "76px",
              fontWeight: 300,
              color: OG_COLORS.ink,
              letterSpacing: "0.04em",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            ふたりの比較ボード
          </div>

          <div
            style={{
              fontSize: "22px",
              color: OG_COLORS.ink,
              opacity: 0.78,
              fontWeight: 300,
              letterSpacing: "0.06em",
              marginBottom: "56px",
              display: "flex",
              textAlign: "center",
              maxWidth: "880px",
            }}
          >
            候補の式場を、ふたりの軸で並べて見る。
          </div>

          {/* Three soft "venue card" placeholders — visual rhythm cue */}
          <div
            style={{
              display: "flex",
              gap: "24px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "200px",
                  height: "120px",
                  borderRadius: "16px",
                  background: `linear-gradient(135deg, ${OG_COLORS.goldSoft}80 0%, ${OG_COLORS.cream}cc 100%)`,
                  border: `1px solid ${OG_COLORS.goldSoft}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  padding: "16px",
                  gap: "8px",
                  boxShadow: `0 2px 12px ${OG_COLORS.cloudHaze}66`,
                }}
              >
                {/* Score row */}
                <div
                  style={{
                    width: "100%",
                    height: "2px",
                    background: OG_COLORS.cloudHaze,
                    position: "relative",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${[68, 82, 74][i]}%`,
                      background: OG_COLORS.goldWarm,
                      display: "flex",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "2px",
                    background: OG_COLORS.cloudHaze,
                    position: "relative",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${[80, 60, 88][i]}%`,
                      background: OG_COLORS.goldWarm,
                      opacity: 0.7,
                      display: "flex",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "2px",
                    background: OG_COLORS.cloudHaze,
                    position: "relative",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${[55, 70, 65][i]}%`,
                      background: OG_COLORS.goldWarm,
                      opacity: 0.5,
                      display: "flex",
                    }}
                  />
                </div>
              </div>
            ))}
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

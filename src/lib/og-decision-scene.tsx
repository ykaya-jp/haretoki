import { OG_COLORS } from "@/lib/og-tokens";

/**
 * Shared "decision day" OG scene renderer used by both the horizontal
 * 1200×630 (Twitter / LINE / Open Graph default) and the square
 * 1080×1080 (Instagram Reels / post) variants. Pure JSX returning a
 * `next/og`-compatible composition; the route file calls this and
 * passes the result into `new ImageResponse(...)`.
 *
 * Layout doctrine — round 18 (C-0 v4.2):
 *
 *   Horizontal (1200×630):
 *     - Top 280 px:  optional venue photo as a soft-edged landscape band
 *                     (gold-overlay so it reads as scenery, not a paste-in)
 *     - Sky gradient runs full height behind everything
 *     - Center:      "ふたりが選んだ場所" eyebrow + venue name (mincho) +
 *                    "ここに、決めました。" tagline + date
 *     - Top-left:    HARETOKI eyebrow with hairline mark
 *     - Bottom-right: brand stamp ("晴れ時 · haretoki.app")
 *     - NEW: bottom-center secondary eyebrow "HARETOKI · ふたりの晴れの日"
 *            so the brand metaphor reads even when the share preview
 *            crops the corners (LINE in-app preview clips ~12 % off
 *            the right edge).
 *
 *   Square (1080×1080):
 *     - Top 540 px:  same photo band, scaled to the square's broader
 *                    aspect — keeps the "上が空、下が地" structure
 *     - Center:      same composition with reduced font sizes so the
 *                    mid-band reads on a 1:1 frame
 *     - Bottom-center eyebrow same as horizontal
 *     - The hairline / sun positions are computed from `height` so
 *       the variants share visual rhythm without per-route math
 *
 * Why a helper instead of inlining: the prior inline copy in the
 * single 1200×630 file was ~200 lines. A second copy for square would
 * have desynced the visual language within a week. Centralising here
 * means a designer / copy edit is a single-file diff.
 */

interface DecisionSceneProps {
  width: number;
  height: number;
  venueName: string;
  /** YYYY.MM.DD already formatted by the caller (locale-stable). */
  dateLabel: string;
  /** Absolute URL of the venue's hero photo, or null. The scene
   *  degrades gracefully (sky-only) when null. */
  photoUrl: string | null;
  /** Optional override font family — defaults to satori's serif fallback
   *  if Noto Serif JP isn't loaded. Caller passes the same string they
   *  used as `displayName` in loadGoogleFont. */
  serifFontFamily?: string;
}

export function DecisionOgScene({
  width,
  height,
  venueName,
  dateLabel,
  photoUrl,
  serifFontFamily,
}: DecisionSceneProps) {
  // Photo band height = 44 % of frame for both variants — aspect-tuned.
  // Horizontal: 1200×277 ≈ 4.3:1 letterbox feel.
  // Square:    1080×475 ≈ 2.3:1, broader because the frame is squat.
  const photoBandHeight = Math.round(height * 0.44);

  // Sun disk centered horizontally, sits ~25 % from the top.
  const sunDiameter = Math.round(width * 0.45);
  const sunTop = Math.round(height * 0.18);

  // Center stack scales: horizontal uses larger venue type, square
  // backs off so the 1:1 frame doesn't feel cramped at the bottom.
  const isSquare = width === height;
  const venueFontSize = isSquare
    ? venueName.length > 14
      ? 60
      : 76
    : venueName.length > 14
      ? 52
      : 64;
  const taglineFontSize = isSquare ? 24 : 22;
  const dateFontSize = isSquare ? 20 : 18;
  const eyebrowSize = isSquare ? 16 : 15;

  // Sky gradient — same recipe across variants but stops are anchored
  // to viewport %, so the sun band always lands in the upper third.
  const sky = `linear-gradient(180deg, ${OG_COLORS.cloudHaze} 0%, ${OG_COLORS.cloudHaze} 18%, ${OG_COLORS.goldSoft} 48%, ${OG_COLORS.cream} 78%, ${OG_COLORS.cream} 100%)`;

  // Default font stack — `serifFontFamily` is preferred when the loader
  // succeeded; otherwise satori falls back to its built-in serif.
  const headingFontFamily = serifFontFamily
    ? `${serifFontFamily}, "Noto Serif JP", "Hiragino Mincho ProN", serif`
    : `"Noto Serif JP", "Hiragino Mincho ProN", serif`;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: sky,
        overflow: "hidden",
      }}
    >
      {/* Sun disk — soft warm radial */}
      <div
        style={{
          position: "absolute",
          top: `${sunTop}px`,
          left: "50%",
          transform: "translateX(-50%)",
          width: `${sunDiameter}px`,
          height: `${sunDiameter}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${OG_COLORS.goldWarm}55 0%, ${OG_COLORS.goldSoft}22 45%, transparent 70%)`,
          display: "flex",
        }}
      />

      {/* Photo band — present only when a venue photo exists. The two
          gradient overlays (haze fade + gold sunlight) hide the rect
          edges so the photo reads as the morning landscape instead of
          a pasted-in image. */}
      {photoUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${photoBandHeight}px`,
            display: "flex",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            width={width}
            height={photoBandHeight}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.62,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${OG_COLORS.cloudHaze}dd 0%, transparent 35%, ${OG_COLORS.goldSoft}55 75%, ${OG_COLORS.cream} 100%)`,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(50% 80% at 25% 20%, ${OG_COLORS.goldWarm}40 0%, transparent 60%)`,
              display: "flex",
            }}
          />
        </div>
      )}

      {/* Top-left HARETOKI eyebrow — sits above photo + sky */}
      <div
        style={{
          position: "absolute",
          top: `${Math.round(height * 0.076)}px`,
          left: `${Math.round(width * 0.06)}px`,
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
            fontSize: `${eyebrowSize - 1}px`,
            letterSpacing: "0.28em",
            color: OG_COLORS.goldWarm,
            textTransform: "uppercase",
          }}
        >
          HARETOKI
        </span>
      </div>

      {/* Center stack — eyebrow / hairline / venue name / tagline / date */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: `${Math.round(height * 0.063)}px`,
          zIndex: 3,
        }}
      >
        <div
          style={{
            fontSize: `${eyebrowSize}px`,
            letterSpacing: "0.28em",
            color: OG_COLORS.goldWarm,
            textTransform: "uppercase",
            marginBottom: "24px",
            display: "flex",
          }}
        >
          ふたりが選んだ場所
        </div>

        <div
          style={{
            width: "44px",
            height: "1.5px",
            background: `linear-gradient(to right, transparent, ${OG_COLORS.goldWarm}, transparent)`,
            marginBottom: "32px",
            display: "flex",
          }}
        />

        <div
          style={{
            fontFamily: headingFontFamily,
            fontSize: `${venueFontSize}px`,
            fontWeight: 300,
            color: OG_COLORS.ink,
            lineHeight: 1.2,
            letterSpacing: "0.02em",
            marginBottom: "28px",
            textAlign: "center",
            maxWidth: `${Math.round(width * 0.8)}px`,
            padding: "0 48px",
            display: "flex",
          }}
        >
          {venueName}
        </div>

        <div
          style={{
            fontSize: `${taglineFontSize}px`,
            color: OG_COLORS.ink,
            opacity: 0.72,
            fontWeight: 300,
            letterSpacing: "0.08em",
            marginBottom: "40px",
            display: "flex",
          }}
        >
          ここに、決めました。
        </div>

        <div
          style={{
            fontSize: `${dateFontSize}px`,
            color: OG_COLORS.goldWarm,
            letterSpacing: "0.22em",
            fontFeatureSettings: "'tnum'",
            display: "flex",
          }}
        >
          {dateLabel}
        </div>
      </div>

      {/* Bottom-center secondary eyebrow — round 18 (C-0): "HARETOKI ·
          ふたりの晴れの日". Survives social-platform corner crops better
          than the right-aligned brand stamp alone. The right-corner
          stamp is preserved for desktop preview density. */}
      <div
        style={{
          position: "absolute",
          bottom: `${Math.round(height * 0.085)}px`,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 3,
        }}
      >
        <span
          style={{
            fontSize: `${eyebrowSize - 2}px`,
            letterSpacing: "0.32em",
            color: OG_COLORS.goldWarm,
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          HARETOKI · ふたりの晴れの日
        </span>
      </div>

      {/* Bottom-right brand stamp — preserved from the pre-v4.2 layout.
          Gives desktop previewers a tertiary trust mark when the OG
          tile is rendered at full 1200 px width. */}
      <div
        style={{
          position: "absolute",
          bottom: `${Math.round(height * 0.057)}px`,
          right: `${Math.round(width * 0.06)}px`,
          fontSize: "12px",
          letterSpacing: "0.22em",
          color: OG_COLORS.ink,
          opacity: 0.45,
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        晴れ時 · haretoki.app
      </div>
    </div>
  );
}

/**
 * Format the decision date as YYYY.MM.DD with zero-padding. Pure
 * function so the route + tests share one format spec; satori would
 * happily consume a Date but the dotted form reads better in OG
 * compositions and matches the prior layout exactly.
 */
export function formatDecisionDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}.${String(date.getDate()).padStart(2, "0")}`;
}

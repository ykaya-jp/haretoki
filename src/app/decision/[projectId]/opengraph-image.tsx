import { ImageResponse } from "next/og";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const alt = "式場が決まりました";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OGP share image — "曇り → 晴れ空" の情景として構成。
 *
 * Before: 左 = テキストパネル / 右 = 写真 or gradient の縦 2 分割。
 *         機能的だがブランドメタファー（曇り→晴れ）が伝わらない。
 * After:  縦方向グラデで朝の空を表現する。上端は曇り（cool haze）、
 *         中段で gold の朝日が diffuse、下端は cream に沈める。
 *         中央に venue name（明朝 light）+ 日付 + HARETOKI eyebrow。
 *         写真がある場合は上部 40% に帯状配置し、全体に gold 光をオーバーレイ。
 *         写真がない場合は空のグラデのみで成立させる（情景として完結）。
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const decision = await prisma.decision
    .findUnique({
      where: { projectId },
      include: { venue: true },
    })
    .catch(() => null);

  const venueName = decision?.venue.name ?? "式場";
  const photoUrl = decision?.venue.photoUrls?.[0] ?? null;

  // Decision date formatted as YYYY.MM.DD for tabular elegance.
  const decidedAt = decision?.decidedAt ?? new Date();
  const dateLabel = `${decidedAt.getFullYear()}.${String(
    decidedAt.getMonth() + 1,
  ).padStart(2, "0")}.${String(decidedAt.getDate()).padStart(2, "0")}`;

  // Brand tokens — literal hex so satori/og resolves them without CSS vars.
  const goldWarm = "#C9A84C";
  const goldSoft = "#E8D89A";
  const cloudHaze = "#E4DED2"; // cool haze for top of sky
  const cream = "#FDFAF4";
  const ink = "#2A2320";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          // Sky gradient: 曇り (top) → gold 晴れ間 (middle) → cream (bottom)
          background: `linear-gradient(180deg, ${cloudHaze} 0%, ${cloudHaze} 18%, ${goldSoft} 48%, ${cream} 78%, ${cream} 100%)`,
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Sun — soft warm disk behind the haze, sits around 38% height */}
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${goldWarm}55 0%, ${goldSoft}22 45%, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* Venue photo as a soft-edged landscape band (optional).
            Fills the top 40%, with gradient overlays fading it into the sky
            so the photo reads as scenery, not a pasted rectangle. */}
        {photoUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "280px",
              display: "flex",
            }}
          >
            <img
              src={photoUrl}
              alt=""
              width={1200}
              height={280}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.62,
              }}
            />
            {/* Top haze fade — photo blends into cloudy sky above */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, ${cloudHaze}dd 0%, transparent 35%, ${goldSoft}55 75%, ${cream} 100%)`,
                display: "flex",
              }}
            />
            {/* Gold sunlight glow from upper-left — "朝の光" */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(50% 80% at 25% 20%, ${goldWarm}40 0%, transparent 60%)`,
                display: "flex",
              }}
            />
          </div>
        )}

        {/* HARETOKI eyebrow — top-left, sits above photo and sky */}
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
              background: goldWarm,
              display: "flex",
            }}
          />
          <span
            style={{
              fontSize: "14px",
              letterSpacing: "0.28em",
              color: goldWarm,
              textTransform: "uppercase",
            }}
          >
            HARETOKI
          </span>
        </div>

        {/* Center composition — eyebrow, venue name (mincho), tagline, date */}
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
            paddingTop: "40px",
            zIndex: 3,
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: "15px",
              letterSpacing: "0.28em",
              color: goldWarm,
              textTransform: "uppercase",
              marginBottom: "24px",
              display: "flex",
            }}
          >
            ふたりが選んだ場所
          </div>

          {/* Gold hairline */}
          <div
            style={{
              width: "44px",
              height: "1.5px",
              background: `linear-gradient(to right, transparent, ${goldWarm}, transparent)`,
              marginBottom: "32px",
              display: "flex",
            }}
          />

          {/* Venue name — 明朝 light の迫力 */}
          <div
            style={{
              fontSize: venueName.length > 14 ? 52 : 64,
              fontWeight: 300,
              color: ink,
              lineHeight: 1.2,
              letterSpacing: "0.02em",
              marginBottom: "28px",
              textAlign: "center",
              maxWidth: "960px",
              padding: "0 48px",
              display: "flex",
            }}
          >
            {venueName}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "22px",
              color: ink,
              opacity: 0.72,
              fontWeight: 300,
              letterSpacing: "0.08em",
              marginBottom: "40px",
              display: "flex",
            }}
          >
            ここに、決めました。
          </div>

          {/* Date — tabular, gold */}
          <div
            style={{
              fontSize: "18px",
              color: goldWarm,
              letterSpacing: "0.22em",
              fontFeatureSettings: "'tnum'",
              display: "flex",
            }}
          >
            {dateLabel}
          </div>
        </div>

        {/* Bottom corner — brand mark in small caps */}
        <div
          style={{
            position: "absolute",
            bottom: "36px",
            right: "72px",
            fontSize: "12px",
            letterSpacing: "0.22em",
            color: ink,
            opacity: 0.45,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          晴れ時 · haretoki.app
        </div>
      </div>
    ),
    { ...size },
  );
}

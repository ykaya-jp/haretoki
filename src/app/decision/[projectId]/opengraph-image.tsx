import { ImageResponse } from "next/og";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const alt = "式場が決まりました";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

  // Dawn gradient colours (matches brand tokens)
  const goldWarm = "#C9A84C";
  const goldSubtle = "#F9F3E3";
  const ink = "#2A2320";
  const cream = "#FDFAF4";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: cream,
          fontFamily: "sans-serif",
        }}
      >
        {/* Left panel — text */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px",
            background: `radial-gradient(80% 80% at 20% 50%, ${goldSubtle} 0%, ${cream} 70%)`,
          }}
        >
          {/* Brand tag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "2px",
                background: goldWarm,
              }}
            />
            <span
              style={{
                fontSize: "13px",
                letterSpacing: "0.22em",
                color: goldWarm,
                textTransform: "uppercase",
              }}
            >
              HARETOKI
            </span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "18px",
              color: ink,
              opacity: 0.55,
              letterSpacing: "0.05em",
              marginBottom: "16px",
            }}
          >
            ふたりが選んだ場所
          </div>

          {/* Venue name */}
          <div
            style={{
              fontSize: photoUrl ? 40 : 52,
              fontWeight: 300,
              color: ink,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              marginBottom: "24px",
            }}
          >
            {venueName}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "22px",
              color: ink,
              opacity: 0.7,
              fontWeight: 300,
            }}
          >
            ここに決めました
          </div>

          {/* Gold rule */}
          <div
            style={{
              width: "48px",
              height: "2px",
              background: goldWarm,
              marginTop: "32px",
              opacity: 0.7,
            }}
          />
        </div>

        {/* Right panel — photo or gradient */}
        <div
          style={{
            width: "480px",
            display: "flex",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {photoUrl ? (
              <img
              src={photoUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(135deg, ${goldSubtle} 0%, ${goldWarm}33 100%)`,
              }}
            />
          )}
          {/* Fade overlay on left edge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "80px",
              height: "100%",
              background: `linear-gradient(to right, ${cream}, transparent)`,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

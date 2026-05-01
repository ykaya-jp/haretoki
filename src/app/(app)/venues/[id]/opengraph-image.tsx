import { ImageResponse } from "next/og";
import { prisma } from "@/server/db";
import { aggregateScoresByDimension } from "@/lib/weighted-score";
import { DIMENSION_LABELS, TIER1_DIMENSIONS } from "@/lib/constants";
import {
  OG_BRAND_EYEBROW,
  OG_BRAND_FOOTER,
  OG_COLORS,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og-tokens";

export const runtime = "nodejs";
export const alt = "式場の概要";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const MAX_DIMS = 3;

/**
 * Per-venue OG. Two-column composition: full-bleed venue photo on the
 * left (with cream-feathered edge so it reads as a scene, not a pasted
 * rectangle), copy column on the right with name + a top-3 dimension
 * trio.
 *
 * Auth-free: the share link is meant to land on a public OG render
 * even when the recipient is not signed in. Service-role read of the
 * minimum columns we need; we never expose anything private (notes,
 * estimates, internal scores by source — only the public-safe weighted
 * aggregate per dimension).
 */
export default async function VenueOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const venue = await prisma.venue
    .findFirst({
      where: { id, deletedAt: null },
      select: {
        name: true,
        location: true,
        photoUrls: true,
        scores: { select: { dimension: true, score: true, source: true } },
      },
    })
    .catch(() => null);

  // Graceful fallback to brand frame when the venue is gone or hidden.
  if (!venue) {
    return renderFallback();
  }

  const photoUrl = venue.photoUrls?.[0] ?? null;
  const venueName = venue.name;
  const location = venue.location ?? null;

  // Aggregate scores per Tier-1 dimension, then take the top three.
  // We deliberately filter to TIER1_DIMENSIONS so that legacy raw keys
  // (atmosphere / access / etc.) don't flood the OG with synonyms of
  // the same axis the user already sees in the Tier-1 panel.
  const aggregated = aggregateScoresByDimension(
    venue.scores.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      source: s.source,
    })),
  );
  const tier1Pairs: Array<{ dim: string; value: number }> = [];
  for (const dim of TIER1_DIMENSIONS) {
    const value = aggregated[dim];
    if (typeof value === "number" && Number.isFinite(value)) {
      tier1Pairs.push({ dim, value });
    }
  }
  const top3 = tier1Pairs.sort((a, b) => b.value - a.value).slice(0, MAX_DIMS);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          background: OG_COLORS.cream,
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Left — venue photo (or gold-haze fallback). 60% width, full
            height, with a cream gradient feathering the right edge into
            the copy column so the seam disappears. */}
        <div
          style={{
            position: "relative",
            width: "720px",
            height: "100%",
            display: "flex",
            background: photoUrl
              ? OG_COLORS.cloudHaze
              : `linear-gradient(135deg, ${OG_COLORS.cloudHaze} 0%, ${OG_COLORS.goldSoft} 100%)`,
          }}
        >
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              width={720}
              height={630}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          {/* Right-edge cream feather */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "180px",
              display: "flex",
              background: `linear-gradient(to right, transparent 0%, ${OG_COLORS.cream} 90%)`,
            }}
          />
          {/* Top-left gold sunlight glow — alive even when the photo is dim */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background: `radial-gradient(40% 60% at 20% 15%, ${OG_COLORS.goldWarm}33 0%, transparent 60%)`,
            }}
          />
        </div>

        {/* Right — copy column. Slight overlap into the photo via
            negative margin makes the brand mark sit on the cream-fade. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: "560px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 64px",
          }}
        >
          {/* HARETOKI eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "2px",
                background: OG_COLORS.goldWarm,
                display: "flex",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                letterSpacing: "0.28em",
                color: OG_COLORS.goldWarm,
                textTransform: "uppercase",
              }}
            >
              {OG_BRAND_EYEBROW}
            </span>
          </div>

          {/* Venue name — 明朝 light, autoshrink for long names */}
          <div
            style={{
              fontSize: venueName.length > 18 ? 38 : venueName.length > 12 ? 46 : 54,
              fontWeight: 300,
              color: OG_COLORS.ink,
              lineHeight: 1.25,
              letterSpacing: "0.01em",
              marginBottom: location ? "14px" : "32px",
              display: "flex",
              maxWidth: "520px",
            }}
          >
            {venueName}
          </div>

          {location && (
            <div
              style={{
                fontSize: "16px",
                color: OG_COLORS.inkMuted,
                fontWeight: 400,
                letterSpacing: "0.04em",
                marginBottom: "32px",
                display: "flex",
                maxWidth: "520px",
              }}
            >
              {location}
            </div>
          )}

          {/* Gold hairline */}
          <div
            style={{
              width: "44px",
              height: "1.5px",
              background: `linear-gradient(to right, ${OG_COLORS.goldWarm}, transparent)`,
              marginBottom: "28px",
              display: "flex",
            }}
          />

          {/* Top-3 dimension trio. Each row is "label · score / 5" with
              a slim gold bar reflecting the 0–5 rating. Skipped when no
              scores exist so an unrated venue isn't shown with three
              empty rows. */}
          {top3.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {top3.map((row) => {
                const percent = Math.max(0, Math.min(1, row.value / 5));
                const label = DIMENSION_LABELS[row.dim] ?? row.dim;
                const valueLabel = row.value.toFixed(1);
                return (
                  <div
                    key={row.dim}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          color: OG_COLORS.inkMuted,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          color: OG_COLORS.ink,
                          fontWeight: 500,
                          fontFeatureSettings: "'tnum'",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {valueLabel}
                        <span
                          style={{
                            color: OG_COLORS.inkMuted,
                            opacity: 0.6,
                            fontSize: "12px",
                            marginLeft: "4px",
                          }}
                        >
                          / 5
                        </span>
                      </span>
                    </div>
                    {/* Score bar */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "3px",
                        background: `${OG_COLORS.cloudHaze}`,
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          width: `${percent * 100}%`,
                          background: OG_COLORS.goldWarm,
                          display: "flex",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                fontSize: "14px",
                color: OG_COLORS.inkMuted,
                fontWeight: 400,
                letterSpacing: "0.06em",
                display: "flex",
              }}
            >
              ふたりの軸でこの式場を評価する
            </div>
          )}
        </div>

        {/* Bottom corner — brand stamp */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "64px",
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

/** Last-resort brand frame when the venue can't be resolved. Keeps the
 *  share link from rendering a 404 image, which a few crawlers cache as
 *  a permanent miss. */
function renderFallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: `linear-gradient(180deg, ${OG_COLORS.cloudHaze} 0%, ${OG_COLORS.goldSoft} 50%, ${OG_COLORS.cream} 100%)`,
          fontFamily: "sans-serif",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            letterSpacing: "0.32em",
            color: OG_COLORS.goldWarm,
            textTransform: "uppercase",
            marginBottom: "24px",
            display: "flex",
          }}
        >
          {OG_BRAND_EYEBROW}
        </div>
        <div
          style={{
            fontSize: "72px",
            fontWeight: 300,
            color: OG_COLORS.ink,
            letterSpacing: "0.04em",
            display: "flex",
          }}
        >
          晴れ時
        </div>
        <div
          style={{
            fontSize: "20px",
            color: OG_COLORS.inkMuted,
            marginTop: "20px",
            letterSpacing: "0.06em",
            display: "flex",
          }}
        >
          式場選びを、もっと納得のいくものに。
        </div>
      </div>
    ),
    { ...size },
  );
}

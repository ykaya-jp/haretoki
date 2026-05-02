import { ImageResponse } from "next/og";
import { prisma } from "@/server/db";
import {
  DecisionOgScene,
  formatDecisionDate,
} from "@/lib/og-decision-scene";
import { loadGoogleFont } from "@/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "式場が決まりました";
/**
 * Square variant — 1080×1080, intended for Instagram (post + Reels
 * cover) and any other 1:1 social tile. Next.js routes this as
 * `/decision/<id>/opengraph-image-square` so a future page-level
 * `metadata.openGraph.images` array can advertise both sizes side by
 * side. Filename suffix follows Next.js's documented convention for
 * multiple OG images per route.
 */
export const size = { width: 1080, height: 1080 };
export const contentType = "image/png";

export default async function OgImageSquare({
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
  const decidedAt = decision?.decidedAt ?? new Date();
  const dateLabel = formatDecisionDate(decidedAt);

  // Same subset recipe as the horizontal variant — the rendered text
  // surface is identical between the two compositions.
  const subsetText = `${venueName}ここに、決めました。${dateLabel}`;
  const serif = await loadGoogleFont({
    family: "Noto+Serif+JP",
    weight: 300,
    text: subsetText,
    displayName: "NotoSerifJP",
  });

  return new ImageResponse(
    (
      <DecisionOgScene
        width={size.width}
        height={size.height}
        venueName={venueName}
        dateLabel={dateLabel}
        photoUrl={photoUrl}
        serifFontFamily={serif?.name}
      />
    ),
    {
      ...size,
      fonts: serif
        ? [
            {
              name: serif.name,
              data: serif.data,
              weight: serif.weight,
              style: serif.style,
            },
          ]
        : undefined,
    },
  );
}

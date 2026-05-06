"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { DIMENSION_LABELS } from "@/lib/constants";

/**
 * Where partner ratings diverge most across the comparison set.
 *
 * Surfaces the single dimension per venue with the largest |owner -
 * partner| delta (≥ 1.0 to avoid noise). Caller renders the top 3
 * deltas across all venues — couples open /compare partly to find
 * "what should we talk about", and the score-grid alone makes the
 * disagreement implicit (you have to read both names + every dimension
 * to spot it). This makes it explicit.
 *
 * Solo projects (no partner) return [] silently — the surface hides.
 * Zero AI cost, deterministic.
 */
export interface VenueDisagreement {
  venueId: string;
  venueName: string;
  dimension: string;
  dimensionLabel: string;
  ownerName: string;
  ownerScore: number;
  partnerName: string;
  partnerScore: number;
  delta: number;
}

const MIN_DELTA = 1.0;
const TOP_K = 3;

export async function getMatrixDisagreements(
  venueIds: string[],
): Promise<VenueDisagreement[]> {
  if (venueIds.length === 0) return [];

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (members.length < 2) return []; // solo project — no partner to disagree with

  const viewer = members.find((m) => m.userId === user.id);
  const partner = members.find((m) => m.userId !== user.id);
  if (!viewer || !partner) return [];

  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  const nameById = new Map(venues.map((v) => [v.id, v.name]));

  const ratings = await prisma.visitRating.findMany({
    where: {
      visit: { venueId: { in: venueIds } },
      deletedAt: null,
    },
    select: {
      userId: true,
      dimension: true,
      score: true,
      visit: { select: { venueId: true } },
    },
  });

  // Group ratings by (venueId, userId, dimension) — pick latest if duplicates.
  type Key = `${string}:${string}:${string}`;
  const map = new Map<Key, number>();
  for (const r of ratings) {
    const key: Key = `${r.visit.venueId}:${r.userId}:${r.dimension}`;
    map.set(key, Number(r.score));
  }

  const results: VenueDisagreement[] = [];
  for (const venueId of venueIds) {
    const venueName = nameById.get(venueId);
    if (!venueName) continue;

    let bestDim: string | null = null;
    let bestDelta = 0;
    let bestOwner = 0;
    let bestPartner = 0;

    // Walk every dimension this venue has BOTH ratings for, find max delta.
    for (const dim of new Set(
      ratings
        .filter((r) => r.visit.venueId === venueId)
        .map((r) => r.dimension),
    )) {
      const ownerScore = map.get(`${venueId}:${viewer.user.id}:${dim}`);
      const partnerScore = map.get(`${venueId}:${partner.user.id}:${dim}`);
      if (ownerScore == null || partnerScore == null) continue;
      const delta = Math.abs(ownerScore - partnerScore);
      if (delta > bestDelta) {
        bestDelta = delta;
        bestDim = dim;
        bestOwner = ownerScore;
        bestPartner = partnerScore;
      }
    }

    if (bestDim && bestDelta >= MIN_DELTA) {
      results.push({
        venueId,
        venueName,
        dimension: bestDim,
        dimensionLabel: DIMENSION_LABELS[bestDim] ?? bestDim,
        ownerName: viewer.user.name ?? viewer.user.email ?? "あなた",
        ownerScore: bestOwner,
        partnerName: partner.user.name ?? partner.user.email ?? "パートナー",
        partnerScore: bestPartner,
        delta: bestDelta,
      });
    }
  }

  return results
    .sort((a, b) => b.delta - a.delta)
    .slice(0, TOP_K);
}

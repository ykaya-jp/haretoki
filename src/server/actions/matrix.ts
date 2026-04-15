"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";

export interface MatrixVenue {
  id: string;
  name: string;
  photoUrl: string | null;
  totalScore: number | null;
  scoresByDimension: Record<string, number | null>;
  costMin: number | null;
  costMax: number | null;
  latestEstimateTotal: number | null;
  /** Filter fields (F-08) — see prisma/schema.prisma → Venue */
  dressBringIn: "allowed" | "not_allowed" | "negotiable" | null;
  dressBringInFee: number | null;
  paymentMethodEnums: string[];
  maxInstallments: number | null;
}

export interface MatrixData {
  venues: MatrixVenue[];
  dimensions: Array<{ id: string; label: string }>;
  winners: Record<string, string>; // dimension/total → venueId
}

/**
 * Get N-way comparison data for Decision Matrix view.
 * Returns all favorites with scores per dimension + cost info.
 */
export async function getMatrixData(): Promise<MatrixData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get all favorited venues for this user's project
  const favorites = await prisma.venueFavorite.findMany({
    where: {
      userId: user.id,
      venue: { projectId },
    },
    include: {
      venue: {
        include: {
          // Include both user_rating and ai_analysis scores (fallback)
          scores: { where: { source: { in: ["user_rating", "ai_analysis"] } } },
          estimates: { orderBy: { version: "desc" }, take: 1 },
        },
      },
    },
  });

  const dimensions = TIER1_DIMENSIONS.map((id) => ({
    id,
    label: DIMENSION_LABELS[id] ?? id,
  }));

  const venues: MatrixVenue[] = favorites.map((fav) => {
    const scoresByDimension: Record<string, number | null> = {};
    let totalScore: number | null = null;

    for (const id of TIER1_DIMENSIONS) {
      // Prefer user_rating over ai_analysis
      const userScore = fav.venue.scores.find(
        (s) => s.dimension === id && s.source === "user_rating",
      );
      const aiScore = fav.venue.scores.find(
        (s) => s.dimension === id && s.source === "ai_analysis",
      );
      const match = userScore ?? aiScore;
      scoresByDimension[id] = match ? Number(match.score) : null;
    }

    const validScores = Object.values(scoresByDimension).filter(
      (s): s is number => s !== null,
    );
    if (validScores.length > 0) {
      totalScore =
        Math.round(
          (validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10,
        ) / 10;
    }

    return {
      id: fav.venue.id,
      name: fav.venue.name,
      photoUrl: fav.venue.photoUrls[0] ?? null,
      totalScore,
      scoresByDimension,
      costMin: fav.venue.costMin,
      costMax: fav.venue.costMax,
      latestEstimateTotal: fav.venue.estimates[0]?.total ?? null,
      dressBringIn: fav.venue.dressBringIn,
      dressBringInFee: fav.venue.dressBringInFee,
      paymentMethodEnums: fav.venue.paymentMethodEnums,
      maxInstallments: fav.venue.maxInstallments,
    };
  });

  // Compute winners per dimension and total
  const winners: Record<string, string> = {};

  if (venues.length > 0) {
    // Total winner
    const topTotal = venues.reduce<MatrixVenue | null>((acc, v) => {
      if (v.totalScore === null) return acc;
      if (!acc || acc.totalScore === null) return v;
      return v.totalScore > acc.totalScore ? v : acc;
    }, null);
    if (topTotal) winners.total = topTotal.id;

    // Per-dimension winners
    for (const id of TIER1_DIMENSIONS) {
      const topDim = venues.reduce<MatrixVenue | null>((acc, v) => {
        const s = v.scoresByDimension[id];
        if (s === null) return acc;
        const accScore = acc?.scoresByDimension[id];
        if (acc === null || accScore === null || accScore === undefined) return v;
        return s > accScore ? v : acc;
      }, null);
      if (topDim) winners[id] = topDim.id;
    }

    // Cost winner (lowest)
    const topCost = venues.reduce<MatrixVenue | null>((acc, v) => {
      const cost = v.latestEstimateTotal ?? v.costMax ?? v.costMin;
      if (cost === null) return acc;
      const accCost = acc ? acc.latestEstimateTotal ?? acc.costMax ?? acc.costMin : null;
      if (acc === null || accCost === null) return v;
      return cost < accCost ? v : acc;
    }, null);
    if (topCost) winners.cost_value = topCost.id;
  }

  return { venues, dimensions, winners };
}

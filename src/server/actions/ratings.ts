"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";
import { ratingSchema } from "@/server/actions/rating-schema";
import type { RatingInput } from "@/server/actions/rating-schema";
import type { ScoreDimension } from "@/generated/prisma/client";

// --- Server actions ---

export async function saveRatings(
  venueId: string,
  visitId: string,
  input: RatingInput,
) {
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  // Upsert each dimension rating for this visit
  const upserts = Object.entries(parsed.data.ratings).map(
    ([dimension, score]) =>
      prisma.visitRating.upsert({
        where: {
          visitId_userId_dimension: {
            visitId,
            userId: user.id,
            dimension: dimension as ScoreDimension,
          },
        },
        update: { score },
        create: {
          visitId,
          userId: user.id,
          dimension: dimension as ScoreDimension,
          score,
        },
      }),
  );

  await prisma.$transaction(upserts);

  // Aggregate: for each dimension, average all visit ratings for this venue
  // then upsert into venue_scores with source "user_rating"
  const allRatings = await prisma.visitRating.findMany({
    where: {
      visit: { venueId },
    },
    select: {
      dimension: true,
      score: true,
    },
  });

  // Group by dimension and compute averages
  const dimensionScores = new Map<ScoreDimension, number[]>();
  for (const r of allRatings) {
    const existing = dimensionScores.get(r.dimension) ?? [];
    existing.push(r.score);
    dimensionScores.set(r.dimension, existing);
  }

  const scoreUpserts = Array.from(dimensionScores.entries()).map(
    ([dimension, scores]) => {
      const avg =
        Math.round(
          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10,
        ) / 10;
      return prisma.venueScore.upsert({
        where: {
          venueId_dimension_source: {
            venueId,
            dimension,
            source: "user_rating",
          },
        },
        update: {
          score: avg,
          reviewCount: scores.length,
        },
        create: {
          venueId,
          dimension,
          source: "user_rating",
          score: avg,
          reviewCount: scores.length,
        },
      });
    },
  );

  await prisma.$transaction(scoreUpserts);

  revalidatePath(`/venues/${venueId}`);

  return { success: true as const };
}

/**
 * Save ratings directly for a venue without requiring a visitId.
 * Auto-creates a "completed" Visit if none exists.
 */
export async function saveDirectRatings(venueId: string, input: RatingInput) {
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  // Find or create a visit for direct ratings
  let visit = await prisma.visit.findFirst({
    where: { venueId, status: "completed" },
    orderBy: { createdAt: "desc" },
  });

  if (!visit) {
    visit = await prisma.visit.create({
      data: {
        venueId,
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  // Reuse existing saveRatings logic with the visit id
  return saveRatings(venueId, visit.id, input);
}

/**
 * Get both owner and partner ratings for a venue, grouped by user.
 * Returns null for partnerRatings if no partner exists.
 */
export async function getPartnerRatings(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  await requireVenueAccess(user.id, venueId);

  // Get all project members
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const owner = members.find((m) => m.role === "owner");
  const partner = members.find((m) => m.role === "partner");

  // Get all visit ratings for this venue, grouped by userId
  const allRatings = await prisma.visitRating.findMany({
    where: { visit: { venueId } },
    select: { userId: true, dimension: true, score: true },
  });

  function buildRatingsMap(userId: string): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of allRatings) {
      if (r.userId === userId) {
        // If multiple ratings per dimension, use latest (last in array)
        map[r.dimension] = r.score;
      }
    }
    return map;
  }

  return {
    ownerRatings: owner
      ? {
          name: owner.user.name ?? owner.user.email,
          ratings: buildRatingsMap(owner.user.id),
        }
      : null,
    partnerRatings: partner
      ? {
          name: partner.user.name ?? partner.user.email,
          ratings: buildRatingsMap(partner.user.id),
        }
      : null,
  };
}

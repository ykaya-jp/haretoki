"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
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
  const { projectId } = await requireVenueAccess(user.id, venueId);

  // Run upserts + aggregation + venueScore upserts inside a single transaction so
  // concurrent edits (owner + partner at the same time) can't read a stale set of
  // ratings and compute an outdated average — prevents lost-update race condition.
  await prisma.$transaction(async (tx) => {
    // 1) Upsert every dimension rating for this visit. Each upsert keys on
    //    a distinct (visitId, userId, dimension) tuple so they target
    //    different rows — Prisma's interactive transaction supports
    //    Promise.all on independent operations, so we collapse the
    //    sequential per-dimension RTTs to a single burst.
    await Promise.all(
      Object.entries(parsed.data.ratings).map(([dimension, score]) =>
        tx.visitRating.upsert({
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
      ),
    );

    // 2) Re-read all ratings inside the same transaction (consistent snapshot)
    const allRatings = await tx.visitRating.findMany({
      where: { visit: { venueId } },
      select: { dimension: true, score: true },
    });

    // 3) Group by dimension & compute averages. Prisma returns Decimal
    // columns as Decimal.js objects; coerce to number before arithmetic.
    const dimensionScores = new Map<ScoreDimension, number[]>();
    for (const r of allRatings) {
      const existing = dimensionScores.get(r.dimension) ?? [];
      existing.push(Number(r.score));
      dimensionScores.set(r.dimension, existing);
    }

    // 4) Upsert venue_scores for each affected dimension. Same row-
    //    independence story as step 1 — each upsert keys on a unique
    //    (venueId, dimension, source) — so Promise.all is safe inside
    //    the interactive transaction.
    await Promise.all(
      Array.from(dimensionScores.entries()).map(([dimension, scores]) => {
        const avg =
          Math.round(
            (scores.reduce((a, b) => a + b, 0) / scores.length) * 10,
          ) / 10;
        return tx.venueScore.upsert({
          where: {
            venueId_dimension_source: {
              venueId,
              dimension,
              source: "user_rating",
            },
          },
          update: { score: avg, reviewCount: scores.length },
          create: {
            venueId,
            dimension,
            source: "user_rating",
            score: avg,
            reviewCount: scores.length,
          },
        });
      }),
    );
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
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
 * Get the viewer's own ratings + the other member's ratings for a venue.
 *
 * **Viewer-aware** (Phase 3 wave 1.1, round 23): the prior shape
 * `{ ownerRatings, partnerRatings }` was role-keyed, which double-
 * counted whenever the partner viewed the page (their own rating
 * surfaced in BOTH the "own" row and the "partner" row of the UI).
 * The new shape `{ ownRatings, otherRatings }` keys on the viewer
 * — `ownRatings` is whoever is signed in, `otherRatings` is the
 * other project member regardless of role.
 *
 * Returns null for `otherRatings` when the project has no partner
 * yet (single-member project). Returns null for `ownRatings` only
 * when the viewer somehow isn't a project member at all (auth
 * normally rejects that path before we reach here, but the null
 * is a safer contract than throwing for the rare race).
 */
export async function getCoupleRatings(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  await requireVenueAccess(user.id, venueId);

  // Get all accepted project members. `acceptedAt` filter excludes a
  // partner who was invited but hasn't joined yet — their userId would
  // be null on the row anyway, but the filter makes intent explicit.
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const viewer = members.find((m) => m.userId === user.id);
  const other = members.find((m) => m.userId !== user.id);

  // Get all visit ratings for this venue. Pulling everyone's ratings in
  // one shot (vs two userId-filtered queries) keeps the round-trip
  // count at one and matches what the prior `getPartnerRatings` did.
  const allRatings = await prisma.visitRating.findMany({
    where: { visit: { venueId } },
    select: { userId: true, dimension: true, score: true },
  });

  function buildRatingsMap(userId: string): Record<string, number> {
    const map: Record<string, number> = {};
    for (const r of allRatings) {
      if (r.userId === userId) {
        // If multiple ratings per dimension, use latest (last in array)
        map[r.dimension] = Number(r.score);
      }
    }
    return map;
  }

  return {
    ownRatings: viewer
      ? {
          name: viewer.user.name ?? viewer.user.email,
          ratings: buildRatingsMap(viewer.user.id),
        }
      : null,
    otherRatings: other
      ? {
          name: other.user.name ?? other.user.email,
          ratings: buildRatingsMap(other.user.id),
        }
      : null,
  };
}

/**
 * @deprecated Round 23 (Phase 3 wave 1.1) — use `getCoupleRatings`
 * instead. This shape was role-keyed (`ownerRatings` / `partnerRatings`)
 * which double-counted the partner's own rating when the partner was
 * the viewer. The only known caller (the venue page) has been migrated
 * to `getCoupleRatings`; this thin compat layer remains so any
 * unmigrated caller still compiles, and will be removed in the wave
 * that finishes Partner Level 2.
 */
export async function getPartnerRatings(venueId: string) {
  const couple = await getCoupleRatings(venueId);
  // Compat shape preserved for legacy callers — the names lie when
  // the viewer is the partner (own = partner, "partner" = owner) but
  // that's the same bug the original function had, so this proxy is
  // strictly behaviour-preserving for anyone who hasn't migrated.
  return {
    ownerRatings: couple.ownRatings,
    partnerRatings: couple.otherRatings,
  };
}

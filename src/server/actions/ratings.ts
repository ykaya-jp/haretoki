"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";
import { ratingSchema } from "@/server/actions/rating-schema";
import type { RatingInput } from "@/server/actions/rating-schema";
import type { ScoreDimension } from "@/generated/prisma/client";
import {
  publishRealtimeEvent,
  resolveActor,
} from "@/lib/realtime/publish";
import {
  computeCoupleVenueScoresBulk,
  type CoupleVenueScore,
  type ScoreByDimension,
} from "@/lib/scoring";
import type { Tier1Dimension } from "@/lib/constants";

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

  // Phase 3 L3 wave 1 — broadcast a semantic event so the partner's
  // open client paints a "{name}さんが評価を残しました" toast and
  // refreshes their view. Best-effort: the helper swallows errors so
  // a flaky realtime socket can't poison the success path.
  const actor = await resolveActor(user.id);
  await publishRealtimeEvent(projectId, {
    kind: "rating_saved",
    actor,
    venueId,
    dimensionCount: Object.keys(parsed.data.ratings).length,
  });

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
 * Release β B-2 bulk helper for the /candidates VenueCard weather
 * badge. Returns `Record<venueId, CoupleVenueScore | null>` for every
 * venueId in the input. `null` lands for ids that aren't in the
 * viewer's project (silent IDOR filter) or that have no VisitRating
 * for either spouse yet (badge stays hidden on those cards).
 *
 * Scope: parent VisitRating only. Child VenueChecklistAnswer fall-back
 * via `aggregateChildScoresToDimensions` is deliberately out of scope
 * for β — the badge is a low-fidelity signal and parent ratings are
 * the canonical input; adding child aggregation here would double the
 * round-trips for negligible badge-mix change. Plan: revisit in γ if
 * users complain that child-only venues miss out on a badge.
 *
 * Round-trips: O(1) regardless of N venueIds.
 *   - 1 query: venue auth-filter
 *   - 1 query: project members (to derive partner userId)
 *   - 1 query: VisitRating WHERE visit.venueId IN ids AND userId IN
 *     {own, partner}
 * Pure aggregation + computeCoupleVenueScoresBulk after that.
 */
export async function getCoupleScoresForVenues(
  venueIds: string[],
): Promise<Record<string, CoupleVenueScore | null>> {
  if (venueIds.length === 0) return {};
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Auth filter: only return scores for venues in the viewer's
  // project. Anything outside (= the caller passed an id from another
  // project, or a deleted venue) lands as `null` in the output so the
  // caller can map every requested id 1-to-1 without a missing key.
  const projectVenues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId, deletedAt: null },
    select: { id: true },
  });
  const allowedIds = projectVenues.map((v) => v.id);

  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: { userId: true },
  });
  const ownUserId = user.id;
  const partnerUserId =
    members.find((m) => m.userId !== ownUserId)?.userId ?? null;

  const userIdsToFetch = partnerUserId
    ? [ownUserId, partnerUserId]
    : [ownUserId];

  const ratings = allowedIds.length > 0
    ? await prisma.visitRating.findMany({
        where: {
          visit: { venueId: { in: allowedIds } },
          userId: { in: userIdsToFetch },
        },
        select: {
          userId: true,
          dimension: true,
          score: true,
          visit: { select: { venueId: true } },
        },
      })
    : [];

  // Bucket rows by (venueId, userId) → ScoreByDimension. The
  // VisitRating unique constraint (visitId, userId, dimension) caps
  // each (venue, user, dim) at one row — same-venue multi-visit
  // collisions would be the only way to double-up, and the last
  // write wins, matching getCoupleRatings' behaviour.
  const buckets: Record<
    string,
    { own: ScoreByDimension; partner: ScoreByDimension }
  > = {};
  for (const id of allowedIds) buckets[id] = { own: {}, partner: {} };
  for (const r of ratings) {
    const bucket = buckets[r.visit.venueId];
    if (!bucket) continue;
    const target =
      r.userId === ownUserId
        ? bucket.own
        : r.userId === partnerUserId
          ? bucket.partner
          : null;
    if (target) target[r.dimension as Tier1Dimension] = Number(r.score);
  }

  const scoresByAllowedId = computeCoupleVenueScoresBulk(
    allowedIds.map((id) => ({
      venueId: id,
      ownRatings: buckets[id].own,
      partnerRatings: buckets[id].partner,
    })),
  );

  // Re-key against the *original* venueIds so unauthorized / unknown
  // ids land as null and the caller can index every requested id.
  const out: Record<string, CoupleVenueScore | null> = {};
  for (const id of venueIds) out[id] = scoresByAllowedId[id] ?? null;
  return out;
}


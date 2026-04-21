"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { computeVenueSimilarity, type VenueSimilarityShape } from "@/lib/similarity";

/**
 * Shape returned for each similar venue. Fits the compact card used in
 * `SimilarVenues` — photo, name, cost chip — without dragging in the
 * full scores/ratings pipeline that the explore feed needs.
 */
export type SimilarVenue = {
  id: string;
  name: string;
  location: string | null;
  photoUrls: string[];
  costMin: number | null;
  costMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  /** Raw similarity score — kept for debugging; UI ignores it today. */
  similarity: number;
};

/**
 * Return up to `limit` venues from the same project that are most
 * similar to the given reference venue. Excludes the venue itself and
 * any candidate whose similarity score is exactly 0 (no signal).
 *
 * Scoped to the caller's project to avoid leaking other couples' data
 * — same-project is also the only sensible scope, since the couple's
 * other candidates are what they're comparing against.
 */
export async function getSimilarVenues(
  venueId: string,
  limit: number = 5,
): Promise<SimilarVenue[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Pull the reference venue only if it belongs to the caller's project.
  // This doubles as the authorization check — no additional gate needed.
  const reference = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: {
      id: true,
      ceremonyStyles: true,
      vibeTags: true,
      location: true,
      costMin: true,
      costMax: true,
      capacityMin: true,
      capacityMax: true,
    },
  });

  if (!reference) return [];

  // Candidate pool = everything else in the project. We deliberately
  // don't filter by status — researching / shortlisted / visited are
  // all valid "similar" suggestions. Exclude `rejected` so venues the
  // couple already dismissed don't resurface as suggestions.
  const candidates = await prisma.venue.findMany({
    where: {
      projectId,
      id: { not: venueId },
      status: { not: "rejected" },
    },
    select: {
      id: true,
      name: true,
      location: true,
      photoUrls: true,
      costMin: true,
      costMax: true,
      capacityMin: true,
      capacityMax: true,
      ceremonyStyles: true,
      vibeTags: true,
    },
  });

  const referenceShape: VenueSimilarityShape = {
    id: reference.id,
    ceremonyStyles: reference.ceremonyStyles,
    vibeTags: reference.vibeTags,
    location: reference.location,
    costMin: reference.costMin,
    costMax: reference.costMax,
    capacityMin: reference.capacityMin,
    capacityMax: reference.capacityMax,
  };

  const scored = candidates
    .map((c) => {
      const score = computeVenueSimilarity(referenceShape, {
        id: c.id,
        ceremonyStyles: c.ceremonyStyles,
        vibeTags: c.vibeTags,
        location: c.location,
        costMin: c.costMin,
        costMax: c.costMax,
        capacityMin: c.capacityMin,
        capacityMax: c.capacityMax,
      });
      return { candidate: c, score };
    })
    // Exclude zero-signal candidates. A venue with no overlap at all
    // isn't "similar" — it's just another venue — and surfacing it
    // dilutes the value of this section.
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 10)));

  return scored.map(({ candidate, score }) => ({
    id: candidate.id,
    name: candidate.name,
    location: candidate.location,
    photoUrls: candidate.photoUrls,
    costMin: candidate.costMin,
    costMax: candidate.costMax,
    capacityMin: candidate.capacityMin,
    capacityMax: candidate.capacityMax,
    ceremonyStyles: candidate.ceremonyStyles,
    similarity: score,
  }));
}

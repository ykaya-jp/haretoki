"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { cacheTag } from "next/cache";
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";

export async function toggleFavorite(venueId: string): Promise<{ isFavorite: boolean }> {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  // Resolve projectId for tag invalidation
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.venueFavorite.findUnique({
    where: { venueId_userId: { venueId, userId: user.id } },
  });

  if (existing) {
    await prisma.venueFavorite.delete({
      where: { id: existing.id },
    });
    revalidateTag(`project:${projectId}`, { expire: 0 });
    revalidatePath("/explore");
    revalidatePath("/candidates");
    revalidatePath("/home");
    return { isFavorite: false };
  }

  await prisma.venueFavorite.create({
    data: { venueId, userId: user.id },
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/candidates");
  revalidatePath("/home");
  return { isFavorite: true };
}

type FavoriteFilter = "mine" | "partner" | "both";

interface FavoriteVenue {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    ceremonyStyles: string[];
    dressBringIn: string | null;
    scores: Array<{ dimension: string; score: number; source: string }>;
  };
  favoritedBy: string[];
}

/** Cached inner loader. Keyed on (projectId, userId, filter). */
async function fetchFavorites(
  projectId: string,
  userId: string,
  filter: FavoriteFilter,
): Promise<FavoriteVenue[]> {
  "use cache";
  cacheTag(`project:${projectId}`);

  // Get all project members
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);
  const partnerId = memberIds.find((id) => id !== userId);

  let userFilter: string[];
  switch (filter) {
    case "mine":
      userFilter = [userId];
      break;
    case "partner":
      userFilter = partnerId ? [partnerId] : [];
      break;
    case "both":
      userFilter = memberIds;
      break;
  }

  if (userFilter.length === 0) return [];

  // Get favorites with venue data
  const favorites = await prisma.venueFavorite.findMany({
    where: { userId: { in: userFilter }, venue: { projectId } },
    include: {
      venue: {
        include: {
          // Include all sources so computeCompositeScore can weight them
          scores: {
            select: { dimension: true, score: true, source: true },
          },
        },
      },
    },
  });

  // Group by venue
  const venueMap = new Map<string, FavoriteVenue>();
  for (const fav of favorites) {
    const existing = venueMap.get(fav.venueId);
    if (existing) {
      existing.favoritedBy.push(fav.userId);
    } else {
      venueMap.set(fav.venueId, {
        venue: {
          id: fav.venue.id,
          name: fav.venue.name,
          location: fav.venue.location,
          photoUrls: fav.venue.photoUrls,
          status: fav.venue.status,
          ceremonyStyles: fav.venue.ceremonyStyles ?? [],
          dressBringIn: fav.venue.dressBringIn ?? null,
          scores: fav.venue.scores.map((s) => ({
            dimension: s.dimension,
            score: Number(s.score),
            source: s.source,
          })),
        },
        favoritedBy: [fav.userId],
      });
    }
  }

  // For "both" filter, only include venues favorited by ALL members
  if (filter === "both" && memberIds.length > 1) {
    for (const [venueId, data] of venueMap) {
      if (data.favoritedBy.length < memberIds.length) {
        venueMap.delete(venueId);
      }
    }
  }

  return Array.from(venueMap.values());
}

export async function getFavorites(filter: FavoriteFilter = "mine"): Promise<FavoriteVenue[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchFavorites(projectId, user.id, filter);
}

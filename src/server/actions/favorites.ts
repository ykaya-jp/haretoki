"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

export async function toggleFavorite(venueId: string): Promise<{ isFavorite: boolean }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const existing = await prisma.venueFavorite.findUnique({
    where: { venueId_userId: { venueId, userId: user.id } },
  });

  if (existing) {
    await prisma.venueFavorite.delete({
      where: { id: existing.id },
    });
    revalidatePath("/explore");
    revalidatePath("/candidates");
    revalidatePath("/home");
    return { isFavorite: false };
  }

  await prisma.venueFavorite.create({
    data: { venueId, userId: user.id },
  });

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
    scores: Array<{ dimension: string; score: number; source: string }>;
  };
  favoritedBy: string[];
}

export async function getFavorites(filter: FavoriteFilter = "mine"): Promise<FavoriteVenue[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get all project members
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: { userId: true },
  });

  const memberIds = members.map((m) => m.userId);
  const partnerId = memberIds.find((id) => id !== user.id);

  let userFilter: string[];
  switch (filter) {
    case "mine":
      userFilter = [user.id];
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
          scores: {
            where: { source: "user_rating" },
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

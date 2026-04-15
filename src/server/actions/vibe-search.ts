"use server";

import { prisma } from "@/server/db";
import { cacheTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import type { VibeTag } from "@/lib/vibe-tags";
import type { Venue, VenueScore, Estimate } from "@/generated/prisma/client";

type VenueWithRelations = Venue & {
  scores: VenueScore[];
  estimates?: (Estimate & { items: unknown[] })[];
};

/** Filter venues in project whose vibeTags overlap with the given tags (OR match). */
export async function filterVenuesByVibe(
  tags: VibeTag[],
): Promise<VenueWithRelations[]> {
  "use cache";
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  cacheTag(`project:${projectId}:vibe`);

  if (tags.length === 0) {
    return [];
  }

  const venues = await prisma.venue.findMany({
    where: {
      projectId,
      vibeTags: { hasSome: tags as string[] },
    },
    include: {
      scores: true,
      estimates: {
        include: { items: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return venues as VenueWithRelations[];
}

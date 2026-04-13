"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

export async function getVenuePlans(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.venuePlan.findMany({
    where: { venueId, venue: { projectId } },
    orderBy: { createdAt: "desc" },
  });
}

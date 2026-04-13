"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import {
  requireUser,
  requireProjectMembership,
  requireOwner,
} from "@/server/auth";

const decisionSchema = z.object({
  selectedVenueId: z.string().uuid("式場を選択してください"),
  rationale: z.string().optional(),
});

export async function makeDecision(input: z.input<typeof decisionSchema>) {
  const validation = decisionSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  await prisma.venue.update({
    where: { id: validation.data.selectedVenueId },
    data: { status: "selected" },
  });

  const decision = await prisma.decision.upsert({
    where: { projectId },
    update: {
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
    create: {
      projectId,
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
  });

  revalidatePath("/candidates");
  revalidatePath("/");
  revalidatePath("/explore");
  return { decision };
}

export async function getDecision() {
  const user = await requireUser();
  const membership = await requireProjectMembership(user.id);

  return prisma.decision.findUnique({
    where: { projectId: membership.projectId },
    include: { venue: true },
  });
}

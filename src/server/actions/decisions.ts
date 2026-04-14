"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  requireUser,
  requireProjectMembership,
  requireOwner,
  requireVenueAccess,
} from "@/server/auth";
import { captureServerEvent } from "@/lib/analytics/server";
import { captureError } from "@/lib/sentry";

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
  await requireVenueAccess(user.id, validation.data.selectedVenueId);

  let decision;
  try {
    await prisma.venue.update({
      where: { id: validation.data.selectedVenueId, projectId },
      data: { status: "selected" },
    });

    decision = await prisma.decision.upsert({
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
  } catch (err) {
    // Report-and-rethrow: the route's error boundary still shows the ceremony
    // failure screen, but Sentry gets the structured context (no PII here —
    // just venue + project IDs).
    captureError(err, {
      action: "makeDecision",
      projectId,
      selectedVenueId: validation.data.selectedVenueId,
    });
    throw err;
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/candidates");
  revalidatePath("/home");
  revalidatePath("/explore");

  await captureServerEvent(user.id, "decision_made", {
    projectId,
    venueId: validation.data.selectedVenueId,
    hasRationale: Boolean(validation.data.rationale),
  });

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

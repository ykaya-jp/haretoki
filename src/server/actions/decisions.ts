"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  requireUser,
  requireProjectMembership,
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
  // Both owner and partner can decide: 結婚式場選びはふたりで決めるものが
  // 大前提なので、owner-only だと partner が決定ボタンを押せず体験が壊れる。
  // Audit L0: makeDecision/cancelDecision は project membership のみで認可。
  // 片方が誤タップしたら互いにキャンセルできるので最悪ケースも recoverable。
  const { projectId } = await requireProjectMembership(user.id);
  await requireVenueAccess(user.id, validation.data.selectedVenueId);

  let decision;
  try {
    decision = await prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: validation.data.selectedVenueId, projectId },
        data: { status: "selected" },
      });

      return tx.decision.upsert({
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

/**
 * Cancel an existing decision — deletes the Decision row and reverts the
 * venue's status from `selected` back to `shortlisted` so it still appears
 * in the candidate list. Only the project owner can cancel.
 */
export async function cancelDecision() {
  const user = await requireUser();
  // Same "ふたりで決める" rule as makeDecision — either member can cancel.
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.decision.findUnique({
    where: { projectId },
    select: { selectedVenueId: true },
  });
  if (!existing) return { cancelled: false as const };

  try {
    await prisma.$transaction([
      prisma.decision.delete({ where: { projectId } }),
      prisma.venue.update({
        where: { id: existing.selectedVenueId },
        data: { status: "shortlisted" },
      }),
    ]);
  } catch (err) {
    captureError(err, {
      action: "cancelDecision",
      projectId,
      venueId: existing.selectedVenueId,
    });
    throw err;
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/candidates");
  revalidatePath("/home");
  revalidatePath("/explore");

  await captureServerEvent(user.id, "decision_cancelled", {
    projectId,
    venueId: existing.selectedVenueId,
  });

  return { cancelled: true as const };
}

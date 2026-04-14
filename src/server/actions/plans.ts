"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireVenueAccess } from "@/server/auth";
import { planInputSchema, type PlanInput } from "@/server/actions/plan-schema";

export async function getVenuePlans(venueId: string) {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  return prisma.venuePlan.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create or update a VenuePlan in a single Server Action.
 *
 * - If `input.id` is supplied AND belongs to a plan under `venueId`, updates it.
 * - Otherwise creates a new plan attached to `venueId`.
 *
 * Always re-checks venue ownership via the project membership chain.
 */
export async function upsertVenuePlan(
  venueId: string,
  input: PlanInput,
) {
  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId);

  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const writeData = {
    name: data.name,
    basePrice: data.basePrice ?? null,
    guestCountMin: data.guestCountMin ?? null,
    guestCountMax: data.guestCountMax ?? null,
    includedItems: data.includedItems,
    excludedItems: data.excludedItems,
    bringInItems: data.bringInItems,
    dressBrideCount: data.dressBrideCount ?? null,
    dressGroomCount: data.dressGroomCount ?? null,
    dressBudgetCapYen: data.dressBudgetCapYen ?? null,
    dressAllowanceNote: data.dressAllowanceNote ?? null,
    campaigns: data.campaigns,
    notes: data.notes ?? null,
  };

  let plan;
  if (data.id) {
    // Verify the plan actually belongs to this venue before updating —
    // protects against a hand-crafted id pointing at someone else's plan.
    const existing = await prisma.venuePlan.findUnique({
      where: { id: data.id },
      select: { venueId: true },
    });
    if (!existing || existing.venueId !== venueId) {
      return { success: false as const, error: { id: ["プランが見つかりません"] } };
    }
    plan = await prisma.venuePlan.update({
      where: { id: data.id },
      data: writeData,
    });
  } else {
    plan = await prisma.venuePlan.create({
      data: { ...writeData, venueId },
    });
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath(`/venues/${venueId}`);
  return { success: true as const, plan };
}

export async function deleteVenuePlan(planId: string) {
  const user = await requireUser();

  const plan = await prisma.venuePlan.findUnique({
    where: { id: planId },
    include: { venue: { select: { projectId: true, id: true } } },
  });
  if (!plan) return { success: false as const };

  await requireVenueAccess(user.id, plan.venue.id);

  await prisma.venuePlan.delete({ where: { id: planId } });
  revalidateTag(`project:${plan.venue.projectId}`, { expire: 0 });
  revalidatePath(`/venues/${plan.venue.id}`);
  return { success: true as const };
}

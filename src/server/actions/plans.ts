"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireVenueAccess } from "@/server/auth";

export async function getVenuePlans(venueId: string) {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  return prisma.venuePlan.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
  });
}

const planSchema = z.object({
  name: z.string().min(1, "プラン名を入力してください"),
  basePrice: z.coerce.number().int().nonnegative().optional(),
  guestCountMin: z.coerce.number().int().nonnegative().optional(),
  guestCountMax: z.coerce.number().int().nonnegative().optional(),
  includedItems: z.array(z.string()).default([]),
  excludedItems: z.array(z.string()).default([]),
  bringInItems: z.array(z.object({
    item: z.string(),
    fee: z.coerce.number().int().nonnegative().optional(),
  })).default([]),
  dressAllowance: z.string().optional(),
  campaigns: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export async function createVenuePlan(
  venueId: string,
  input: z.input<typeof planSchema>,
) {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const plan = await prisma.venuePlan.create({
    data: {
      venueId,
      name: parsed.data.name,
      basePrice: parsed.data.basePrice ?? null,
      guestCountMin: parsed.data.guestCountMin ?? null,
      guestCountMax: parsed.data.guestCountMax ?? null,
      includedItems: parsed.data.includedItems,
      excludedItems: parsed.data.excludedItems,
      bringInItems: parsed.data.bringInItems,
      dressAllowance: parsed.data.dressAllowance ?? null,
      campaigns: parsed.data.campaigns,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath(`/venues/${venueId}`);
  return { success: true as const, plan };
}

export async function deleteVenuePlan(planId: string) {
  const user = await requireUser();

  const plan = await prisma.venuePlan.findUnique({
    where: { id: planId },
    include: { venue: { select: { projectId: true, id: true } } },
  });
  if (!plan) return { success: false };

  await requireVenueAccess(user.id, plan.venue.id);

  await prisma.venuePlan.delete({ where: { id: planId } });
  revalidatePath(`/venues/${plan.venue.id}`);
  return { success: true };
}

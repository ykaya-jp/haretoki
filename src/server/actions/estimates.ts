"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { revalidatePath } from "next/cache";

const estimateSchema = z.object({
  venueId: z.string().uuid(),
  total: z.coerce.number().int().positive("総額は1以上で入力してください"),
  items: z
    .array(
      z.object({
        category: z.enum([
          "attire",
          "cuisine",
          "photo_video",
          "flowers",
          "performance",
          "av_equipment",
          "venue_fee",
          "other",
        ]),
        itemName: z.string().min(1),
        amount: z.coerce.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export async function createEstimate(input: z.input<typeof estimateSchema>) {
  const validation = estimateSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get current version count
  const count = await prisma.estimate.count({
    where: { venueId: validation.data.venueId },
  });

  const estimate = await prisma.estimate.create({
    data: {
      venueId: validation.data.venueId,
      projectId,
      version: count + 1,
      total: validation.data.total,
      sourceType: "manual",
      items: validation.data.items
        ? {
            create: validation.data.items.map((item) => ({
              category: item.category,
              itemName: item.itemName,
              amount: item.amount,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  revalidatePath(`/venues/${validation.data.venueId}`);
  revalidatePath("/compare");
  return { estimate };
}

export async function getEstimatesForVenue(venueId: string) {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  return prisma.estimate.findMany({
    where: { venueId },
    include: { items: true },
    orderBy: { version: "desc" },
  });
}

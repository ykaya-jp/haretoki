"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";

const reactionSchema = z.object({
  venueId: z.string().uuid(),
  reaction: z.enum(["like", "maybe", "pass"]),
  visitorToken: z.string().min(1),
});

export async function submitPartnerReaction(
  venueId: string,
  reaction: "like" | "maybe" | "pass",
  visitorToken: string
): Promise<{ success: boolean }> {
  const parsed = reactionSchema.safeParse({ venueId, reaction, visitorToken });
  if (!parsed.success) {
    return { success: false };
  }

  const venue = await prisma.venue.findUnique({
    where: { id: parsed.data.venueId },
    select: { projectId: true },
  });
  if (!venue) return { success: false };

  await prisma.partnerReaction.upsert({
    where: {
      venueId_visitorToken: {
        venueId: parsed.data.venueId,
        visitorToken: parsed.data.visitorToken,
      },
    },
    update: { reaction: parsed.data.reaction },
    create: {
      venueId: parsed.data.venueId,
      projectId: venue.projectId,
      visitorToken: parsed.data.visitorToken,
      reaction: parsed.data.reaction,
    },
  });

  revalidatePath("/");
  revalidatePath("/candidates");
  return { success: true };
}

"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireVenueAccess } from "@/server/auth";
import { VIBE_TAGS } from "@/lib/vibe-tags";

const VALID_TAG_IDS = VIBE_TAGS.map((t) => t.id) as [string, ...string[]];

const updateVibeTagsSchema = z.object({
  venueId: z.string().min(1),
  tags: z.array(z.enum(VALID_TAG_IDS)).max(10),
});

export async function updateVenueVibeTags(venueId: string, tags: string[]) {
  const parsed = updateVibeTagsSchema.safeParse({ venueId, tags });
  if (!parsed.success) {
    return { success: false as const, error: "タグの値が正しくありません" };
  }

  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId);

  await prisma.venue.update({
    where: { id: venueId },
    data: { vibeTags: parsed.data.tags },
  });

  revalidatePath(`/venues/${venueId}`);
  revalidateTag(`project:${projectId}`, { expire: 0 });

  return { success: true as const };
}

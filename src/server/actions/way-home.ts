"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

/**
 * E-3 帰り道モード: Visit 完了直後の 3 分入力を 1 回の Server Action で保存。
 * - mood: 1-5 → VisitRating(dimension='way_home_mood')
 * - goodTags / concernTags → VisitNote tags[]
 * - goodNote / concernNote → VisitNote content
 *
 * Photos は既存 addNoteMedia で撮影済み前提。本アクションは軽量入力のみ。
 */
const WayHomeSchema = z.object({
  mood: z.number().int().min(1).max(5),
  goodTags: z.array(z.string().max(40)).max(6).default([]),
  goodNote: z.string().max(1000).optional(),
  concernTags: z.array(z.string().max(40)).max(6).default([]),
  concernNote: z.string().max(1000).optional(),
});

type WayHomeInput = z.infer<typeof WayHomeSchema>;

export async function submitWayHome(
  visitId: string,
  raw: unknown,
): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const parsed = WayHomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "入力内容が正しくありません" };
  }
  const input: WayHomeInput = parsed.data;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // IDOR guard: visit must belong to a venue in the user's project.
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, venue: { projectId } },
    select: { id: true, venueId: true },
  });
  if (!visit) return { ok: false, error: "見学が見つかりません" };

  // Convert 1-5 mood (5 = 晴れやか) to Decimal(2,1) in DB
  const moodScore = input.mood;

  try {
    await prisma.$transaction([
      // VisitRating upsert (unique on visit+user+dimension)
      prisma.visitRating.upsert({
        where: {
          visitId_userId_dimension: {
            visitId,
            userId: user.id,
            dimension: "way_home_mood",
          },
        },
        create: {
          visitId,
          userId: user.id,
          dimension: "way_home_mood",
          score: moodScore,
        },
        update: { score: moodScore },
      }),

      // Good note
      ...(input.goodTags.length > 0 || (input.goodNote ?? "").trim().length > 0
        ? [
            prisma.visitNote.create({
              data: {
                visitId,
                userId: user.id,
                content: input.goodNote?.trim() ?? "",
                // legacy by:<uuid> tag kept for historical compatibility
                tags: ["way_home_good", `by:${user.id}`, ...input.goodTags],
              },
            }),
          ]
        : []),

      // Concern note
      ...(input.concernTags.length > 0 ||
      (input.concernNote ?? "").trim().length > 0
        ? [
            prisma.visitNote.create({
              data: {
                visitId,
                userId: user.id,
                content: input.concernNote?.trim() ?? "",
                // legacy by:<uuid> tag kept for historical compatibility
                tags: ["way_home_concern", `by:${user.id}`, ...input.concernTags],
              },
            }),
          ]
        : []),
    ]);

    revalidateTag(`venue:${visit.venueId}`, { expire: 0 });
    revalidatePath(`/venues/${visit.venueId}`);
    revalidatePath("/candidates");
    return { ok: true };
  } catch {
    return { ok: false, error: "うまく残せませんでした" };
  }
}

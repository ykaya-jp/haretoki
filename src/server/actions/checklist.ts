"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag, cacheTag } from "next/cache";
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";
import { CHECKLIST_PRESETS, getPresetById } from "@/lib/checklist-presets";

// ── Zod schemas ────────────────────────────────────────────────────────────────

const saveAnswerSchema = z.object({
  status: z.enum(["yes", "no", "unknown"]).nullable().optional(),
  memo: z.string().max(2000).nullable().optional(),
  numberValue: z.number().nullable().optional(),
  photoUrls: z.array(z.string().url()).optional(),
});

// ── Cache tag helpers ──────────────────────────────────────────────────────────

function checklistTag(projectId: string) {
  return `checklist:${projectId}`;
}

function answerTag(venueId: string) {
  return `checklist-answers:${venueId}`;
}

// ── List active item ids for the current project ───────────────────────────────

export async function listActiveItems(): Promise<{ projectId: string; activeItemIds: string[] }> {
  "use cache";
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  cacheTag(checklistTag(projectId));

  const rows = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { itemId: true },
    orderBy: { createdAt: "asc" },
  });

  return { projectId, activeItemIds: rows.map((r) => r.itemId) };
}

// ── Toggle a single item on/off ────────────────────────────────────────────────

export async function toggleItem(
  itemId: string,
  active: boolean
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Validate itemId exists in presets
  if (!getPresetById(itemId)) {
    return { success: false };
  }

  if (active) {
    await prisma.projectChecklist.upsert({
      where: { projectId_itemId: { projectId, itemId } },
      create: { projectId, itemId },
      update: {},
    });
  } else {
    await prisma.projectChecklist.deleteMany({
      where: { projectId, itemId },
    });
  }

  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath("/checklist");
  return { success: true };
}

// ── Bulk toggle (enable/disable all items in a category) ──────────────────────

export async function bulkToggleCategory(
  category: string,
  active: boolean
): Promise<{ success: boolean; count: number }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const items = CHECKLIST_PRESETS.filter((p) => p.category === category);
  if (items.length === 0) return { success: false, count: 0 };

  if (active) {
    await prisma.projectChecklist.createMany({
      data: items.map((p) => ({ projectId, itemId: p.id })),
      skipDuplicates: true,
    });
  } else {
    await prisma.projectChecklist.deleteMany({
      where: { projectId, itemId: { in: items.map((p) => p.id) } },
    });
  }

  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath("/checklist");
  return { success: true, count: items.length };
}

// ── Get answers for a single venue ────────────────────────────────────────────

export async function getAnswersForVenue(
  venueId: string
): Promise<Record<string, { status: string | null; memo: string | null; numberValue: number | null; photoUrls: string[] }>> {
  "use cache";
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  cacheTag(answerTag(venueId));
  cacheTag(checklistTag(projectId));

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({ where: { id: venueId, projectId } });
  if (!venue) return {};

  const answers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId,
      projectChecklist: { projectId },
    },
    include: { projectChecklist: { select: { itemId: true } } },
  });

  const result: Record<string, { status: string | null; memo: string | null; numberValue: number | null; photoUrls: string[] }> = {};
  for (const ans of answers) {
    result[ans.projectChecklist.itemId] = {
      status: ans.status,
      memo: ans.memo,
      numberValue: ans.numberValue ? Number(ans.numberValue) : null,
      photoUrls: ans.photoUrls,
    };
  }
  return result;
}

// ── Save (upsert) an answer ────────────────────────────────────────────────────

export async function saveAnswer(
  venueId: string,
  itemId: string,
  patch: z.infer<typeof saveAnswerSchema>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId).then(({ projectId }) => ({ projectId }));

  const parsed = saveAnswerSchema.safeParse(patch);
  if (!parsed.success) {
    return { success: false, error: "入力内容を確認してください" };
  }

  // Ensure item is active for this project (auto-activate if missing)
  const row = await prisma.projectChecklist.upsert({
    where: { projectId_itemId: { projectId, itemId } },
    create: { projectId, itemId },
    update: {},
  });

  const data = parsed.data;
  await prisma.venueChecklistAnswer.upsert({
    where: { projectChecklistId_venueId: { projectChecklistId: row.id, venueId } },
    create: {
      projectChecklistId: row.id,
      venueId,
      status: data.status ?? null,
      memo: data.memo ?? null,
      numberValue: data.numberValue ?? null,
      photoUrls: data.photoUrls ?? [],
    },
    update: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.memo !== undefined && { memo: data.memo }),
      ...(data.numberValue !== undefined && { numberValue: data.numberValue }),
      ...(data.photoUrls !== undefined && { photoUrls: data.photoUrls }),
    },
  });

  revalidateTag(answerTag(venueId), { expire: 0 });
  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath(`/venues/${venueId}/checklist`);
  revalidatePath("/compare");
  return { success: true };
}

// ── Comparison matrix data ─────────────────────────────────────────────────────

export interface ComparisonVenue {
  id: string;
  name: string;
  photoUrls: string[];
  scores: Array<{ dimension: string; score: number; source: string }>;
}

export interface ComparisonAnswer {
  status: string | null;
  memo: string | null;
  numberValue: number | null;
  photoUrls: string[];
}

export interface ComparisonMatrix {
  venues: ComparisonVenue[];
  items: Array<{ id: string; category: string; subcategory?: string; question: string; type: string }>;
  answers: Record<string, Record<string, ComparisonAnswer>>; // [itemId][venueId] = answer
}

export async function getComparisonMatrix(venueIds: string[]): Promise<ComparisonMatrix> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Clamp to max 5 venues
  const ids = venueIds.slice(0, 5);

  // Verify all venues belong to project
  const venues = await prisma.venue.findMany({
    where: { id: { in: ids }, projectId },
    select: {
      id: true,
      name: true,
      photoUrls: true,
      scores: { select: { dimension: true, score: true, source: true } },
    },
  });

  // Restore requested order and convert Decimal to number
  const orderedVenues: ComparisonVenue[] = ids
    .map((id) => venues.find((v) => v.id === id))
    .filter((v) => v != null)
    .map((v) => ({
      id: v.id,
      name: v.name,
      photoUrls: v.photoUrls,
      scores: v.scores.map((s) => ({
        dimension: s.dimension as string,
        source: s.source as string,
        score: Number(s.score),
      })),
    }));

  // Active items for this project
  const activeRows = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { id: true, itemId: true },
    orderBy: { createdAt: "asc" },
  });

  const activeItems = activeRows
    .map((r) => {
      const preset = CHECKLIST_PRESETS.find((p) => p.id === r.itemId);
      return preset ? { ...preset, checklistRowId: r.id } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Answers for those venues
  const answerRows = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId: { in: ids },
      projectChecklistId: { in: activeRows.map((r) => r.id) },
    },
    include: { projectChecklist: { select: { itemId: true } } },
  });

  const answers: Record<string, Record<string, ComparisonAnswer>> = {};
  for (const ans of answerRows) {
    const itemId = ans.projectChecklist.itemId;
    if (!answers[itemId]) answers[itemId] = {};
    answers[itemId][ans.venueId] = {
      status: ans.status,
      memo: ans.memo,
      numberValue: ans.numberValue ? Number(ans.numberValue) : null,
      photoUrls: ans.photoUrls,
    };
  }

  return {
    venues: orderedVenues,
    items: activeItems.map(({ id, category, subcategory, question, type }) => ({
      id,
      category,
      subcategory,
      question,
      type,
    })),
    answers,
  };
}

// ── Get favorites venue ids for compare default ────────────────────────────────

export async function getFavoriteVenueIds(): Promise<string[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const favorites = await prisma.venueFavorite.findMany({
    where: { userId: user.id, venue: { projectId } },
    select: { venueId: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return favorites.map((f) => f.venueId);
}

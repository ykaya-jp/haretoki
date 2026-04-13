"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership, requireVisitAccess } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry } from "@/lib/anthropic";

const scheduleVisitSchema = z.object({
  scheduledAt: z.coerce.date(),
  title: z.string().max(100).optional(),
  memo: z.string().max(500).optional(),
});

export async function scheduleVisit(
  venueId: string,
  input: z.infer<typeof scheduleVisitSchema>
): Promise<{ success: boolean; visitId?: string; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({ where: { id: venueId, projectId } });
  if (!venue) return { success: false, error: "式場が見つかりません" };

  const parsed = scheduleVisitSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "無効な入力です" };

  const visit = await prisma.visit.create({
    data: {
      venueId,
      scheduledAt: parsed.data.scheduledAt,
      title: parsed.data.title ?? `${venue.name} 見学`,
      memo: parsed.data.memo,
      status: "scheduled",
    },
  });

  await prisma.venue.update({
    where: { id: venueId },
    data: { status: "visit_scheduled" },
  });

  // Trigger async AI checklist generation
  generateVisitChecklist(visit.id).catch(console.error);

  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/home");
  revalidatePath("/explore");
  return { success: true, visitId: visit.id };
}

export async function completeVisit(visitId: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  await requireVisitAccess(user.id, visitId);

  const visit = await prisma.visit.update({
    where: { id: visitId },
    data: { status: "completed", completedAt: new Date() },
    include: { venue: true },
  });

  await prisma.venue.update({
    where: { id: visit.venueId },
    data: { status: "visited" },
  });

  revalidatePath(`/venues/${visit.venueId}`);
  revalidatePath("/home");
  return { success: true };
}

const visitNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  tags: z.array(z.string()).max(10).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
});

export async function addVisitNote(
  visitId: string,
  input: z.infer<typeof visitNoteSchema>
): Promise<{ success: boolean; noteId?: string }> {
  const user = await requireUser();
  await requireVisitAccess(user.id, visitId);

  const parsed = visitNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false };

  const note = await prisma.visitNote.create({
    data: {
      visitId,
      content: parsed.data.content,
      tags: parsed.data.tags ?? [],
      locationLat: parsed.data.locationLat,
      locationLng: parsed.data.locationLng,
    },
  });

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { venueId: true },
  });
  revalidatePath(`/venues/${visit?.venueId}`);
  return { success: true, noteId: note.id };
}

export async function addNoteMedia(
  noteId: string,
  mediaUrl: string,
  type: string = "photo"
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const note = await prisma.visitNote.findUnique({
    where: { id: noteId },
    include: { visit: { include: { venue: { select: { projectId: true, id: true } } } } },
  });
  if (!note || note.visit.venue.projectId !== projectId) {
    return { success: false };
  }

  // Validate mediaUrl is from our Supabase storage
  if (!mediaUrl.includes("supabase.co/storage")) {
    return { success: false };
  }

  await prisma.visitNoteMedia.create({
    data: { visitNoteId: noteId, type, mediaUrl },
  });

  revalidatePath(`/venues/${note.visit.venue.id}`);
  return { success: true };
}

export async function toggleChecklistItem(
  itemId: string
): Promise<{ success: boolean; checked: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const item = await prisma.visitChecklistItem.findUnique({
    where: { id: itemId },
    include: { visit: { include: { venue: { select: { projectId: true, id: true } } } } },
  });
  if (!item || item.visit.venue.projectId !== projectId) return { success: false, checked: false };

  const newChecked = !item.checked;
  await prisma.visitChecklistItem.update({
    where: { id: itemId },
    data: { checked: newChecked, checkedAt: newChecked ? new Date() : null },
  });

  revalidatePath(`/venues/${item.visit.venueId}`);
  return { success: true, checked: newChecked };
}

export async function generateVisitChecklist(visitId: string): Promise<void> {
  if (!isClaudeAvailable()) return;

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      venue: {
        include: {
          reviews: { where: { aiSummary: { not: null } }, select: { aiSummary: true } },
          project: { select: { conditions: true } },
        },
      },
    },
  });
  if (!visit) return;

  const reviewContext = visit.venue.reviews.map(r => r.aiSummary).filter(Boolean).join("\n");
  const conditions = visit.venue.project.conditions
    ? JSON.stringify(visit.venue.project.conditions)
    : "条件未設定";

  try {
    const response = await withRetry(() =>
      askClaude({
        system: `You are a wedding venue visit preparation assistant. Generate exactly 5 practical checklist items for a venue visit. Return ONLY a JSON array of strings, e.g. ["item1", "item2", ...]. Each item should be a specific action or question in Japanese, max 50 chars.`,
        userMessage: `式場: ${visit.venue.name}\nカップルの条件: ${conditions}\n口コミ分析: ${reviewContext || "なし"}\n\n見学で確認すべき5つのポイントを生成してください。`,
        maxTokens: 512,
      })
    );

    let items: string[];
    try {
      items = JSON.parse(response);
      if (!Array.isArray(items)) return;
      items = items.slice(0, 5).map(i => String(i).slice(0, 100));
    } catch {
      return;
    }

    // Delete existing AI-generated items, insert new
    await prisma.visitChecklistItem.deleteMany({ where: { visitId } });
    await prisma.visitChecklistItem.createMany({
      data: items.map((item, idx) => ({
        visitId,
        item,
        category: "ai_generated",
        sortOrder: idx,
      })),
    });

    revalidatePath(`/venues/${visit.venueId}`);
  } catch {
    // Silent failure — checklist is non-critical
  }
}

export async function getVisitsByProject() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venues = await prisma.venue.findMany({
    where: { projectId },
    include: {
      visits: {
        include: { checklist: { select: { checked: true } } },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  return venues.flatMap(venue =>
    venue.visits.map(visit => ({
      id: visit.id,
      venueId: venue.id,
      venueName: venue.name,
      venueLocation: venue.location,
      scheduledAt: visit.scheduledAt,
      status: visit.status,
      completedAt: visit.completedAt,
      title: visit.title,
      checklistProgress: {
        total: visit.checklist.length,
        checked: visit.checklist.filter(c => c.checked).length,
      },
    }))
  );
}

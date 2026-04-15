"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { buildVisitQuestions } from "@/lib/visit-questions";

/**
 * E-8 Question Bank: 見学前の 10+ 問を VisitChecklistItem にインサート。
 * 既に question カテゴリの item がある場合は skip (idempotent)。
 *
 * Categories: 費用 / 契約 / 運用 / 設備 / 料理 / スタッフ / 演出 / 挙式
 * これらは (question) プレフィクスで区別する:
 *   category="question:費用"
 */
export async function ensureVisitQuestions(visitId: string): Promise<{
  added: number;
  existing: number;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [visit, questionCount] = await Promise.all([
    prisma.visit.findFirst({
      where: { id: visitId, venue: { projectId } },
      include: {
        venue: {
          select: {
            ceremonyStyles: true,
            capacityMax: true,
          },
        },
      },
    }),
    prisma.visitChecklistItem.count({
      where: {
        visitId,
        category: { startsWith: "question:" },
      },
    }),
  ]);
  if (!visit) return { added: 0, existing: 0 };
  if (questionCount > 0) return { added: 0, existing: questionCount };

  const seeds = buildVisitQuestions({
    ceremonyStyles: visit.venue.ceremonyStyles,
    capacityMax: visit.venue.capacityMax,
    hasGarden: false,
  });

  await prisma.visitChecklistItem.createMany({
    data: seeds.map((s) => ({
      visitId,
      item: s.item,
      category: `question:${s.category}`,
      status: "unchecked",
      sortOrder: s.sortOrder,
    })),
  });

  revalidatePath(`/visits/${visitId}/prep`);
  return { added: seeds.length, existing: 0 };
}

/**
 * Fetch the question list (sorted, grouped by category prefix stripped).
 */
export async function getVisitQuestions(visitId: string): Promise<{
  visitId: string;
  venueName: string;
  scheduledAt: Date | null;
  questions: Array<{
    id: string;
    item: string;
    category: string;
    status: "unchecked" | "yes" | "no";
    memo: string | null;
    sortOrder: number;
  }>;
} | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const visit = await prisma.visit.findFirst({
    where: { id: visitId, venue: { projectId } },
    include: {
      venue: { select: { name: true } },
      checklist: {
        where: { category: { startsWith: "question:" } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!visit) return null;

  return {
    visitId: visit.id,
    venueName: visit.venue.name,
    scheduledAt: visit.scheduledAt,
    questions: visit.checklist.map((c) => ({
      id: c.id,
      item: c.item,
      category: c.category?.replace(/^question:/, "") ?? "その他",
      status: c.status as "unchecked" | "yes" | "no",
      memo: c.memo,
      sortOrder: c.sortOrder,
    })),
  };
}

/** 質問 row の status トグル (unchecked → yes → unchecked)。 */
export async function toggleVisitQuestion(
  questionId: string,
  status: "unchecked" | "yes" | "no",
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const q = await prisma.visitChecklistItem.findFirst({
    where: { id: questionId, visit: { venue: { projectId } } },
    select: { id: true, visitId: true },
  });
  if (!q) return { ok: false };

  await prisma.visitChecklistItem.update({
    where: { id: q.id },
    data: {
      status,
      checkedAt: status === "unchecked" ? null : new Date(),
    },
  });
  revalidatePath(`/visits/${q.visitId}/prep`);
  return { ok: true };
}

"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

/**
 * Venue-scoped free-text memo. Sibling to VisitNote (visit-bound) —
 * placed above the 見学の記録 section in the venue detail page so couples
 * can jot pre-visit thoughts / post-comparison summaries without having
 * to schedule a visit first.
 *
 * Project-membership scoped: any member can read all memos (owner +
 * partner), but only the author can edit / delete their own memo. Soft-
 * delete to allow undo via 「戻す」 button on the venue page.
 */

const memoContentSchema = z
  .string()
  .min(1, "メモを入力してください")
  .max(2000, "メモは2000文字以内で入力してください");

async function requireVenueAccess(userId: string, venueId: string) {
  const { projectId } = await requireProjectMembership(userId);
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!venue) {
    throw new Error("式場が見つかりません");
  }
  return { projectId, venueId: venue.id };
}

export async function addVenueMemo(
  venueId: string,
  content: string,
): Promise<{ success: boolean; memoId?: string; error?: string }> {
  const user = await requireUser();
  let venueAccess;
  try {
    venueAccess = await requireVenueAccess(user.id, venueId);
  } catch {
    return { success: false, error: "式場が見つかりません" };
  }

  const parsed = memoContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }

  const memo = await prisma.venueMemo.create({
    data: {
      venueId: venueAccess.venueId,
      userId: user.id,
      content: parsed.data,
    },
  });

  revalidatePath(`/venues/${venueId}`);
  return { success: true, memoId: memo.id };
}

export async function updateVenueMemo(
  memoId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const memo = await prisma.venueMemo.findFirst({
    where: {
      id: memoId,
      userId: user.id,
      deletedAt: null,
      venue: { projectId, deletedAt: null },
    },
    select: { id: true, venueId: true },
  });
  if (!memo) {
    return { success: false, error: "メモが見つかりません" };
  }

  const parsed = memoContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }

  await prisma.venueMemo.update({
    where: { id: memoId },
    data: { content: parsed.data },
  });

  revalidatePath(`/venues/${memo.venueId}`);
  return { success: true };
}

export async function deleteVenueMemo(
  memoId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const memo = await prisma.venueMemo.findFirst({
    where: {
      id: memoId,
      userId: user.id,
      deletedAt: null,
      venue: { projectId, deletedAt: null },
    },
    select: { id: true, venueId: true },
  });
  if (!memo) {
    return { success: false, error: "メモが見つかりません" };
  }

  await prisma.venueMemo.update({
    where: { id: memoId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/venues/${memo.venueId}`);
  return { success: true };
}

export interface VenueMemoView {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getVenueMemos(venueId: string): Promise<VenueMemoView[]> {
  const user = await requireUser();
  let venueAccess;
  try {
    venueAccess = await requireVenueAccess(user.id, venueId);
  } catch {
    return [];
  }

  const memos = await prisma.venueMemo.findMany({
    where: {
      venueId: venueAccess.venueId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return memos;
}

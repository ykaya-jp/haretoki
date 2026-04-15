"use server";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { revalidatePath } from "next/cache";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/** List recent notifications for the current user. */
export async function listNotifications(limit = 30): Promise<NotificationRow[]> {
  const user = await requireUser();

  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      read: true,
      readAt: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.read,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Mark a single notification as read. Only the owner can mark their own. */
export async function markNotificationRead(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const user = await requireUser();

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return { ok: false, reason: "not_found" };
  }

  await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
  return { ok: true };
}

/** Mark all unread notifications as read for the current user. */
export async function markAllNotificationsRead(): Promise<{ count: number }> {
  const user = await requireUser();

  const result = await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
  return { count: result.count };
}

/** Get unread notification count for the current user. */
export async function getUnreadCount(): Promise<number> {
  const user = await requireUser();

  return prisma.notification.count({
    where: { userId: user.id, read: false },
  });
}

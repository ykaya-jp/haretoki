"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/server/db";
import { requireUser, requireOwner } from "@/server/auth";
import { revalidatePath } from "next/cache";

const TOKEN_BYTES = 32; // → 64 hex chars
const DEFAULT_EXPIRY_DAYS = 7;

export interface InvitationLink {
  url: string;
  token: string;
  expiresAt: string; // ISO
}

/**
 * Owner: create a one-tap invitation link. 7 日有効、1 回限り。
 * Re-calling replaces any existing (un-consumed) link for the same project
 * to keep things tidy — only one live link at a time.
 */
export async function createInvitationLink(): Promise<InvitationLink> {
  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(
    Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  // Invalidate any prior unconsumed link for this project.
  await prisma.projectInvitation.updateMany({
    where: { projectId, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  await prisma.projectInvitation.create({
    data: {
      projectId,
      token,
      createdBy: user.id,
      expiresAt,
    },
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://haretoki.vercel.app";
  return {
    url: `${base}/invite/${token}`,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Partner tapping /invite/[token]. Consumes the token and joins the project.
 * Safe to call multiple times (idempotent) — already-consumed-by-you returns
 * success; already-consumed-by-somebody-else returns "stale".
 */
export async function consumeInvitationLink(token: string): Promise<
  | { ok: true; projectId: string }
  | { ok: false; reason: "invalid" | "expired" | "stale" | "self" }
> {
  const user = await requireUser();

  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
  });
  if (!invitation) return { ok: false, reason: "invalid" };

  if (invitation.consumedAt && invitation.consumedBy !== user.id) {
    return { ok: false, reason: "stale" };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (invitation.createdBy === user.id) {
    // Owner shouldn't self-consume.
    return { ok: false, reason: "self" };
  }

  // Consume + upsert ProjectMember in a single transaction
  await prisma.$transaction(async (tx) => {
    await tx.projectInvitation.update({
      where: { token },
      data: { consumedAt: new Date(), consumedBy: user.id },
    });
    await tx.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: invitation.projectId,
          userId: user.id,
        },
      },
      create: {
        projectId: invitation.projectId,
        userId: user.id,
        role: "partner",
        acceptedAt: new Date(),
      },
      update: { acceptedAt: new Date() },
    });
  });

  revalidatePath("/home");
  revalidatePath("/mypage");
  return { ok: true, projectId: invitation.projectId };
}

/**
 * Fetch the current live link for the owner's project (if any).
 */
export async function getCurrentInvitationLink(): Promise<InvitationLink | null> {
  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  const invitation = await prisma.projectInvitation.findFirst({
    where: {
      projectId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!invitation) return null;

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://haretoki.vercel.app";
  return {
    url: `${base}/invite/${invitation.token}`,
    token: invitation.token,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

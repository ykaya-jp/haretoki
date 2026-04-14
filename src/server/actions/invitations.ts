"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireOwner, requireProjectMembership } from "@/server/auth";

const inviteSchema = z.object({
  email: z
    .string()
    .email("有効なメールアドレスを入力してください")
    .transform((v) => v.toLowerCase().trim()),
});

/**
 * Invite a partner to the current project.
 * Only the project owner can invite. One partner per project.
 */
export async function invitePartner(email: string) {
  const parsed = inviteSchema.safeParse({ email });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors.email?.[0] ?? "無効なメールアドレスです" };
  }

  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  // Cannot invite yourself
  if (parsed.data.email === user.email?.toLowerCase()) {
    return { success: false as const, error: "ご自身のメールアドレスは指定できません" };
  }

  // Check if partner already exists for this project
  const existingPartner = await prisma.projectMember.findFirst({
    where: { projectId, role: "partner" },
  });

  if (existingPartner) {
    return { success: false as const, error: "パートナーはすでに招待されています" };
  }

  // Find or create the invited user
  let invitedUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!invitedUser) {
    invitedUser = await prisma.user.create({
      data: { email: parsed.data.email },
    });
  }

  // Create the partner membership (acceptedAt = null means pending)
  const membership = await prisma.projectMember.create({
    data: {
      projectId,
      userId: invitedUser.id,
      role: "partner",
      // acceptedAt is null by default — invitation is pending
    },
  });

  revalidatePath("/home");
  return { success: true as const, membershipId: membership.id };
}

/**
 * Accept a pending invitation.
 * The logged-in user's email must match the invited user.
 */
export async function acceptInvitation(invitationId: string) {
  const user = await requireUser();

  const membership = await prisma.projectMember.findUnique({
    where: { id: invitationId },
    include: { user: true },
  });

  if (!membership) {
    return { success: false as const, error: "招待が見つかりません" };
  }

  if (membership.user.email !== user.email?.toLowerCase()) {
    return { success: false as const, error: "この招待はあなた宛ではありません" };
  }

  // Supabase Auth marks user_metadata.email_verified after the confirmation
  // email is clicked. We require that before accepting — this is the gate
  // that prevents someone from creating an account with another person's
  // email and claiming their invitation.
  const emailConfirmed =
    (user.email_confirmed_at ?? null) !== null ||
    user.user_metadata?.email_verified === true;
  if (!emailConfirmed) {
    return {
      success: false as const,
      error: "メールアドレスの確認が必要です。受信メールの確認リンクをタップしてください。",
    };
  }

  if (membership.acceptedAt) {
    return { success: false as const, error: "すでに承諾済みです" };
  }

  // Already-joined guard: if this user already belongs to another project,
  // don't silently move them. They must be re-invited by the owner so the
  // transfer is explicit on both sides.
  const existingMembership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (existingMembership && existingMembership.projectId !== membership.projectId) {
    return {
      success: false as const,
      error:
        "すでに別のプロジェクトに参加しています。パートナーと同じプロジェクトに合流するには、オーナーに再招待を依頼してください。",
    };
  }

  // Atomic conditional update: only flip acceptedAt if it's still null.
  // Prevents a race where two rapid accepts both pass the SELECT-then-UPDATE gate.
  const res = await prisma.projectMember.updateMany({
    where: { id: invitationId, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (res.count !== 1) {
    return { success: false as const, error: "すでに承諾済みか、招待が無効です" };
  }

  revalidatePath("/home");
  return { success: true as const };
}

/**
 * Get current partner status for the logged-in user's project.
 * Returns partner info or null if no partner invited.
 */
export async function getInvitationStatus() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const partner = await prisma.projectMember.findFirst({
    where: { projectId, role: "partner" },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!partner) return null;

  return {
    id: partner.id,
    email: partner.user.email,
    name: partner.user.name,
    accepted: !!partner.acceptedAt,
    invitedAt: partner.invitedAt,
    acceptedAt: partner.acceptedAt,
  };
}

/**
 * Check if the logged-in user has a pending invitation.
 * Used after signup/login to auto-detect and prompt acceptance.
 */
export async function getPendingInvitation() {
  const user = await requireUser();
  if (!user.email) return null;

  // Lowercase match — invitePartner stores emails lowercased, but the auth
  // provider's `user.email` can come back mixed-case depending on signup
  // method. Without this normalization a legitimate invitee could be rejected.
  const normalizedEmail = user.email.toLowerCase();

  const pending = await prisma.projectMember.findFirst({
    where: {
      user: { email: normalizedEmail },
      acceptedAt: null,
      role: "partner",
    },
    include: {
      project: { select: { name: true } },
      user: true,
    },
  });

  if (!pending) return null;

  return {
    id: pending.id,
    projectName: pending.project.name,
    invitedAt: pending.invitedAt,
  };
}

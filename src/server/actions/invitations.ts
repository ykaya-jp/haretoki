"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireOwner, requireProjectMembership } from "@/server/auth";
import { captureServerEvent } from "@/lib/analytics/server";
import { sendEmail, isEmailAvailable } from "@/lib/email/send";
import { renderPartnerInviteEmail } from "@/lib/email/templates/partner-invite";

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

  // Fetch inviter name + project name up front for the email template.
  const [inviterRecord, projectRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    }),
  ]);

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

  // Attempt email delivery. Email infra is optional: if RESEND_API_KEY is
  // unset (or Resend fails), we still return success and let the UI prompt
  // the owner to share the URL manually. Do NOT throw on email failure.
  let emailSent = false;
  if (isEmailAvailable()) {
    const h = await headers();
    const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
    const forwardedProto = h.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : process.env.APP_URL ?? "https://haretoki.vercel.app";
    const inviteUrl = `${origin}/accept-invite`;
    const inviterName =
      inviterRecord?.name ?? inviterRecord?.email?.split("@")[0] ?? "オーナー";
    const projectName = projectRecord?.name ?? "ふたりの式場さがし";
    const { subject, html, text } = renderPartnerInviteEmail({
      inviterName,
      projectName,
      inviteUrl,
    });
    const result = await sendEmail({
      to: parsed.data.email,
      subject,
      html,
      text,
    });
    if (result.success) {
      emailSent = true;
    } else if (result.error !== "EMAIL_NOT_CONFIGURED") {
      // Log real delivery failures; keep silent on not-configured.
      console.error("partner invite email failed:", {
        to: parsed.data.email,
        error: result.error,
      });
    }
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/home");

  await captureServerEvent(user.id, "partner_invited", {
    projectId,
    membershipId: membership.id,
    emailSent,
  });

  return {
    success: true as const,
    membershipId: membership.id,
    emailSent,
  };
}

/**
 * Is the given project a throw-away auto-created project for `userId` that
 * carries no real user data? Safe to silently drop when the user accepts an
 * invitation to join someone else's project.
 *
 * Rules (all must hold):
 *   - `userId` is the sole owner (others may not have joined yet).
 *   - The project has no venues, no estimates, no decisions, no partner
 *     member (accepted or pending).
 */
async function isAutoCreatedEmptyProject(
  projectId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role !== "owner") return false;

  const [memberCount, venueCount, estimateCount, decisionCount] =
    await Promise.all([
      prisma.projectMember.count({ where: { projectId } }),
      prisma.venue.count({ where: { projectId } }),
      prisma.estimate.count({ where: { venue: { projectId } } }),
      prisma.decision.count({ where: { projectId } }),
    ]);

  // A fresh auto-project has exactly one ProjectMember (the owner, this
  // user). Any extra membership means a partner was invited/accepted and we
  // must not silently delete the project.
  const singleOwnerMembership = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true, role: true },
  });
  const isSoleOwner =
    singleOwnerMembership.length === 1 &&
    singleOwnerMembership[0].userId === userId &&
    singleOwnerMembership[0].role === "owner";

  return (
    isSoleOwner &&
    memberCount === 1 &&
    venueCount === 0 &&
    estimateCount === 0 &&
    decisionCount === 0
  );
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

  // Already-joined guard. An existing user who signed up on their own has an
  // auto-created empty project (getOrCreateProject on first /home visit). If
  // that's their only active membership AND the project has no real data,
  // we silently drop it and let them join the inviter's project — otherwise
  // they'd be locked out of every invitation. Projects with actual content
  // (venues, estimates, decisions, partner) are preserved and we return an
  // explanatory error so the transfer is explicit on both sides.
  const existingMemberships = await prisma.projectMember.findMany({
    where: {
      userId: user.id,
      acceptedAt: { not: null },
      NOT: { projectId: membership.projectId },
    },
    select: { id: true, projectId: true, role: true },
  });

  for (const existing of existingMemberships) {
    const canAutoDiscard = await isAutoCreatedEmptyProject(
      existing.projectId,
      user.id,
      existing.role,
    );
    if (!canAutoDiscard) {
      return {
        success: false as const,
        error:
          "すでに別の式場さがしに参加しています。パートナーと同じ場所に合流するには、招待したご本人にもう一度招待をお願いしてください。",
      };
    }
  }

  // All blocking memberships point at discardable auto-projects — remove
  // them. Owner memberships trigger project deletion (cascades to venues
  // etc.), non-owner memberships are just the row.
  for (const existing of existingMemberships) {
    if (existing.role === "owner") {
      await prisma.project.delete({ where: { id: existing.projectId } });
    } else {
      await prisma.projectMember.delete({ where: { id: existing.id } });
    }
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

  revalidateTag(`project:${membership.projectId}`, { expire: 0 });
  revalidatePath("/home");
  // Partner status is also surfaced on /mypage; refresh that route's cache
  // so the user sees the accepted state without a manual reload.
  revalidatePath("/mypage");
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

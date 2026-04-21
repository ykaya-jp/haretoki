"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

export async function getOrCreateProject() {
  const user = await requireUser();

  // Phone-only Supabase signups + OAuth providers that don't return an
  // email both leave user.email as undefined. Fall through to phone, then
  // a synthetic sentinel keyed on the auth id so Prisma's unique-email
  // constraint never null-dereferences. Still a string, so the collision
  // handling below stays intact.
  const userEmail =
    user.email ??
    (user as { phone?: string }).phone ??
    `user-${user.id}@haretoki.local`;

  try {
    // The partner-invite flow creates a placeholder `User` row with just
    // the email when the owner invites someone — the ProjectMember
    // references THAT placeholder's id (`PLACEHOLDER_ID`). When the
    // partner later signs up via Supabase auth they get a *different*
    // auth uuid (`AUTH_ID`). We need to migrate any partner-membership
    // rows from the placeholder to the real auth user before the
    // downstream findFirst can see them.
    //
    // Prisma's `user.update({ id: ... })` is unsafe here because the
    // ProjectMember → User FK has no `onUpdate: Cascade`, so updating
    // the User primary key would violate the FK and throw. Instead we
    // migrate explicitly: reassign all FK references, then delete the
    // placeholder, then upsert the real user row.
    const placeholder = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (placeholder && placeholder.id !== user.id) {
      console.warn(
        `[getOrCreateProject] Migrating placeholder user ${placeholder.id} → auth id ${user.id} for email ${userEmail}`,
      );
      await prisma.$transaction(async (tx) => {
        // Create the real user row FIRST so FK targets exist before we
        // repoint children to it.
        await tx.user.upsert({
          where: { id: user.id },
          update: { email: userEmail },
          create: {
            id: user.id,
            email: userEmail,
            name: user.user_metadata?.name ?? placeholder.name,
          },
        });
        // Reassign every child FK that pointed at the placeholder. Keep
        // this list in sync with `model User { ... }` relations in
        // `prisma/schema.prisma`. Missing tables here means silent data
        // loss on the placeholder delete (onDelete: Cascade would drop
        // the row instead of remapping), so prefer explicit coverage
        // over generic reflection.
        await tx.projectMember.updateMany({
          where: { userId: placeholder.id },
          data: { userId: user.id },
        });
        await tx.venueFavorite.updateMany({
          where: { userId: placeholder.id },
          data: { userId: user.id },
        });
        await tx.visitRating.updateMany({
          where: { userId: placeholder.id },
          data: { userId: user.id },
        });
        // Below were missing from the original migration list. They
        // rarely trigger (placeholders usually only hold a membership
        // row) but the cascade would destroy legit data if a partner
        // ever managed to produce one of these before signing up.
        await tx.notification.updateMany({
          where: { userId: placeholder.id },
          data: { userId: user.id },
        });
        await tx.savedSearch.updateMany({
          where: { userId: placeholder.id },
          data: { userId: user.id },
        });
        await tx.coupleAgreement.updateMany({
          where: { createdBy: placeholder.id },
          data: { createdBy: user.id },
        });
        await tx.projectInvitation.updateMany({
          where: { createdBy: placeholder.id },
          data: { createdBy: user.id },
        });
        // NotificationPreference has a 1:1 userId @unique. If the
        // placeholder somehow grew one we move it; if the real user
        // *also* has one, drop the placeholder's to avoid a duplicate
        // on the unique index.
        const placeholderPref = await tx.notificationPreference.findUnique({
          where: { userId: placeholder.id },
        });
        if (placeholderPref) {
          const realPref = await tx.notificationPreference.findUnique({
            where: { userId: user.id },
          });
          if (realPref) {
            await tx.notificationPreference.delete({
              where: { userId: placeholder.id },
            });
          } else {
            await tx.notificationPreference.update({
              where: { userId: placeholder.id },
              data: { userId: user.id },
            });
          }
        }
        // Finally delete the placeholder. Its FK children have all been
        // moved so the cascade is a no-op; email uniqueness was already
        // shifted onto the real row by the upsert above (both rows
        // briefly coexist with the same email, which is fine because the
        // unique constraint applies at commit time and we delete the
        // placeholder before commit).
        await tx.user.delete({ where: { id: placeholder.id } });
      });
    } else {
      await prisma.user.upsert({
        where: { id: user.id },
        update: { email: userEmail },
        create: {
          id: user.id,
          email: userEmail,
          name: user.user_metadata?.name,
        },
      });
    }

    // Find existing project membership. Partner flow: after the
    // migration above, the wife's `user.id` now owns the partner
    // ProjectMember row; this findFirst will return it and skip the
    // auto-owner-project fallback that previously kept partners
    // siloed on their own empty project.
    const membership = await prisma.projectMember.findFirst({
      where: { userId: user.id, acceptedAt: { not: null } },
      include: { project: { include: { venues: true } } },
      orderBy: { project: { updatedAt: "desc" } },
    });

    if (membership) return membership.project;

    // Pending partner memberships (acceptedAt null) — don't auto-create
    // a new owner project. The invite-accept flow handles flipping
    // acceptedAt. If we short-circuit here the partner at least doesn't
    // end up on a parallel empty project.
    const pendingMembership = await prisma.projectMember.findFirst({
      where: { userId: user.id, acceptedAt: null },
      include: { project: { include: { venues: true } } },
    });
    if (pendingMembership) return pendingMembership.project;

    // Create new project + owner membership
    const project = await prisma.project.create({
      data: {
        name: "わたしたちの式場選び",
        members: {
          create: {
            userId: user.id,
            role: "owner",
            acceptedAt: new Date(),
          },
        },
      },
      include: { venues: true },
    });

    return project;
  } catch (error) {
    console.error("[getOrCreateProject] failed:", error);
    throw new Error(
      `うまくはじめられませんでした: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function updateProjectStep(projectId: string, step: number) {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  await prisma.project.update({
    where: { id: projectId },
    data: { currentStep: step },
  });
}

export async function updateConditions(conditions: {
  area?: string[];
  dateRange?: string;
  guestCount?: number;
  budget?: { min: number; max: number };
  style?: string[];
}) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  await prisma.project.update({
    where: { id: projectId },
    data: { conditions, currentStep: 2 },
  });
  revalidatePath("/home");
  revalidatePath("/onboarding");
}

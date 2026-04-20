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
    // Ensure user exists in DB. Handle email conflicts gracefully.
    const existingByEmail = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (existingByEmail && existingByEmail.id !== user.id) {
      // Email exists with different ID (e.g., prior email signup before Google).
      // Update the existing record to use the new Supabase auth ID.
      // This is rare but prevents unique constraint failures.
      console.warn(
        `[getOrCreateProject] Email collision: existing user ${existingByEmail.id} has email ${userEmail}, new auth ID ${user.id}. Merging.`,
      );
      await prisma.user.update({
        where: { email: userEmail },
        data: {
          id: user.id,
          name: user.user_metadata?.name ?? existingByEmail.name,
        },
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

    // Find existing project membership
    const membership = await prisma.projectMember.findFirst({
      where: { userId: user.id, acceptedAt: { not: null } },
      include: { project: { include: { venues: true } } },
      orderBy: { project: { updatedAt: "desc" } },
    });

    if (membership) return membership.project;

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

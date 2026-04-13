"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

export async function getOrCreateProject() {
  const user = await requireUser();

  // Ensure user exists in DB
  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email! },
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name,
    },
  });

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
  revalidatePath("/");
  revalidatePath("/onboarding");
}

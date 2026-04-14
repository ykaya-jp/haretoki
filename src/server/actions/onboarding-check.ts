"use server";

import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";

/**
 * Check if onboarding is complete and set cookie if conditions exist.
 * Called from onboarding page to handle existing users.
 *
 * For new users without a project yet, returns { completed: false }
 * so they see the onboarding flow. getOrCreateProject() will be called
 * when they save their first answers.
 */
export async function checkAndSetOnboardingCookie(): Promise<{
  completed: boolean;
}> {
  const user = await requireUser();

  // Find project membership directly (don't redirect on missing — new users are OK)
  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    select: { projectId: true },
  });

  if (!membership) {
    // New user without project → needs onboarding
    return { completed: false };
  }

  const project = await prisma.project.findUnique({
    where: { id: membership.projectId },
    select: { conditions: true },
  });

  if (project?.conditions) {
    const cookieStore = await cookies();
    cookieStore.set("onboarding_completed", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return { completed: true };
  }

  return { completed: false };
}

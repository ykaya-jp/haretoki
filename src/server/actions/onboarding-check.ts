"use server";

import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

/**
 * Check if onboarding is complete and set cookie if conditions exist.
 * Called from onboarding page to handle existing users.
 */
export async function checkAndSetOnboardingCookie(): Promise<{
  completed: boolean;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
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

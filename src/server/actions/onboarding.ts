"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

const onboardingSchema = z.object({
  style: z.array(z.string()).optional(),
  guestCount: z.number().int().positive().optional(),
  area: z.array(z.string()).optional(),
  budget: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }).optional(),
});

type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export async function saveOnboardingAnswers(
  answers: OnboardingAnswers
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const parsed = onboardingSchema.safeParse(answers);
  if (!parsed.success) {
    return { success: false };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { conditions: parsed.data },
  });

  // Set onboarding completed cookie
  const cookieStore = await cookies();
  cookieStore.set("onboarding_completed", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/");
  revalidatePath("/explore");
  return { success: true };
}

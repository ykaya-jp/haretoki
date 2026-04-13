"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry } from "@/lib/anthropic";
import { ONBOARDING_RECOMMENDATION_PROMPT } from "@/lib/prompts/onboarding";

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

interface VenueRecommendation {
  name: string;
  location: string;
  reason: string;
  estimatedPrice: number | null;
  ceremonyStyles: string[];
  strengths: string[];
}

export async function getOnboardingRecommendations(): Promise<{
  recommendations: VenueRecommendation[];
  advice: string;
} | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { conditions: true },
  });

  if (!project?.conditions) return null;

  const conditions = project.conditions as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  try {
    const response = await withRetry(() =>
      askClaude({
        system: ONBOARDING_RECOMMENDATION_PROMPT.system,
        userMessage: ONBOARDING_RECOMMENDATION_PROMPT.buildUserMessage(conditions),
      }),
    );

    return JSON.parse(response);
  } catch {
    return null;
  }
}

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

  revalidatePath("/home");
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

  const [project, existingVenues] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    prisma.venue.findMany({
      where: { projectId },
      select: { name: true },
    }),
  ]);

  // Allow recommendations even without conditions (use defaults)
  const conditions = (project?.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  const existingNames = existingVenues.map((v) => v.name);

  try {
    // Build enhanced prompt including existing venues to avoid duplicates
    const exclusionNote = existingNames.length > 0
      ? `\n\n注意: 以下の式場は既に登録済みなので、それ以外をおすすめしてください: ${existingNames.join("、")}`
      : "";

    const response = await withRetry(() =>
      askClaude({
        system: ONBOARDING_RECOMMENDATION_PROMPT.system,
        userMessage: ONBOARDING_RECOMMENDATION_PROMPT.buildUserMessage(conditions) + exclusionNote,
      }),
    );

    let result;
    try {
      result = JSON.parse(response);
    } catch {
      return null;
    }
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

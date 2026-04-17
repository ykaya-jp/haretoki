"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { getOrCreateProject } from "@/server/actions/projects";
import { isClaudeAvailable, askClaude, withRetry } from "@/lib/anthropic";
import { ONBOARDING_RECOMMENDATION_PROMPT } from "@/lib/prompts/onboarding";
import {
  AI_REC_VENUE_THRESHOLD,
  type ExploreAIRecommendationsResult,
  type ProjectConditionsSummary,
  type VenueRecommendation,
} from "@/server/actions/onboarding-types";

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
  await requireUser();
  // Ensure project exists (creates one for new users)
  const project = await getOrCreateProject();
  const projectId = project.id;

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

/**
 * Original onboarding-flow entry point. Kept for backwards compatibility:
 * the onboarding chat reads { recommendations, advice }. The richer
 * "explore" surface uses getExploreAIRecommendations (below) so it can
 * gate by venue count and surface rationale to the user.
 */
export async function getOnboardingRecommendations(): Promise<{
  recommendations: VenueRecommendation[];
  advice: string;
} | null> {
  const result = await fetchClaudeRecommendations();
  if (!result) return null;
  return { recommendations: result.recommendations, advice: result.advice ?? "" };
}

/**
 * Lightweight server fetch the Explore page can call before any Claude
 * round-trip: returns venueCount + conditions so the client can decide
 * whether to render the "Pre-AI" state without calling Claude at all.
 */
export async function getExploreAIRecommendationsSeed(): Promise<{
  venueCount: number;
  conditions: ProjectConditionsSummary;
  shouldRequest: boolean;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [project, venueCount] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    prisma.venue.count({ where: { projectId } }),
  ]);

  const conditions = normalizeConditions(project?.conditions);
  const shouldRequest = venueCount >= AI_REC_VENUE_THRESHOLD && isClaudeAvailable();
  return { venueCount, conditions, shouldRequest };
}

/**
 * Full Claude-backed recommendations. Always returns a status — never
 * throws and never returns null — so the client can render a stable
 * container in every state.
 */
export async function getExploreAIRecommendations(): Promise<ExploreAIRecommendationsResult> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [project, venues] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    prisma.venue.findMany({
      where: { projectId },
      select: { name: true },
    }),
  ]);

  const conditions = normalizeConditions(project?.conditions);
  const venueCount = venues.length;

  if (venueCount < AI_REC_VENUE_THRESHOLD) {
    return {
      status: "insufficient_data",
      venueCount,
      threshold: AI_REC_VENUE_THRESHOLD,
      conditions,
    };
  }

  if (!isClaudeAvailable()) {
    return { status: "unavailable", venueCount, conditions };
  }

  const result = await fetchClaudeRecommendations(venues.map((v) => v.name));
  if (!result) {
    return { status: "error", venueCount, conditions };
  }

  return {
    status: "ready",
    venueCount,
    conditions,
    recommendations: result.recommendations,
    advice: result.advice ?? "",
  };
}

function normalizeConditions(raw: unknown): ProjectConditionsSummary {
  const c = (raw ?? {}) as {
    style?: string[];
    area?: string[];
    guestCount?: number;
    budget?: { min: number; max: number };
  };
  return {
    styles: c.style && c.style.length > 0 ? c.style : undefined,
    areas: c.area && c.area.length > 0 ? c.area : undefined,
    guestCount: typeof c.guestCount === "number" ? c.guestCount : undefined,
    budgetMax:
      typeof c.budget?.max === "number" && c.budget.max > 0 ? c.budget.max : undefined,
  };
}

/**
 * Internal: actually call Claude. Returns null on any failure.
 * Conditions are read again here so the legacy getOnboardingRecommendations
 * stays self-contained.
 */
async function fetchClaudeRecommendations(existingNames?: string[]): Promise<{
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

  // Defaults are fine — Claude prompt handles "未定" gracefully.
  const conditions = (project?.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  // If the caller didn't pre-load existing venues, fetch them now so we can
  // ask Claude to avoid duplicates of what the couple already registered.
  let names = existingNames;
  if (!names) {
    const venues = await prisma.venue.findMany({
      where: { projectId },
      select: { name: true },
    });
    names = venues.map((v) => v.name);
  }

  try {
    const exclusionNote = names.length > 0
      ? `\n\n注意: 以下の式場は既に登録済みなので、それ以外をおすすめしてください: ${names.join("、")}`
      : "";

    // 20s hard timeout so a hung API call doesn't block the page indefinitely.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Claude request timed out after 20s")), 20_000),
    );

    let response: string;
    try {
      response = await Promise.race([
        withRetry(() =>
          askClaude({
            system: ONBOARDING_RECOMMENDATION_PROMPT.system,
            userMessage: ONBOARDING_RECOMMENDATION_PROMPT.buildUserMessage(conditions) + exclusionNote,
          }),
        ),
        timeoutPromise,
      ]);
    } catch (apiError) {
      // Log credit/billing and other API errors so they're diagnosable without
      // surfacing the raw error to the user.
      if (apiError instanceof Error) {
        const msg = apiError.message;
        if (msg.includes("credit") || msg.includes("billing") || msg.includes("402")) {
          console.error("[fetchClaudeRecommendations] Billing/credit error:", msg);
        } else if (msg.includes("timed out")) {
          console.warn("[fetchClaudeRecommendations] Request timed out");
        } else {
          console.error("[fetchClaudeRecommendations] API error:", msg);
        }
      }
      return null;
    }

    // Strip markdown code fences in case Claude wraps the JSON.
    const cleaned = response.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.warn("[fetchClaudeRecommendations] Failed to parse Claude response as JSON");
      return null;
    }
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      console.warn("[fetchClaudeRecommendations] Unexpected response shape:", Object.keys(result ?? {}));
      return null;
    }
    return result;
  } catch (err) {
    console.error("[fetchClaudeRecommendations] Unexpected error:", err);
    return null;
  }
}

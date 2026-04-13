"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash } from "@/lib/anthropic";
import { REVIEW_SUMMARY_PROMPT } from "@/lib/prompts/review-summary";
import type { ReviewSource } from "@/generated/prisma/client";

interface ReviewSummary {
  summary: string;
  sentiment: Record<string, number>;
  strengths: string[];
  concerns: string[];
  suggestedScores: Record<string, number>;
}

export async function analyzeVenueReviews(
  venueId: string,
  sourceUrl: string,
  source: ReviewSource,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
  });
  if (!venue) return { success: false, error: "式場が見つかりません" };

  if (!isClaudeAvailable()) {
    return { success: false, error: "AI機能を利用するにはAPIキーを設定してください" };
  }

  // Check if already analyzed (by inputHash)
  const inputHash = computeInputHash(`${venueId}:${sourceUrl}`);
  const existing = await prisma.review.findFirst({
    where: { venueId, sourceUrl },
  });
  if (existing?.aiSummary) {
    return { success: true }; // Already analyzed
  }

  try {
    // Fetch review page content
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VenueLens/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { success: false, error: "レビューページを取得できませんでした" };
    }

    const html = await response.text();
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Send to Claude for analysis
    const claudeResponse = await withRetry(() =>
      askClaude({
        system: REVIEW_SUMMARY_PROMPT.system,
        userMessage: REVIEW_SUMMARY_PROMPT.buildUserMessage([textContent], venue.name),
      })
    );

    const result = JSON.parse(claudeResponse) as ReviewSummary & { reviewCount: number };

    // Save or update review record
    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          aiSummary: result.summary,
          sentiment: result.sentiment,
          rating: result.suggestedScores?.reviews ? result.suggestedScores.reviews : null,
        },
      });
    } else {
      await prisma.review.create({
        data: {
          venueId,
          source,
          sourceUrl,
          aiSummary: result.summary,
          sentiment: result.sentiment,
          rating: result.suggestedScores?.reviews ? result.suggestedScores.reviews : null,
        },
      });
    }

    // Also save to AiAnalysis for cache
    await prisma.aiAnalysis.create({
      data: {
        projectId,
        venueId,
        type: "review_summary",
        inputHash,
        output: claudeResponse,
      },
    });

    revalidatePath(`/venues/${venueId}`);
    return { success: true };
  } catch {
    return { success: false, error: "口コミ分析に失敗しました" };
  }
}

export async function getVenueReviews(venueId: string) {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  return prisma.review.findMany({
    where: { venueId },
    orderBy: { fetchedAt: "desc" },
  });
}

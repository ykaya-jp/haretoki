"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash, stripPII } from "@/lib/anthropic";
import { REVIEW_SUMMARY_PROMPT } from "@/lib/prompts/review-summary";
import type { ReviewSource } from "@/generated/prisma/client";
import {
  parseEstimateIncrease,
  aggregateEstimateIncrease,
} from "@/server/actions/review-schema";

interface ReviewSummary {
  summary: string;
  sentiment: Record<string, number>;
  strengths: string[];
  concerns: string[];
  suggestedScores: Record<string, number>;
  estimateIncrease?: unknown;
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

  // Validate URL domain (allowlist)
  const ALLOWED_REVIEW_DOMAINS = [
    "zexy.net", "www.zexy.net",
    "weddingpark.net", "www.weddingpark.net",
    "hana-yume.net", "www.hana-yume.net",
    "wedding.mynavi.jp",
    "mwed.jp", "www.mwed.jp",
  ];

  try {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== "https:") {
      return { success: false, error: "HTTPSのURLのみ対応しています" };
    }
    if (!ALLOWED_REVIEW_DOMAINS.some(d => parsedUrl.hostname === d || parsedUrl.hostname.endsWith("." + d))) {
      return { success: false, error: "対応していないサイトです。ゼクシィ、Wedding Park、ハナユメ、マイナビ、みんなのウェディングのURLを入力してください" };
    }
  } catch {
    return { success: false, error: "有効なURLを入力してください" };
  }

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
        "User-Agent": "Mozilla/5.0 (compatible; Haretoki/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { success: false, error: "レビューページを取得できませんでした" };
    }

    const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB
    const reader = response.body?.getReader();
    if (!reader) return { success: false, error: "レスポンスを読み取れませんでした" };

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        return { success: false, error: "ページサイズが大きすぎます" };
      }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Send to Claude for analysis
    const strippedContent = stripPII(textContent);
    const claudeResponse = await withRetry(() =>
      askClaude({
        system: REVIEW_SUMMARY_PROMPT.system,
        userMessage: REVIEW_SUMMARY_PROMPT.buildUserMessage([strippedContent], venue.name),
      })
    );

    let result: ReviewSummary & { reviewCount: number };
    try {
      result = JSON.parse(claudeResponse) as ReviewSummary & { reviewCount: number };
    } catch {
      return { success: false, error: "AIの応答を解析できませんでした" };
    }
    if (!result.summary) {
      return { success: false, error: "AIの分析結果が不完全です" };
    }

    // Build categorySummary from AI output
    const categorySummary = {
      service: result.sentiment?.service != null ? `接客: ${result.strengths.filter(s => s.includes("スタッフ") || s.includes("接客")).join("、") || "特記なし"}` : null,
      cuisine: result.sentiment?.cuisine != null ? `料理: ${result.strengths.filter(s => s.includes("料理") || s.includes("食")).join("、") || "特記なし"}` : null,
      costIncrease: result.concerns.filter(c => c.includes("見積") || c.includes("費用") || c.includes("金額")).join("、") || null,
      negativeHighlights: result.concerns,
      overall: result.summary,
    };
    const isNegative = result.concerns.length > result.strengths.length;

    // Parse estimate-increase payload (optional, AI-extracted)
    const estimateIncrease = parseEstimateIncrease(result.estimateIncrease);

    // Save or update review record
    const reviewData = {
      aiSummary: result.summary,
      sentiment: result.sentiment,
      categorySummary,
      isNegative,
      estimateIncrease: estimateIncrease ?? undefined,
      rating: result.suggestedScores?.reviews ? result.suggestedScores.reviews : null,
    };

    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: reviewData,
      });
    } else {
      await prisma.review.create({
        data: {
          venueId,
          source,
          sourceUrl,
          ...reviewData,
        },
      });
    }

    // Recompute aggregate venue-level estimate-increase stats from all reviews
    await recomputeVenueReviewEstimate(venueId);

    // Save AI-generated per-dimension scores to VenueScore
    // Source: "ai_analysis" so they don't conflict with user ratings
    if (result.suggestedScores) {
      const scoreUpserts = Object.entries(result.suggestedScores)
        .filter(([_, score]) => typeof score === "number" && score >= 1 && score <= 5)
        .map(([dimension, score]) =>
          prisma.venueScore.upsert({
            where: {
              venueId_dimension_source: {
                venueId,
                dimension: dimension as never,
                source: "ai_analysis",
              },
            },
            update: { score, reviewCount: result.reviewCount ?? 0 },
            create: {
              venueId,
              dimension: dimension as never,
              source: "ai_analysis",
              score,
              reviewCount: result.reviewCount ?? 0,
            },
          }),
        );
      if (scoreUpserts.length > 0) {
        await prisma.$transaction(scoreUpserts);
      }
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

    revalidateTag(`project:${projectId}`, { expire: 0 });
    revalidatePath(`/venues/${venueId}`);
    return { success: true };
  } catch {
    return { success: false, error: "口コミ分析に失敗しました" };
  }
}

export async function getVenueReviews(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.review.findMany({
    where: { venueId, venue: { projectId } },
    orderBy: { fetchedAt: "desc" },
  });
}

/**
 * Fetch the venue-level aggregated review-based estimate-increase
 * stats for a single venue (populated by recomputeVenueReviewEstimate).
 */
export async function getVenueReviewEstimateAggregate(venueId: string): Promise<{
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number | null;
} | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: {
      reviewEstimateDeltaYen: true,
      reviewEstimateDeltaPct: true,
      reviewEstimateSampleCount: true,
    },
  });
  if (!venue) return null;
  return {
    deltaYen: venue.reviewEstimateDeltaYen,
    deltaPct: venue.reviewEstimateDeltaPct ? Number(venue.reviewEstimateDeltaPct) : null,
    sampleCount: venue.reviewEstimateSampleCount,
  };
}

/**
 * Aggregate all reviews of a venue that carry estimateIncrease data
 * and update venue-level columns (avg deltaYen/Pct, sample count).
 * Called internally after review upsert; not guarded by auth so it can
 * be reused from trusted server code. Exported primarily for testability.
 */
export async function recomputeVenueReviewEstimate(venueId: string): Promise<{
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number;
}> {
  const reviews = await prisma.review.findMany({
    where: { venueId, estimateIncrease: { not: undefined } },
    select: { estimateIncrease: true },
  });

  const parsed = reviews.map((r) => parseEstimateIncrease(r.estimateIncrease));
  const { deltaYen, deltaPct, sampleCount } = aggregateEstimateIncrease(parsed);

  await prisma.venue.update({
    where: { id: venueId },
    data: {
      reviewEstimateDeltaYen: deltaYen,
      reviewEstimateDeltaPct: deltaPct,
      reviewEstimateSampleCount: sampleCount > 0 ? sampleCount : null,
    },
  });

  return { deltaYen, deltaPct, sampleCount };
}

/**
 * Manual entry/override of estimateIncrease on a single review.
 * UI is not wired yet; this is the back-end hook for future use.
 */
export async function updateReviewEstimateIncrease(
  reviewId: string,
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const review = await prisma.review.findFirst({
    where: { id: reviewId, venue: { projectId } },
    select: { id: true, venueId: true },
  });
  if (!review) return { success: false, error: "口コミが見つかりません" };

  const parsed = parseEstimateIncrease(data);
  // Allow clearing by passing null/empty — translate to Prisma JsonNull via undefined+explicit null
  await prisma.review.update({
    where: { id: review.id },
    data: { estimateIncrease: parsed ?? undefined },
  });

  await recomputeVenueReviewEstimate(review.venueId);
  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath(`/venues/${review.venueId}`);
  return { success: true };
}

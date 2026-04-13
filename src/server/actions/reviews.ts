"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash, stripPII } from "@/lib/anthropic";
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
        "User-Agent": "Mozilla/5.0 (compatible; VenueLens/1.0)",
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
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.review.findMany({
    where: { venueId, venue: { projectId } },
    orderBy: { fetchedAt: "desc" },
  });
}

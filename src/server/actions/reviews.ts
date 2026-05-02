"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag, cacheTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, computeInputHash, stripPII } from "@/lib/anthropic";
import { cachedAskClaude } from "@/lib/ai-cache";
import { MODEL } from "@/lib/models";
import { REVIEW_SUMMARY_PROMPT } from "@/lib/prompts/review-summary";

// Round 15 (2026-05-02) — bump when REVIEW_SUMMARY_PROMPT semantics change
// so cached summaries from a prior prompt revision aren't served against
// the new contract. cachedAskClaude folds this into the cache key.
const REVIEW_SUMMARY_PROMPT_VERSION = 1;
import { guardExternalUrl } from "@/lib/url-guard";
import type { ReviewSource } from "@/generated/prisma/client";
import {
  parseEstimateIncrease,
  aggregateEstimateIncrease,
} from "@/server/actions/review-schema";

/**
 * Normalise a Claude completion into something JSON.parse can consume.
 * Handles: ```json … ``` fences, plain preamble/postamble text, and
 * trailing commentary after the JSON block. Falls back to the raw
 * input if neither a fenced block nor a balanced {…} can be located.
 */
function stripJsonResponse(raw: string): string {
  // Fenced block first — ```json { … } ``` or ``` { … } ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Otherwise, slice from the first "{" to the matching last "}" so
  // any preamble ("Here's the analysis:") or trailing notes drop off.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return raw.trim();
}

interface ReviewSummary {
  summary: string;
  sentiment: Record<string, number>;
  strengths: string[];
  concerns: string[];
  suggestedScores: Record<string, number>;
  estimateIncrease?: unknown;
}

export interface ExtractedIndividualReview {
  title: string | null;
  body: string;
  rating: number | null;
  author: string | null;
  visitedAt: string | null;
}

/**
 * Persist a set of individual reviews extracted from the source listing page.
 *
 * Each review body gets a short content hash appended to the sourceUrl as a
 * fragment (`#rev-{hash8}`) so the `(venueId, source, sourceUrl)` unique
 * constraint naturally dedupes — re-importing the same page won't multiply
 * rows, and the aggregate summary (same base URL, no fragment) stays in its
 * own slot. Other review-aggregation paths (`analyzeVenueReviews`) keep
 * running in parallel.
 *
 * The metadata (author / visitedAt / title) is stashed inside
 * `categorySummary.individual` so no schema migration is needed. All fields
 * are Claude-extracted and may be null.
 */
export async function saveExtractedReviews(
  venueId: string,
  reviews: ExtractedIndividualReview[],
  baseSourceUrl: string,
  source: ReviewSource,
): Promise<{ saved: number; skipped: number }> {
  if (reviews.length === 0) return { saved: 0, skipped: 0 };

  let saved = 0;
  let skipped = 0;
  for (const r of reviews) {
    const hash = computeInputHash(r.body).slice(0, 8);
    // URL fragment never hits the wire but participates in the unique key,
    // so we reuse the user's source URL + a stable per-body discriminator.
    const rowSourceUrl = `${baseSourceUrl}#rev-${hash}`;
    try {
      await prisma.review.upsert({
        where: {
          venueId_source_sourceUrl: {
            venueId,
            source,
            sourceUrl: rowSourceUrl,
          },
        },
        update: {
          aiSummary: r.body,
          rating: r.rating,
          categorySummary: {
            individual: {
              title: r.title,
              author: r.author,
              visitedAt: r.visitedAt,
            },
          },
        },
        create: {
          venueId,
          source,
          sourceUrl: rowSourceUrl,
          aiSummary: r.body,
          rating: r.rating,
          categorySummary: {
            individual: {
              title: r.title,
              author: r.author,
              visitedAt: r.visitedAt,
            },
          },
        },
      });
      saved++;
    } catch (err) {
      console.warn("[saveExtractedReviews] upsert failed:", err);
      skipped++;
    }
  }
  return { saved, skipped };
}

/**
 * Result shape for `analyzeVenueReviews`. Callers get either `{ok:true}`
 * with no throwing, or `{ok:false, reason}` describing why the summary
 * could not be produced. Reasons are UI-actionable:
 *   - "timeout"     — the 15s budget expired; partial progress may exist
 *   - "api-error"   — Claude / network / DB error (not actionable by user)
 *   - "no-reviews"  — no reviews available to summarise
 *
 * The legacy `{success, error}` shape was too generic for the confirm
 * pipeline — we need to show different toast copy for timeout vs api-error
 * vs no-reviews, so callers discriminate on `reason`.
 */
export type AnalyzeVenueReviewsResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "api-error" | "no-reviews"; message?: string };

/**
 * Analyze reviews for a venue. Returns a Result shape — never throws into
 * the caller. Wrapped in a 15s timeout so the URL-import pipeline can
 * degrade gracefully and show a "後で再生成できます" CTA instead of hanging.
 */
export async function analyzeVenueReviews(
  venueId: string,
  sourceUrl: string,
  source: ReviewSource,
): Promise<AnalyzeVenueReviewsResult> {
  try {
    return await Promise.race([
      analyzeVenueReviewsInner(venueId, sourceUrl, source),
      new Promise<AnalyzeVenueReviewsResult>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, reason: "timeout" }),
          15_000,
        ),
      ),
    ]);
  } catch (err) {
    console.warn("[analyzeVenueReviews] unexpected error:", err);
    return { ok: false, reason: "api-error" };
  }
}

async function analyzeVenueReviewsInner(
  venueId: string,
  sourceUrl: string,
  source: ReviewSource,
): Promise<AnalyzeVenueReviewsResult> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
  });
  if (!venue) return { ok: false, reason: "api-error", message: "式場が見つかりません" };

  // Validate URL domain (allowlist)
  const ALLOWED_REVIEW_DOMAINS = [
    "zexy.net", "www.zexy.net",
    "weddingpark.net", "www.weddingpark.net",
    "hana-yume.net", "www.hana-yume.net",
    "wedding.mynavi.jp",
    "mwed.jp", "www.mwed.jp",
  ];

  // SSRF guard first (blocks private IPs, non-HTTPS, metadata endpoints),
  // then domain allowlist.
  const guard = guardExternalUrl(sourceUrl);
  if (!guard.ok) {
    return {
      ok: false,
      reason: "api-error",
      message:
        guard.reason === "scheme"
          ? "HTTPS の URL のみ対応しています"
          : guard.reason === "invalid"
            ? "有効な URL を入力してください"
            : "この URL は取得できません",
    };
  }
  const parsedUrl = guard.url;
  if (!ALLOWED_REVIEW_DOMAINS.some(d => parsedUrl.hostname === d || parsedUrl.hostname.endsWith("." + d))) {
    return {
      ok: false,
      reason: "api-error",
      message:
        "対応していないサイトです。ゼクシィ、Wedding Park、ハナユメ、マイナビ、みんなのウェディングの URL を入力してください",
    };
  }

  if (!isClaudeAvailable()) {
    return { ok: false, reason: "api-error", message: "AI機能を利用するにはAPIキーを設定してください" };
  }

  // Check if already analyzed (by inputHash)
  const inputHash = computeInputHash(`${venueId}:${sourceUrl}`);
  const existing = await prisma.review.findFirst({
    where: { venueId, sourceUrl },
  });
  if (existing?.aiSummary) {
    return { ok: true }; // Already analyzed
  }

  try {
    // Fetch review page content. zexy / wedding park reject the fake
    // "Mozilla/5.0 (compatible; Haretoki/1.0)" UA with 403, which is
    // why the URL import pipeline uses a real Chrome UA via
    // fetchPageForExtraction. Mirror those headers here so the review
    // analyzer path stops throwing "口コミページをうまく取れません
    // でした" on the same URLs that venue import opens successfully.
    const referer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        DNT: "1",
        Referer: referer,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn("[analyzeVenueReviews] non-2xx from source", {
        sourceUrl,
        status: response.status,
        statusText: response.statusText,
      });
      return {
        ok: false,
        reason: "api-error",
        message: `口コミページをうまく取れませんでした (HTTP ${response.status})`,
      };
    }

    const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB
    const reader = response.body?.getReader();
    if (!reader)
      return { ok: false, reason: "api-error", message: "レスポンスを読み取れませんでした" };

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        return { ok: false, reason: "api-error", message: "ページサイズが大きすぎます" };
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

    if (textContent.length === 0) {
      return { ok: false, reason: "no-reviews" };
    }

    // Send to Claude for analysis. Round 15: switched from the low-level
    // computeInputHash + getCachedResponse + setCachedResponse trio to the
    // unified cachedAskClaude wrapper. Behavior is identical (cache lookup
    // → askClaude with retry → cache write) but the hash recipe now includes
    // model + REVIEW_SUMMARY_PROMPT_VERSION + maxTokens, so a model swap or
    // prompt revision invalidates stale rows automatically — same contract
    // every other cached prompt in src/server/actions/* now follows.
    const strippedContent = stripPII(textContent);
    const reviewUserMessage = REVIEW_SUMMARY_PROMPT.buildUserMessage([strippedContent], venue.name);
    const claudeResponse = await cachedAskClaude({
      system: REVIEW_SUMMARY_PROMPT.system,
      userMessage: reviewUserMessage,
      model: MODEL.SONNET,
      promptVersion: REVIEW_SUMMARY_PROMPT_VERSION,
    });
    if (claudeResponse === null) {
      return {
        ok: false,
        reason: "api-error",
        message: "AI 分析を取得できませんでした",
      };
    }

    // Claude occasionally wraps the JSON in ```json …``` fences or adds
    // a short preamble like "Here's the analysis:" before the object.
    // Strip fences + slice from the first "{" to the last "}" before
    // parsing so we don't throw on legitimate output. Same pattern as
    // venues.ts extractJson for the URL-import path.
    const stripped = stripJsonResponse(claudeResponse);
    let result: ReviewSummary & { reviewCount: number };
    try {
      result = JSON.parse(stripped) as ReviewSummary & { reviewCount: number };
    } catch (err) {
      console.warn("[analyzeVenueReviews] JSON parse failed", {
        venueId,
        rawLength: claudeResponse.length,
        rawPreview: claudeResponse.slice(0, 400),
        strippedPreview: stripped.slice(0, 400),
        err,
      });
      return {
        ok: false,
        reason: "api-error",
        message: "AI の応答をうまく読み取れませんでした",
      };
    }
    if (!result.summary) {
      return { ok: false, reason: "api-error", message: "AI の読み取りが途中で止まりました" };
    }

    // Build categorySummary from AI output
    // E-9: explicit positiveHighlights + negativeHighlights drive the
    // "Venue Whisper" 2-axis card on the venue detail page.
    const categorySummary = {
      service: result.sentiment?.service != null ? `接客: ${result.strengths.filter(s => s.includes("スタッフ") || s.includes("接客")).join("、") || "特記なし"}` : null,
      cuisine: result.sentiment?.cuisine != null ? `料理: ${result.strengths.filter(s => s.includes("料理") || s.includes("食")).join("、") || "特記なし"}` : null,
      costIncrease: result.concerns.filter(c => c.includes("見積") || c.includes("費用") || c.includes("金額")).join("、") || null,
      positiveHighlights: result.strengths,
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

    // Save AI-generated per-dimension scores to VenueScore. Source:
    // "ai_analysis" so they don't conflict with user ratings. Dimensions
    // are validated against the ScoreDimension enum so an unexpected Claude
    // key (e.g. typo) can never reach the DB (TS-01 fix: no more `as never`).
    if (result.suggestedScores) {
      const VALID_DIMS = new Set<string>([
        "atmosphere",
        "hospitality",
        "cuisine",
        "cost",
        "access",
        "reviews",
        "dress",
        "photo_video",
        "flowers",
        "staff_continuity",
        "capacity",
        "cancellation",
      ]);
      type Dim =
        | "atmosphere"
        | "hospitality"
        | "cuisine"
        | "cost"
        | "access"
        | "reviews"
        | "dress"
        | "photo_video"
        | "flowers"
        | "staff_continuity"
        | "capacity"
        | "cancellation";

      const scoreUpserts = Object.entries(result.suggestedScores)
        .filter(
          ([dim, score]) =>
            VALID_DIMS.has(dim) &&
            typeof score === "number" &&
            score >= 1 &&
            score <= 5,
        )
        .map(([dimension, score]) =>
          prisma.venueScore.upsert({
            where: {
              venueId_dimension_source: {
                venueId,
                dimension: dimension as Dim,
                source: "ai_analysis",
              },
            },
            update: { score, reviewCount: result.reviewCount ?? 0 },
            create: {
              venueId,
              dimension: dimension as Dim,
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
    return { ok: true };
  } catch (err) {
    // AbortSignal.timeout throws a TimeoutError when the 15s fetch budget
    // expires. Surface that distinctly so the UI can show "timeout" copy.
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, reason: "timeout" };
    }
    console.warn("[analyzeVenueReviewsInner] error:", err);
    return { ok: false, reason: "api-error", message: "口コミをうまくまとめられませんでした" };
  }
}

export async function getVenueReviews(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return getVenueReviewsCached(venueId, projectId);
}

async function getVenueReviewsCached(venueId: string, projectId: string) {
  "use cache";
  cacheTag(`venue:${venueId}`);
  cacheTag(`project:${projectId}`);

  return prisma.review.findMany({
    where: { venueId, venue: { projectId } },
    orderBy: { fetchedAt: "desc" },
  });
}

/**
 * Batch-refresh AI summaries for every review of a venue. Skips reviews that
 * already have an `aiSummary` unless `force` is true. Returns a per-review
 * result list so the UI can surface partial failures without blocking the
 * successful ones.
 *
 * Foundation for Sprint 4's "口コミ AI 要約 バッチ" — call from an admin UI
 * or a future cron to re-run analysis after prompt improvements.
 */
export async function batchAnalyzeVenueReviews(
  venueId: string,
  opts: { force?: boolean } = {},
): Promise<{
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: Array<{ reviewId: string; error: string }>;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: { id: true },
  });
  if (!venue) {
    return { attempted: 0, succeeded: 0, skipped: 0, failed: [] };
  }

  const reviews = await prisma.review.findMany({
    where: { venueId, venue: { projectId } },
    select: { id: true, sourceUrl: true, source: true, aiSummary: true },
    orderBy: { fetchedAt: "desc" },
  });

  const failed: Array<{ reviewId: string; error: string }> = [];
  let succeeded = 0;
  let skipped = 0;
  let attempted = 0;

  for (const r of reviews) {
    if (r.aiSummary && !opts.force) {
      skipped++;
      continue;
    }
    attempted++;
    const res = await analyzeVenueReviews(venueId, r.sourceUrl, r.source);
    if (res.ok) {
      succeeded++;
    } else {
      const errorLabel =
        res.reason === "timeout"
          ? "timeout"
          : res.reason === "no-reviews"
            ? "no-reviews"
            : (res.message ?? "api-error");
      failed.push({ reviewId: r.id, error: errorLabel });
    }
  }

  return { attempted, succeeded, skipped, failed };
}

/**
 * Fetch the venue-level aggregated review-based estimate-increase
 * stats for a single venue (populated by recomputeVenueReviewEstimate).
 * Also computes standardDeviation of deltaYen across reviews (n>=3 required).
 */
export async function getVenueReviewEstimateAggregate(venueId: string): Promise<{
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number | null;
  standardDeviation: number | null;
} | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return getVenueReviewEstimateAggregateCached(venueId, projectId);
}

async function getVenueReviewEstimateAggregateCached(
  venueId: string,
  projectId: string,
): Promise<{
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number | null;
  standardDeviation: number | null;
} | null> {
  "use cache";
  cacheTag(`venue:${venueId}`);
  cacheTag(`project:${projectId}`);

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: {
      reviewEstimateDeltaYen: true,
      reviewEstimateDeltaPct: true,
      reviewEstimateSampleCount: true,
    },
  });
  if (!venue) return null;

  // Compute sample standard deviation from individual review deltaYen values
  let standardDeviation: number | null = null;
  const sampleCount = venue.reviewEstimateSampleCount;
  if (sampleCount != null && sampleCount >= 3) {
    const reviews = await prisma.review.findMany({
      where: { venueId, estimateIncrease: { not: undefined } },
      select: { estimateIncrease: true },
    });
    const { parseEstimateIncrease: parse } = await import("@/server/actions/review-schema");
    const yenValues = reviews
      .map((r) => parse(r.estimateIncrease)?.deltaYen)
      .filter((v): v is number => typeof v === "number");
    if (yenValues.length >= 3) {
      const mean = yenValues.reduce((a, b) => a + b, 0) / yenValues.length;
      const variance =
        yenValues.reduce((a, v) => a + (v - mean) ** 2, 0) / (yenValues.length - 1);
      standardDeviation = Math.round(Math.sqrt(variance));
    }
  }

  return {
    deltaYen: venue.reviewEstimateDeltaYen,
    deltaPct: venue.reviewEstimateDeltaPct ? Number(venue.reviewEstimateDeltaPct) : null,
    sampleCount,
    standardDeviation,
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

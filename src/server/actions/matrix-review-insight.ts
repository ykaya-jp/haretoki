"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  isClaudeAvailable,
  askClaude,
  withRetry,
  computeInputHash,
} from "@/lib/anthropic";
import {
  MATRIX_REVIEW_INSIGHT_PROMPT,
  type MatrixReviewVenueAggregate,
  type MatrixReviewInsightInput,
  type MatrixReviewInsightOutput,
} from "@/lib/prompts/matrix-review-insight";
import { getCachedAnalysis, setCachedAnalysis } from "@/server/ai/cache";

/**
 * Cross-venue AI insight that reads each candidate venue's
 * aggregated reviews and surfaces three lanes:
 *
 *   - `commonConcerns`: concerns recurring across ≥ 2 venues
 *   - `divergence`: where the venues differ in their strengths
 *   - `decisionHint`: a single concrete next-step the couple can
 *      take at the next visit
 *
 * Mirrors the cache + retry + fallback shape of
 * `getMatrixInsight` (W18-7) so the two cards on the compare board
 * (定量 / 定性) read as a sibling pair from the same engineering
 * recipe. See `docs/ai/prompts/matrix-review-insight.system.md`.
 *
 * Dependency note (R2 → R3 hand-off): the canonical
 * `getReviewSummariesForVenues` helper is owned by R2's
 * `src/server/actions/comparison.ts` per the implementation plan.
 * To keep this branch independently buildable + testable, the
 * aggregation walks `prisma.review` directly via
 * `aggregateReviewsForVenues` below. When R2's canonical helper
 * lands, the import can be flipped in one line — the data shape is
 * identical because both implementations target the prompt's
 * `MatrixReviewVenueAggregate` interface.
 */

export type MatrixReviewInsight = MatrixReviewInsightOutput;

const PROMPT_VERSION = MATRIX_REVIEW_INSIGHT_PROMPT.promptVersion;

/**
 * Server entry point. Returns null when the surface should not
 * render (< 2 venues OR every selected venue has zero reviews) so
 * the calling component can collapse cleanly.
 */
export async function getMatrixReviewInsight(
  venueIds: string[],
): Promise<MatrixReviewInsight | null> {
  if (!Array.isArray(venueIds) || venueIds.length < 2) {
    return null;
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Sort + dedupe so the cache key is order-insensitive — the same
  // 3 venues selected in any order should resolve to the same row.
  const sortedIds = Array.from(new Set(venueIds)).sort();

  const aggregates = await aggregateReviewsForVenues(projectId, sortedIds);
  if (aggregates.length < 2) {
    // Fewer than 2 venues survived the project-membership filter
    // (selection contained ids that weren't in this project).
    return null;
  }

  const totalReviews = aggregates.reduce((acc, v) => acc + v.reviewCount, 0);
  if (totalReviews === 0) {
    // Nothing meaningful to say without any reviews on file.
    return null;
  }

  const input: MatrixReviewInsightInput = { venues: aggregates };

  if (!isClaudeAvailable()) {
    return templateInsight(input);
  }

  // Hash covers everything that would change Claude's output.
  // Includes the model id and prompt version so a model upgrade or
  // prompt revision invalidates stale rows automatically — without
  // that, callers would silently serve pre-upgrade outputs after a
  // deploy.
  const inputHash = computeInputHash(
    JSON.stringify({
      venueIds: sortedIds,
      aggregates: aggregates.map((v) => ({
        name: v.name,
        summary: v.summary,
        strengths: v.strengths,
        concerns: v.concerns,
        reviewCount: v.reviewCount,
      })),
      model: MATRIX_REVIEW_INSIGHT_PROMPT.model,
      promptVersion: PROMPT_VERSION,
    }),
  );

  const cachedRaw = await getCachedAnalysis(
    projectId,
    "matrix_review_insight",
    inputHash,
  );
  if (cachedRaw) {
    const parsed = parseInsightJson(cachedRaw);
    if (parsed) {
      return { ...parsed, fallback: false };
    }
    // fall through to regenerate on parse failure
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error("matrix-review-insight timed out")),
        MATRIX_REVIEW_INSIGHT_PROMPT.timeoutMs,
      ),
    );

    const raw = await Promise.race([
      withRetry(() =>
        askClaude({
          system: MATRIX_REVIEW_INSIGHT_PROMPT.system,
          userMessage: MATRIX_REVIEW_INSIGHT_PROMPT.buildUserMessage(input),
          model: MATRIX_REVIEW_INSIGHT_PROMPT.model,
          maxTokens: MATRIX_REVIEW_INSIGHT_PROMPT.maxTokens,
        }),
      ),
      timeoutPromise,
    ]);

    // Claude occasionally wraps JSON in ```json blocks — strip them.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = parseInsightJson(cleaned);
    if (!parsed) {
      return templateInsight(input);
    }

    await setCachedAnalysis({
      projectId,
      type: "matrix_review_insight",
      inputHash,
      output: JSON.stringify(parsed),
    });

    return { ...parsed, fallback: false };
  } catch {
    return templateInsight(input);
  }
}

/**
 * JSON shape guard for the Claude response (and for cache reads —
 * a malformed cache row should regenerate, never crash). Filters
 * each list down to strings + caps lengths so a verbose response
 * can't blow up the card UI either.
 */
function parseInsightJson(
  raw: string,
): Omit<MatrixReviewInsightOutput, "fallback"> | null {
  try {
    const parsed = JSON.parse(raw) as {
      commonConcerns?: unknown;
      divergence?: unknown;
      decisionHint?: unknown;
    };
    if (
      !Array.isArray(parsed.commonConcerns) ||
      !Array.isArray(parsed.divergence) ||
      typeof parsed.decisionHint !== "string"
    ) {
      return null;
    }
    return {
      commonConcerns: parsed.commonConcerns
        .filter((s): s is string => typeof s === "string")
        .slice(0, 3),
      divergence: parsed.divergence
        .filter((s): s is string => typeof s === "string")
        .slice(0, 3),
      decisionHint: parsed.decisionHint,
    };
  } catch {
    return null;
  }
}

/**
 * Project-scoped aggregation that walks `prisma.review` directly.
 *
 * Called by `getMatrixReviewInsight` when the canonical R2 helper
 * (`getReviewSummariesForVenues` in `comparison.ts`) is not yet
 * available. The shape is intentionally identical so the call-site
 * swap is a single import edit when R2 lands.
 *
 * Tier 1: aggregate `aiSummary` from each venue's most-recent
 * review (the per-venue summary already produced by
 * `analyzeVenueReviews`).
 * Tier 2: pull `categorySummary.strengths[]` /
 * `categorySummary.concerns[]` if available, deduplicate, and cap
 * at 5 each — matches the prompt's `BULLET_CAP`.
 *
 * The function is exported for testability — tests can stub
 * `prisma.review.findMany` and assert the prompt-input shape
 * without involving auth / Claude.
 */
export async function aggregateReviewsForVenues(
  projectId: string,
  venueIds: string[],
): Promise<MatrixReviewVenueAggregate[]> {
  if (venueIds.length === 0) return [];

  const venues = await prisma.venue.findMany({
    where: {
      id: { in: venueIds },
      projectId,
    },
    select: {
      id: true,
      name: true,
      reviews: {
        select: {
          aiSummary: true,
          categorySummary: true,
          fetchedAt: true,
        },
        orderBy: { fetchedAt: "desc" },
      },
    },
  });

  return venues.map((v) => {
    const reviews = v.reviews ?? [];
    const reviewCount = reviews.length;
    // Pick the most recent non-empty aiSummary as the venue's
    // canonical summary. Older imports may have stored only the
    // category breakdown without a summary; we walk down until we
    // find one.
    const summary =
      reviews.find((r) => typeof r.aiSummary === "string" && r.aiSummary.trim().length > 0)
        ?.aiSummary?.trim() ?? "";

    const strengths = collectFromCategorySummary(reviews, "strengths");
    const concerns = collectFromCategorySummary(reviews, "concerns");

    return {
      name: v.name,
      summary,
      strengths,
      concerns,
      reviewCount,
    };
  });
}

function collectFromCategorySummary(
  reviews: ReadonlyArray<{ categorySummary: unknown }>,
  field: "strengths" | "concerns",
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of reviews) {
    const cs = r.categorySummary;
    if (cs === null || typeof cs !== "object") continue;
    const arr = (cs as Record<string, unknown>)[field];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      if (trimmed.length === 0) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

/**
 * Deterministic fallback used when Claude is unavailable or
 * returned malformed JSON. Mirrors the safety net pattern in
 * `getMatrixInsight` so the surface always renders something
 * useful instead of disappearing on AI outages.
 *
 * The fallback intentionally avoids inventing cross-venue claims
 * the data doesn't support — `commonConcerns` is empty, the
 * `divergence` lane just states each venue's first listed strength,
 * and `decisionHint` is a generic visit-prompt. Couples reading the
 * fallback see "AI is taking a break, here's the data we have"
 * rather than a hallucinated synthesis.
 */
function templateInsight(
  input: MatrixReviewInsightInput,
): MatrixReviewInsight {
  const divergence: string[] = [];
  for (const v of input.venues) {
    const top = v.strengths[0];
    if (top) {
      divergence.push(`${v.name} の口コミでは「${top}」が目立ちます`);
    }
  }

  const decisionHint =
    "次の見学では、口コミで気になった点をその場で式場担当者に確認してみましょう";

  return {
    commonConcerns: [],
    divergence: divergence.slice(0, 3),
    decisionHint,
    fallback: true,
  };
}

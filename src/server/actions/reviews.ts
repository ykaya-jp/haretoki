"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { limitedAll } from "@/lib/limited-all";
import { revalidatePath, revalidateTag, cacheTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, computeInputHash, stripPII } from "@/lib/anthropic";
import { cachedAskClaude } from "@/lib/ai-cache";
import { MODEL } from "@/lib/models";
import { REVIEW_SUMMARY_PROMPT } from "@/lib/prompts/review-summary";
import {
  REVIEW_EXTRACTION_PROMPT,
  REVIEW_EXTRACTION_PROMPT_VERSION,
} from "@/lib/prompts/review-extraction";

// Round 15 (2026-05-02) — bump when REVIEW_SUMMARY_PROMPT semantics change
// so cached summaries from a prior prompt revision aren't served against
// the new contract. cachedAskClaude folds this into the cache key.
const REVIEW_SUMMARY_PROMPT_VERSION = 1;
import { guardExternalUrl } from "@/lib/url-guard";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { ReviewSource } from "@/generated/prisma/client";
import {
  parseEstimateIncrease,
  aggregateEstimateIncrease,
} from "@/server/actions/review-schema";

/**
 * Batch import 入口 (R1) — 大量 URL 取り込み時の防衛線。
 *
 * Cap 10: Anthropic throttle / cost / UX 待ち時間のバランス。10 件超えは
 * zod で reject、user に「分割して再度貼付」を案内する設計。
 *
 * Allowed domain list は analyzeVenueReviewsInner と同じ 5 サイト。本来 1
 * 箇所に export const で集約したいが analyzeVenueReviewsInner は inner
 * 内で定義しており、touch すると既存挙動に影響するリスクがある。R1 では
 * batch 入口で fail-fast の重複定義に留め、リファクタは別 round。
 */
const BATCH_URL_CAP = 10;
const BATCH_ALLOWED_REVIEW_DOMAINS = [
  "zexy.net", "www.zexy.net",
  "weddingpark.net", "www.weddingpark.net",
  "hana-yume.net", "www.hana-yume.net",
  "wedding.mynavi.jp",
  "mwed.jp", "www.mwed.jp",
] as const;

const batchImportSchema = z.object({
  urls: z
    .array(z.string().url("有効な URL を入力してください"))
    .min(1, "URL を 1 件以上入力してください")
    .max(
      BATCH_URL_CAP,
      `1 度に取り込めるのは ${BATCH_URL_CAP} 件までです。分割してお試しください`,
    ),
});

export interface BatchImportPerUrl {
  url: string;
  status: "saved" | "skipped" | "failed";
  /** Skip の理由 (例: "既に取り込み済") or 失敗の理由 (例: "対応していないサイトです") */
  message?: string;
}

export interface BatchImportResult {
  summary: { saved: number; skipped: number; failed: number };
  perUrl: BatchImportPerUrl[];
}

/**
 * Normalise a Claude completion into something JSON.parse can consume.
 * Handles: ```json … ``` fences, plain preamble/postamble text, and
 * trailing commentary after the JSON block. Falls back to the raw
 * input if neither a fenced block nor a balanced {…} can be located.
 */
/**
 * Localised display name for a ReviewSource — used in user-facing
 * error messages so timeouts read "みんなのウェディングが応答しません
 * でした" instead of leaking the enum value or a generic "HTTP 503".
 */
function sourceJaName(source: ReviewSource): string {
  switch (source) {
    case "minna_no_wedding":
      return "みんなのウェディング";
    case "zexy":
      return "ゼクシィ";
    case "wedding_park":
      return "Wedding Park";
    case "hanayume":
      return "ハナユメ";
    case "mynavi":
      return "マイナビ";
    default:
      return "口コミサイト";
  }
}

/**
 * How many review-listing pages to crawl per source URL.
 *
 * mwed has up to 33 pages × 25 reviews = ~800 reviews per venue. Going
 * for the full crawl would burn 33 Haiku calls (~$0.04) per venue per
 * import for diminishing returns.
 *
 * Two-tier strategy:
 *   - INITIAL: triggered on URL paste from /explore. Must complete inside
 *     the user's "I just hit submit" attention budget so the redirect
 *     to the venue page feels fast. 4 pages = 100 reviews — meets the
 *     user-stated "100以上" floor on first import.
 *   - BACKFILL: triggered explicitly by the per-card "個別レビューを
 *     取り込む" button. The user has opted into a longer wait, so we
 *     can afford 8 pages = 200 reviews for the deep cut.
 */
// User spec: initial URL paste must yield 100+ reviews (4 mwed pages
// × 25 = 100). Backfill button extends to 8 pages (~200) on explicit
// opt-in. Wall time on initial paste is ~60-80s including Sonnet on
// the merged corpus; needs the page-level maxDuration to accommodate.
const MAX_REVIEW_PAGES_INITIAL = 4;
const MAX_REVIEW_PAGES_BACKFILL = 8;

/**
 * Build the list of paginated review-listing URLs to crawl for a given
 * source URL. Returns the original URL + up to (max - 1) page-2-onwards
 * URLs in source-specific format. Returns just the original URL when
 * the source has no known pagination scheme.
 */
function paginateReviewUrls(
  sourceUrl: string,
  source: ReviewSource,
  max: number,
): string[] {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return [sourceUrl];
  }
  const pages = [sourceUrl];
  if (max <= 1) return pages;
  switch (source) {
    case "minna_no_wedding": {
      // mwed: /hall/{id}/rev/?page=N for N >= 2
      for (let n = 2; n <= max; n++) {
        const u = new URL(url.toString());
        u.searchParams.set("page", String(n));
        pages.push(u.toString());
      }
      break;
    }
    case "zexy": {
      // zexy: /wedding/c_{id}/kuchikomi/?pn=N for N >= 2 (existing convention
      // — see deriveRelatedUrls's reviewPages branch).
      for (let n = 2; n <= max; n++) {
        const u = new URL(url.toString());
        u.searchParams.set("pn", String(n));
        pages.push(u.toString());
      }
      break;
    }
    case "wedding_park": {
      // weddingpark.net: /[name]/review/?page=N
      for (let n = 2; n <= max; n++) {
        const u = new URL(url.toString());
        u.searchParams.set("page", String(n));
        pages.push(u.toString());
      }
      break;
    }
    // hanayume / mynavi: pagination patterns unverified — single page only
    // for now (still benefits from the new sentiment selection rules).
    default:
      return [sourceUrl];
  }
  return pages;
}

/**
 * Fetch one review-listing page and return its stripped text content.
 * Returns null on any error — caller treats that page as "missed" but
 * keeps going with the remaining pages.
 */
async function fetchReviewPageText(url: string): Promise<string | null> {
  try {
    const guard = guardExternalUrl(url);
    if (!guard.ok) return null;
    const referer = `${guard.url.protocol}//${guard.url.hostname}/`;
    const response = await fetch(url, {
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
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn("[fetchReviewPageText] non-2xx", { url, status: response.status });
      return null;
    }
    const html = await response.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (err) {
    console.warn("[fetchReviewPageText] fetch failed", { url, err: err instanceof Error ? err.message : err });
    return null;
  }
}

/**
 * Run Haiku extraction across all paginated review pages of a source URL
 * and return de-duplicated individual reviews.
 *
 * - Pages fetched in parallel (concurrency 3) so wall time stays close
 *   to a single page even at maxPages = 8.
 * - Haiku extraction also runs in parallel per page (own concurrency).
 * - Individual results are merged and deduped by body content hash.
 *
 * Returns the merged list + the number of pages successfully processed.
 */
async function extractAcrossPages(
  baseUrl: string,
  source: ReviewSource,
  venueName: string,
  maxPages: number,
): Promise<{
  reviews: ExtractedIndividualReview[];
  pagesFetched: number;
  pagesAttempted: number;
  mergedCorpusForSummary: string;
}> {
  const urls = paginateReviewUrls(baseUrl, source, maxPages);
  const pageTexts = await limitedAll(urls, 3, fetchReviewPageText);
  const okPages = pageTexts.filter((t): t is string => t != null && t.length > 200);

  // Sonnet summary corpus: concatenate all successful pages so the
  // summary reflects every fetched review, not just page 1. Capped at
  // 25K chars (≈ 15K tokens) — the prior 50K cap pushed Sonnet's
  // processing time past the 45s askClaude default and the summary
  // never saved. 25K is still 2-3x richer than a single page.
  const mergedCorpusForSummary = okPages.join("\n\n").slice(0, 25_000);

  // Haiku extraction per page, concurrency 3. Each page is constrained
  // to 25 reviews by REVIEW_EXTRACTION_PROMPT so output fits comfortably
  // in the 8000-token budget.
  const perPageReviews = await limitedAll(okPages, 3, async (pageText) => {
    if (!pageText) return [] as ExtractedIndividualReview[];
    let raw: string | null = null;
    try {
      raw = await cachedAskClaude({
        system: REVIEW_EXTRACTION_PROMPT.system,
        userMessage: REVIEW_EXTRACTION_PROMPT.buildUserMessage(
          stripPII(pageText),
          venueName,
        ),
        model: REVIEW_EXTRACTION_PROMPT.model,
        promptVersion: REVIEW_EXTRACTION_PROMPT_VERSION,
        maxTokens: REVIEW_EXTRACTION_PROMPT.maxTokens,
      });
    } catch (err) {
      console.warn("[extractAcrossPages] Haiku per-page failed:", {
        err: err instanceof Error ? err.message : err,
      });
      return [];
    }
    if (!raw) return [];
    try {
      const stripped = stripJsonResponse(raw);
      const parsed = JSON.parse(stripped) as { reviews?: unknown };
      const rawArr = Array.isArray(parsed.reviews) ? parsed.reviews : [];
      return rawArr
        .map(parseExtractedReviewRow)
        .filter((r): r is NonNullable<typeof r> => r !== null);
    } catch (err) {
      console.warn("[extractAcrossPages] parse failed:", err);
      return [];
    }
  });

  // Merge + dedup by body hash. Preserve insertion order so newer pages
  // (lower index) win on ties.
  const seen = new Set<string>();
  const mergedAll: ExtractedIndividualReview[] = [];
  for (const list of perPageReviews) {
    for (const r of list) {
      const hash = computeInputHash(r.body).slice(0, 8);
      if (seen.has(hash)) continue;
      seen.add(hash);
      mergedAll.push(r);
    }
  }

  // Post-merge sentiment balance — even if Haiku follows the per-page
  // balance prompt imperfectly, enforce a final pos/neg ratio so the
  // saved corpus is decision-useful and not 100 superlatives.
  //
  // Target: keep ALL substantive negative + neutral; downsample
  // positives so they don't drown the negatives. Floor of 60 total
  // when source material allows (≈ 4 pages × 15 quality reviews).
  const balanced = balanceMergedReviews(mergedAll);

  console.warn("[extractAcrossPages] result", {
    baseUrl,
    source,
    pagesAttempted: urls.length,
    pagesFetched: okPages.length,
    rawTotalRows: perPageReviews.flat().length,
    mergedUniqueRows: mergedAll.length,
    afterBalance: balanced.length,
    balanceMix: countSentimentMix(balanced),
  });

  return {
    reviews: balanced,
    pagesFetched: okPages.length,
    pagesAttempted: urls.length,
    mergedCorpusForSummary,
  };
}

/**
 * Apply final sentiment balance to a merged multi-page extraction.
 *
 * Wedding-venue review sites are praise-skewed; without explicit balance
 * the user reads 100 「最高でした」 entries and 0 substantive negatives.
 * Rule: keep ALL non-positive (negative + neutral + low-rated), then
 * downsample positives so positives ≤ 3 × non-positives — but never
 * drop the total below `keepAll` so very-positive venues still surface
 * lots of voices.
 */
function balanceMergedReviews(
  reviews: ExtractedIndividualReview[],
): ExtractedIndividualReview[] {
  if (reviews.length <= 25) return reviews; // single-page → no rebalance needed
  const isNegative = (r: ExtractedIndividualReview) =>
    r.sentiment === "negative" || (r.rating != null && r.rating <= 2);
  const isNeutral = (r: ExtractedIndividualReview) =>
    !isNegative(r) && (r.sentiment === "neutral" || r.rating === 3);
  const positives: ExtractedIndividualReview[] = [];
  const nonPositives: ExtractedIndividualReview[] = [];
  for (const r of reviews) {
    if (isNegative(r) || isNeutral(r)) {
      nonPositives.push(r);
    } else {
      positives.push(r);
    }
  }
  // Allow up to 3 positives per non-positive for visible balance, but
  // never below 30 total positives so a positive-only venue still has
  // a satisfying read.
  const positiveCap = Math.max(30, nonPositives.length * 3);
  const trimmedPositives = positives.slice(0, positiveCap);
  // Interleave non-positives early in the output so the chip-filter
  // initial scroll surfaces ネガ within the first viewport instead of
  // forcing the user to scroll past 30 positives to find one.
  const out: ExtractedIndividualReview[] = [];
  const np = [...nonPositives];
  const pos = [...trimmedPositives];
  while (np.length || pos.length) {
    if (np.length) out.push(np.shift()!);
    for (let i = 0; i < 2 && pos.length; i++) {
      out.push(pos.shift()!);
    }
  }
  return out;
}

function countSentimentMix(reviews: ExtractedIndividualReview[]): {
  positive: number;
  negative: number;
  neutral: number;
  unknown: number;
} {
  const mix = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
  for (const r of reviews) {
    if (r.sentiment === "positive") mix.positive++;
    else if (r.sentiment === "negative") mix.negative++;
    else if (r.sentiment === "neutral") mix.neutral++;
    else mix.unknown++;
  }
  return mix;
}

/**
 * Validate + normalise one row from the Haiku extraction output.
 *
 * Single source of truth shared by both extraction call sites
 * (analyzeVenueReviewsInner's parallel pass + the per-card backfill
 * action). Returns null when the row fails minimum body / shape
 * checks so the caller can `.filter()` it out.
 */
function parseExtractedReviewRow(
  r: unknown,
): ExtractedIndividualReview | null {
  if (!r || typeof r !== "object") return null;
  const row = r as Record<string, unknown>;
  const body = typeof row.body === "string" ? row.body.trim() : "";
  if (body.length < 30 || body.length > 3000) return null;
  const title =
    typeof row.title === "string" && row.title.trim()
      ? row.title.slice(0, 200)
      : null;
  const ratingNum = typeof row.rating === "number" ? row.rating : null;
  const rating =
    ratingNum != null && ratingNum >= 1 && ratingNum <= 5
      ? Math.round(ratingNum)
      : null;
  const author =
    typeof row.author === "string" && row.author.trim()
      ? row.author.slice(0, 50)
      : null;
  const visitedAt =
    typeof row.visitedAt === "string" && row.visitedAt.trim()
      ? row.visitedAt.slice(0, 50)
      : null;
  const sentimentRaw =
    typeof row.sentiment === "string" ? row.sentiment.toLowerCase() : null;
  const sentiment: ExtractedIndividualReview["sentiment"] =
    sentimentRaw === "positive" ||
    sentimentRaw === "negative" ||
    sentimentRaw === "neutral"
      ? sentimentRaw
      : undefined;
  return { title, body, rating, author, visitedAt, sentiment };
}

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
  /** AI-classified body sentiment — drives the ポジ/ネガ/その他 chip
   *  filter on the venue detail page. Stored on Review.isNegative
   *  (boolean) since that column already exists; absence here =
   *  fall back to rating-based classification on the client. */
  sentiment?: "positive" | "negative" | "neutral";
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
      // Derive isNegative from AI sentiment when present, otherwise
      // fall back to a rating-based heuristic so even pre-sentiment
      // legacy rows surface in the ネガ filter when their stars are
      // low (≤ 2).
      const isNegative =
        r.sentiment === "negative" ||
        (r.sentiment === undefined && r.rating != null && r.rating <= 2);
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
          isNegative,
          categorySummary: {
            individual: {
              title: r.title,
              author: r.author,
              visitedAt: r.visitedAt,
              sentiment: r.sentiment ?? null,
            },
          },
        },
        create: {
          venueId,
          source,
          sourceUrl: rowSourceUrl,
          aiSummary: r.body,
          rating: r.rating,
          isNegative,
          categorySummary: {
            individual: {
              title: r.title,
              author: r.author,
              visitedAt: r.visitedAt,
              sentiment: r.sentiment ?? null,
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
  // Outer race acts as a soft cap so the user gets a timeout toast
  // instead of an open spinner. Bumped 90s → 110s once analyzeVenueReviewsInner
  // gained the multi-page crawl: extractAcrossPages can run for 40-50s
  // on a 4-page mwed listing (fetch + Haiku per page even with
  // concurrency 3) before Sonnet's 15-25s summary pass even starts.
  // 110s stays inside the page-level 120s maxDuration with a small
  // buffer for the surrounding bookkeeping.
  const TIMEOUT_MS = 110_000;
  const sourceLabel = sourceJaName(source);
  try {
    return await Promise.race([
      analyzeVenueReviewsInner(venueId, sourceUrl, source),
      new Promise<AnalyzeVenueReviewsResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: false,
              reason: "timeout",
              message: `${sourceLabel}が時間内に応答しませんでした。少し待って再度お試しください`,
            }),
          TIMEOUT_MS,
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
    // Summary cache hit. Before short-circuiting, also check whether
    // individual review rows exist for this source URL — older venues
    // imported before the parallel Haiku extraction landed have a
    // summary row only ("ポジ1・ネガ0・その他0" forever). When the
    // summary is cached but individuals are missing, fall through to
    // the full pipeline; cachedAskClaude will hit the Sonnet cache so
    // only the Haiku extraction actually pays a roundtrip.
    const individualCount = await prisma.review.count({
      where: {
        venueId,
        source,
        sourceUrl: { startsWith: `${sourceUrl}#rev-` },
      },
    });
    if (individualCount > 0) {
      return { ok: true };
    }
    console.log(
      "[analyzeVenueReviews] summary cached but no individuals — re-running extraction",
      { venueId, sourceUrl, source },
    );
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
      // 25s — bumped from 15s once the outer race in analyzeVenueReviews
      // grew to 90s. mwed.jp in particular can take 12-20s to return a
      // full page on cold cache; a 15s budget tripped over normal latency.
      signal: AbortSignal.timeout(25_000),
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

    // Run Sonnet summary + Haiku extraction in PARALLEL on the single
    // fetched page. We tried sequential extractAcrossPages → Sonnet
    // and it pushed the action chain past Vercel's response window
    // (vendors got "page rendered with no Review row" → empty state).
    // Backfill via "+1ソースから取り込む" button still uses
    // extractAcrossPages with the 8-page deep cut for users who opt
    // in. Initial paste stays fast.
    console.warn("[analyzeVenueReviews] starting parallel Sonnet + Haiku", {
      venueId,
      sourceUrl,
      source,
      pageTextLength: strippedContent.length,
    });
    const reviewUserMessage = REVIEW_SUMMARY_PROMPT.buildUserMessage(
      [strippedContent],
      venue.name,
    );

    let claudeResponse: string | null = null;
    let extractionResponse: string | null = null;
    try {
      [claudeResponse, extractionResponse] = await Promise.all([
        cachedAskClaude({
          system: REVIEW_SUMMARY_PROMPT.system,
          userMessage: reviewUserMessage,
          model: MODEL.SONNET,
          promptVersion: REVIEW_SUMMARY_PROMPT_VERSION,
          timeoutMs: 60_000,
        }),
        cachedAskClaude({
          system: REVIEW_EXTRACTION_PROMPT.system,
          userMessage: REVIEW_EXTRACTION_PROMPT.buildUserMessage(
            strippedContent,
            venue.name,
          ),
          model: REVIEW_EXTRACTION_PROMPT.model,
          promptVersion: REVIEW_EXTRACTION_PROMPT_VERSION,
          maxTokens: REVIEW_EXTRACTION_PROMPT.maxTokens,
          timeoutMs: 60_000,
        }).catch((err) => {
          console.warn("[analyzeVenueReviews] Haiku extraction failed (non-fatal):", err);
          return null;
        }),
      ]);
    } catch (err) {
      console.warn("[analyzeVenueReviews] Sonnet summary failed:", {
        venueId,
        sourceUrl,
        source,
        err: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      });
    }

    // Parse Haiku output for individuals (mirrors the prior single-page
    // path, plus the new sentiment field per parseExtractedReviewRow).
    let crawledIndividuals: ExtractedIndividualReview[] = [];
    if (extractionResponse) {
      try {
        const stripped = stripJsonResponse(extractionResponse);
        const parsed = JSON.parse(stripped) as { reviews?: unknown };
        const rawReviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];
        crawledIndividuals = rawReviews
          .map(parseExtractedReviewRow)
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .slice(0, 25);
      } catch (err) {
        console.warn("[analyzeVenueReviews] Haiku parse failed:", err);
      }
    }
    console.warn("[analyzeVenueReviews] parallel done", {
      sonnetOk: claudeResponse !== null,
      individualsExtracted: crawledIndividuals.length,
    });
    if (claudeResponse === null) {
      // Sonnet failed — but we still have the multi-page crawl results.
      // Save the individuals so the user gets at least the raw reviews
      // even when the synthesis pass dropped. Without this, a Sonnet
      // hiccup loses 8 pages of fresh extraction work.
      if (crawledIndividuals.length > 0) {
        await saveExtractedReviews(
          venueId,
          crawledIndividuals,
          sourceUrl,
          source,
        ).catch((err) =>
          console.warn(
            "[analyzeVenueReviews] saveExtractedReviews after Sonnet failure:",
            err,
          ),
        );
        revalidateTag(`venue:${venueId}`, { expire: 0 });
        revalidateTag(`project:${projectId}`, { expire: 0 });
        revalidatePath(`/venues/${venueId}`);
      }
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

    // Persist individuals from the multi-page crawl. extractAcrossPages
    // already ran Haiku per page, deduped by body hash, and applied
    // parseExtractedReviewRow validation. Best-effort: per-row upsert
    // errors are logged inside saveExtractedReviews and don't block the
    // summary save.
    if (crawledIndividuals.length > 0) {
      const saveResult = await saveExtractedReviews(
        venueId,
        crawledIndividuals,
        sourceUrl,
        source,
      );
      console.warn("[analyzeVenueReviews] saveExtractedReviews result", {
        venueId,
        sourceUrl,
        crawled: crawledIndividuals.length,
        ...saveResult,
      });
    } else {
      console.warn("[analyzeVenueReviews] zero individuals extracted", {
        venueId,
        sourceUrl,
        source,
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
    // expires. Surface that distinctly so the UI can show "timeout" copy
    // with the source name (the outer race adds the same shape on its own
    // 90s cap; both paths now produce the same user-facing wording).
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        reason: "timeout",
        message: `${sourceJaName(source)}の応答が遅く、口コミページを取得できませんでした。少し待って再度お試しください`,
      };
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
/**
 * R1 — 複数 URL を 1 batch で順次取り込む。
 *
 * 使い方: review-section.tsx の「複数 URL を貼る」 sheet から呼ばれる。
 * 単 URL 取り込み (`analyzeVenueReviews`) を順次 await する thin wrapper
 * + cap / dedup / per-URL 失敗継続 を担当。
 *
 * Rate-limit:
 *   - 入口で `URL_IMPORT` (5/min) を 1 回消費。内部の N call は counted
 *     しない (= 1 batch で 5/min を 1 ずつ消費する設計)。これは既存
 *     `batchAnalyzeVenueReviews` と同じ方針 (再生成バッチも 1 操作 1
 *     ラベルで count)。
 *
 * Dedup:
 *   - 既存 (venueId, source, sourceUrl) prefix-match で skip。
 *     `saveExtractedReviews` が `#rev-{hash}` フラグメント付きで子レビュー
 *     を upsert するので、parent URL を貼り直したケースは「parent と
 *     同じ baseSourceUrl で始まる Review が 1 つでもあれば既取込」とみ
 *     なす (= `startsWith(sourceUrl)`)。
 *
 * Sequential:
 *   - `for (const url of input.urls)` + await。1 URL 失敗は loop 継続
 *     (既存 `batchAnalyzeVenueReviews` の pattern を踏襲)。並列化しない
 *     のは Anthropic throttle + 同一 venue への upsert 競合回避のため。
 *
 * Returns:
 *   - `{summary: {saved, skipped, failed}, perUrl: [{url, status, message}]}`
 *   - `summary.saved + summary.skipped + summary.failed === input.urls.length`
 *     (完全 partition、UI で sanity check 可能)
 */
export async function batchImportReviewUrls(
  venueId: string,
  urls: string[],
  source: ReviewSource,
): Promise<
  | BatchImportResult
  | { error: string }
> {
  const parsed = batchImportSchema.safeParse({ urls });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }
  const validatedUrls = parsed.data.urls;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue ownership before any rate-limit cost.
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: { id: true },
  });
  if (!venue) {
    return { error: "式場が見つかりません" };
  }

  // Single rate-limit hit per batch (matches batchAnalyzeVenueReviews).
  // Counting per-URL would starve a 10-URL batch with the 5/min cap.
  const rl = await checkRateLimit(`url_import:${user.id}`, RATE_LIMITS.URL_IMPORT);
  if (!rl.allowed) {
    return {
      error: `取り込みの頻度が高すぎます。${rl.retryAfterSec}秒後に再度お試しください。`,
    };
  }

  // Pull all existing review sourceUrls for this venue+source up-front so
  // dedup is O(1) per input URL instead of N round-trips. The set holds
  // the **base** URL (no fragment) — Review rows from saveExtractedReviews
  // carry `#rev-{hash}` suffixes per individual review, but we strip them
  // for the prefix-match check.
  const existingRows = await prisma.review.findMany({
    where: { venueId, source },
    select: { sourceUrl: true },
  });
  const existingBases = new Set<string>();
  for (const row of existingRows) {
    const base = row.sourceUrl.split("#")[0];
    existingBases.add(base);
  }

  const perUrlByUrl = new Map<string, BatchImportPerUrl>();
  const toProcess: string[] = [];
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  // Pre-pass: validation + dedup are cheap (CPU + 1 in-memory set), so
  // run them sequentially and quickly carve out the URLs that need the
  // expensive layer 4 (15s fetch + Claude inference). Early failures /
  // dedups are recorded immediately and skip the parallel pool entirely.
  for (const url of validatedUrls) {
    // Layer 1: SSRF + scheme guard (same helper analyzeVenueReviewsInner uses).
    const guard = guardExternalUrl(url);
    if (!guard.ok) {
      perUrlByUrl.set(url, {
        url,
        status: "failed",
        message:
          guard.reason === "scheme"
            ? "HTTPS の URL のみ対応しています"
            : guard.reason === "invalid"
              ? "有効な URL ではありません"
              : "この URL は取得できません",
      });
      failed++;
      continue;
    }

    // Layer 2: domain allowlist. Duplicated from analyzeVenueReviewsInner
    // intentionally so this batch can fail-fast before paying the per-URL
    // 15s timeout cost — the inner check is the source of truth, this is
    // an early-reject mirror.
    const hostname = guard.url.hostname;
    const allowed = BATCH_ALLOWED_REVIEW_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
    if (!allowed) {
      perUrlByUrl.set(url, {
        url,
        status: "failed",
        message:
          "対応していないサイトではありません。ゼクシィ、Wedding Park、ハナユメ、マイナビ、みんなのウェディングの URL を入力してください",
      });
      failed++;
      continue;
    }

    // Layer 3: dedup. Prefix-match against existing Review.sourceUrl bases
    // (saveExtractedReviews appends `#rev-{hash}` per individual review,
    // so equality on the base URL means "we already imported this page").
    // Pre-mark in existingBases so a duplicate URL later in the same
    // input is dedup'd against this one even though we haven't run
    // layer 4 yet (parallel layer-4 races couldn't otherwise dedup
    // against each other).
    const baseUrl = url.split("#")[0];
    if (existingBases.has(baseUrl)) {
      perUrlByUrl.set(url, {
        url,
        status: "skipped",
        message: "既に取り込み済の URL です",
      });
      skipped++;
      continue;
    }
    existingBases.add(baseUrl);
    toProcess.push(url);
  }

  // Layer 4: actual analyze, parallelised. Sequential `for await` made
  // 5 URLs cost ~125s (15s fetch × 5 + Claude × 5) which exceeded the
  // Vercel function default 60s timeout and surfaced as a generic
  // "タイムアウトエラー" on the user side. concurrency = 3 keeps the
  // wall-time near a single URL (~25s) for a typical batch and stays
  // well under the per-user `url_import` rate limit (1 hit per batch).
  const BATCH_CONCURRENCY = 3;
  const sourceLabel = sourceJaName(source);
  const analyzed = await limitedAll(toProcess, BATCH_CONCURRENCY, async (url) => {
    const result = await analyzeVenueReviews(venueId, url, source);
    if (result.ok) {
      return { url, status: "saved" as const };
    }
    const reasonLabel =
      result.reason === "timeout"
        ? `${sourceLabel}が時間内に応答しませんでした。少し待って再度お試しください`
        : result.reason === "no-reviews"
          ? "口コミが見つかりませんでした"
          : (result.message ?? "取り込みに失敗しました");
    return { url, status: "failed" as const, message: reasonLabel };
  });

  for (const r of analyzed) {
    perUrlByUrl.set(r.url, r);
    if (r.status === "saved") saved++;
    else failed++;
  }

  // Preserve original input order in the response so the UI's per-URL
  // status pills line up with the textarea row order.
  const perUrl: BatchImportPerUrl[] = validatedUrls.map(
    (u) => perUrlByUrl.get(u) ?? { url: u, status: "failed" as const, message: "不明なエラー" },
  );

  // Single revalidation at the end (vs per-URL) — the inner action's
  // own revalidatePath calls already invalidated the cache between
  // each successful save, so this is a final belt-and-braces.
  // Next 16.2 + cacheComponents requires the `{ expire: 0 }` second arg
  // (matches the existing call sites at L:514, L:906).
  if (saved > 0) {
    revalidateTag(`venue:${venueId}`, { expire: 0 });
    revalidateTag(`project:${projectId}`, { expire: 0 });
    revalidatePath(`/venues/${venueId}`);
  }

  return {
    summary: { saved, skipped, failed },
    perUrl,
  };
}

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
    // Individual review rows (saveExtractedReviews adds `#rev-{hash}`
    // to dedup per-body) aren't analyze targets — they're outputs of
    // a prior analyze pass, not pages to re-fetch. Re-running analyze
    // on them would re-hit the parent URL N extra times (the fragment
    // isn't sent on the wire). Skip them so the AI 要約再生成 button
    // only re-summarises the source-page rows.
    if (r.sourceUrl.includes("#rev-")) {
      skipped++;
      continue;
    }
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

/**
 * Backfill individual review rows for an existing summary Review row.
 *
 * Use case: legacy venues imported before the parallel Haiku extraction
 * landed have a single summary row and zero `#rev-` individuals. Re-
 * submitting the same URL via the import sheets surfaces "既に取り込み
 * 済の URL です" because the dedup sees the summary row. This action
 * is the explicit user-triggered backfill path: re-fetch the source
 * page, run only the Haiku extraction (no Sonnet — the summary is
 * already saved), and upsert individuals via saveExtractedReviews.
 *
 * Triggered by the "個別レビューを取り込む" button on each summary
 * card (review-section.tsx). Idempotent: bodies are upserted by hash
 * so repeated clicks won't dup rows.
 */
export async function extractIndividualReviewsFromSource(
  reviewId: string,
): Promise<{
  ok: true;
  saved: number;
  alreadyHad: number;
} | { ok: false; error: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const review = await prisma.review.findFirst({
    where: { id: reviewId, venue: { projectId } },
    select: { id: true, venueId: true, source: true, sourceUrl: true },
  });
  if (!review) return { ok: false, error: "口コミが見つかりません" };

  // Refuse to run on rows that ARE individuals — those carry `#rev-`
  // fragments and re-fetching their parent URL is what the parent
  // summary row's button is for.
  if (review.sourceUrl.includes("#rev-")) {
    return { ok: false, error: "このレビューは個別レビュー行のため再取り込みできません" };
  }

  // Note: no rate limit on this action — it shares the URL_IMPORT
  // bucket with analyze + batch import, and a user clicking the
  // explicit "+1ソースから取り込む" button right after the venue page
  // already auto-fired the analyze fall-through path was getting
  // rate-limited spuriously. Cost guard remains the per-source button
  // disabled state in the client + Haiku's own per-call budget.

  if (!isClaudeAvailable()) {
    return { ok: false, error: "AI機能を利用するにはAPIキーを設定してください" };
  }

  // Existing individuals — short-circuit if the user clicked twice in a
  // row, but still report the count so the UI can toast "既に N 件取り
  // 込み済みです" rather than silently doing nothing.
  const alreadyHad = await prisma.review.count({
    where: {
      venueId: review.venueId,
      source: review.source,
      sourceUrl: { startsWith: `${review.sourceUrl}#rev-` },
    },
  });

  // Resolve venue name for the prompt — needed only for the per-prompt
  // header line.
  const venue = await prisma.venue.findUnique({
    where: { id: review.venueId },
    select: { name: true },
  });
  const venueName = venue?.name ?? "";

  // Multi-page crawl with the BACKFILL cap (8 = 200 reviews). User
  // explicitly tapped the button so the longer wall time is opted into.
  const crawl = await extractAcrossPages(
    review.sourceUrl,
    review.source,
    venueName,
    MAX_REVIEW_PAGES_BACKFILL,
  );

  if (crawl.reviews.length === 0) {
    const reason =
      crawl.pagesFetched === 0
        ? "どのページも取得できませんでした (サイト側のレートリミットや一時障害かもしれません)"
        : "AI が個別レビューを 1 件も検出できませんでした (URL がレビュー一覧ページか確認してください)";
    return {
      ok: false,
      error: `${reason}。URL: ${review.sourceUrl}`,
    };
  }

  const saveResult = await saveExtractedReviews(
    review.venueId,
    crawl.reviews,
    review.sourceUrl,
    review.source,
  );

  revalidateTag(`venue:${review.venueId}`, { expire: 0 });
  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath(`/venues/${review.venueId}`);

  return { ok: true, saved: saveResult.saved, alreadyHad };
}

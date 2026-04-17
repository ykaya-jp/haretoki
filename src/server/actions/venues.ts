"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { venueSchema } from "@/server/actions/venue-schema";
import type { VenueInput } from "@/server/actions/venue-schema";
import type { VenueStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { askClaude, isClaudeAvailable, ClaudeCreditsError } from "@/lib/claude";
import { buildVenueWhere, type VenueFilters } from "@/server/actions/venue-filters";
import { computeCompositeScore } from "@/lib/venue-score";
import {
  extractMetadata,
  hasUsefulMetadata,
  buildMetadataPrompt,
} from "@/server/actions/url-metadata";
import { captureServerEvent } from "@/lib/analytics/server";
import { captureError } from "@/lib/sentry";
import { guardExternalUrl } from "@/lib/url-guard";
import type { ReviewSource } from "@/generated/prisma/client";

// --- Helpers ---

/** Infer ReviewSource from URL hostname, or return null if unrecognised. */
function reviewSourceFromUrl(url: string): ReviewSource | null {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("zexy.net")) return "zexy";
    if (hostname.includes("weddingpark.net")) return "wedding_park";
    if (hostname.includes("hana-yume.net")) return "hanayume";
    if (hostname.includes("mynavi.jp")) return "mynavi";
    if (hostname.includes("mwed.jp")) return "minna_no_wedding";
  } catch {
    // malformed URL — fall through
  }
  return null;
}

// --- Server actions ---

export async function createVenue(input: VenueInput) {
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.create({
    data: {
      projectId,
      name: parsed.data.name,
      location: parsed.data.location ?? null,
      accessInfo: parsed.data.accessInfo ?? null,
      capacityMin: parsed.data.capacityMin ?? null,
      capacityMax: parsed.data.capacityMax ?? null,
      ceremonyStyles: parsed.data.ceremonyStyles ?? [],
      sourceUrls: parsed.data.sourceUrls ?? [],
      photoUrls: parsed.data.photoUrls ?? [],
    },
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");

  await captureServerEvent(user.id, "venue_added", {
    venueId: venue.id,
    projectId,
    source: "manual",
  });

  return { success: true as const, venue };
}

export async function getVenues(filters?: VenueFilters) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Build where clause (pure helper — see buildVenueWhere for semantics)
  const where = buildVenueWhere(projectId, filters);

  // Build orderBy. For review_delta_asc we use Prisma's `{ sort, nulls }`
  // object form so venues lacking a review-derived aggregate sink to the
  // bottom rather than being excluded.
  let orderBy: Record<string, unknown> = { createdAt: "desc" };
  if (filters?.sortBy === "cost_asc") {
    orderBy = { costMin: "asc" };
  } else if (filters?.sortBy === "cost_desc") {
    orderBy = { costMax: "desc" };
  } else if (filters?.sortBy === "review_delta_asc") {
    orderBy = { reviewEstimateDeltaPct: { sort: "asc", nulls: "last" } };
  }

  const venues = await prisma.venue.findMany({
    where,
    include: {
      scores: {
        select: { dimension: true, score: true, source: true },
      },
      estimates: {
        select: {
          id: true,
          venueId: true,
          total: true,
          version: true,
          createdAt: true,
          items: { select: { amount: true } },
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy,
    take: 100,
  });

  let filtered = venues;

  // Post-query filter: latest estimate total <= budgetMax (if estimate exists)
  // Venues without estimates are kept (don't exclude — conditions are hints, not hard gates)
  if (filters?.budgetMax !== undefined) {
    const cap = filters.budgetMax;
    filtered = filtered.filter((venue) => {
      const latest = venue.estimates?.[0];
      if (!latest) return true;
      const total = latest.items.reduce((acc, it) => acc + Number(it.amount ?? 0), 0);
      if (total === 0) return true;
      return total <= cap;
    });
  }

  // Post-query filter for overall score (requires aggregation)
  if (filters?.minScore !== undefined) {
    filtered = filtered.filter((venue) => {
      const composite = computeCompositeScore(venue.scores);
      if (composite === null) return false;
      return composite >= (filters.minScore ?? 0);
    });
  }

  // Post-query filter for category-level score
  if (filters?.dimensionMinScore) {
    const { dimension, score } = filters.dimensionMinScore;
    filtered = filtered.filter((venue) => {
      const dimScore = venue.scores.find(
        (s) => s.dimension === dimension && s.source === "user_rating"
      );
      if (!dimScore) return false;
      return Number(dimScore.score) >= score;
    });
  }

  // Post-query sort for score (requires aggregation) — uses composite multi-source score
  if (filters?.sortBy === "score_desc") {
    return filtered.sort((a, b) => {
      const avgA = computeCompositeScore(a.scores);
      const avgB = computeCompositeScore(b.scores);
      return (avgB ?? 0) - (avgA ?? 0);
    });
  }

  // Per-category score sorts — null scores sink to bottom (nulls last)
  const CATEGORY_SORT_MAP: Record<string, string> = {
    score_cuisine_desc: "cuisine",
    score_hospitality_desc: "hospitality",
    score_atmosphere_desc: "atmosphere",
    score_cost_desc: "cost",
    score_access_desc: "access",
  };
  if (filters?.sortBy && filters.sortBy in CATEGORY_SORT_MAP) {
    const dim = CATEGORY_SORT_MAP[filters.sortBy];
    return filtered.sort((a, b) => {
      const scoreA = calcDimScore(a.scores, dim);
      const scoreB = calcDimScore(b.scores, dim);
      if (scoreA === null && scoreB === null) return 0;
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      return scoreB - scoreA;
    });
  }

  return filtered;
}

/** Returns the user_rating score for a specific dimension, or null if not rated. */
function calcDimScore(
  scores: Array<{ source: string; dimension: string; score: unknown }>,
  dimension: string,
): number | null {
  const s = scores.find((s) => s.source === "user_rating" && s.dimension === dimension);
  return s != null ? Number(s.score) : null;
}

export async function getVenue(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
    include: {
      scores: true,
      estimates: { include: { items: true }, orderBy: { version: "desc" } },
      visits: {
        include: {
          ratings: true,
          notes: { include: { media: true } },
          checklist: true,
        },
      },
    },
  });

  return venue;
}

/** Above-the-fold fields: name, location, photos, status, scores. */
export async function getVenueHeader(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.venue.findFirst({
    where: { id, projectId },
    select: {
      id: true,
      projectId: true,
      name: true,
      location: true,
      accessInfo: true,
      capacityMin: true,
      capacityMax: true,
      ceremonyStyles: true,
      photoUrls: true,
      status: true,
      scores: true,
      vibeTags: true,
    },
  });
}

/** Estimates + line items — below the fold, streamed via Suspense. */
export async function getVenueEstimates(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
    select: {
      estimates: { include: { items: true }, orderBy: { version: "desc" } },
    },
  });

  return venue?.estimates ?? [];
}

/** Visits + ratings, notes, checklist — below the fold, streamed via Suspense. */
export async function getVenueVisits(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
    select: {
      visits: {
        include: {
          ratings: true,
          notes: { include: { media: true } },
          checklist: true,
        },
      },
    },
  });

  return venue?.visits ?? [];
}

export async function updateVenueStatus(id: string, status: VenueStatus) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
  });
  if (!venue) throw new Error("式場が見つかりません");

  const updated = await prisma.venue.update({
    where: { id },
    data: { status },
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath(`/venues/${id}`);

  return updated;
}

/**
 * Upload photos for an existing venue (append to venue.photoUrls).
 * Also supports the pre-create flow (venueId = "temp") where URLs are just returned.
 */
export async function uploadVenuePhotos(
  venueIdOrFormData: string | FormData,
  maybeFormData?: FormData,
): Promise<{ success: boolean; urls?: string[]; droppedCount?: number; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Support both signatures:
  //   uploadVenuePhotos(formData)           — pre-create (old)
  //   uploadVenuePhotos(venueId, formData)  — append to existing venue (new)
  let venueId: string | null = null;
  let formData: FormData;
  if (typeof venueIdOrFormData === "string") {
    venueId = venueIdOrFormData;
    formData = maybeFormData!;
  } else {
    formData = venueIdOrFormData;
  }

  const files = formData.getAll("photos") as File[];
  if (files.length === 0) return { success: false, error: "写真が選択されていません" };
  if (files.length > 10) return { success: false, error: "一度にアップロードできるのは10枚までです" };

  // If appending to existing venue, verify ownership
  let venueForUpload: { id: string } | null = null;
  if (venueId) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, projectId },
      select: { id: true },
    });
    if (!venue) return { success: false, error: "式場が見つかりません" };
    venueForUpload = venue;
  }

  const { uploadVenuePhoto } = await import("@/lib/supabase/storage");

  const urls: string[] = [];
  let droppedCount = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      droppedCount++;
      continue;
    }
    if (file.size > 10 * 1024 * 1024) {
      droppedCount++;
      continue; // 10MB limit per file
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadVenuePhoto(buffer, file.name, projectId, venueId ?? "temp");
    urls.push(url);
  }

  // If venue exists, append URLs to photoUrls
  if (venueForUpload && urls.length > 0) {
    await prisma.venue.update({
      where: { id: venueForUpload.id },
      data: { photoUrls: { push: urls } },
    });
    revalidateTag(`project:${projectId}`, { expire: 0 });
    revalidatePath(`/venues/${venueForUpload.id}`);
  }

  return { success: true, urls, droppedCount };
}

// --- URL venue extraction (R1 only Claude API usage) ---

interface ExtractedVenueData {
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  estimatedPrice: number | null;
  features: string[];
  photoUrls: string[];
  confidence: "high" | "medium" | "low";
}

const extractedVenueSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().max(200).nullable(),
  accessInfo: z.string().max(500).nullable(),
  capacityMin: z.number().int().positive().nullable(),
  capacityMax: z.number().int().positive().nullable(),
  ceremonyStyles: z.array(z.string().max(50)).max(10),
  estimatedPrice: z.number().int().positive().nullable(),
  features: z.array(z.string().max(100)).max(20),
  photoUrls: z.array(z.string().url().max(1000)).max(20),
  confidence: z.enum(["high", "medium", "low"]),
});

const URL_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured wedding venue information from Japanese web page content.

Given raw HTML text content from a wedding venue page (Zexy, Wedding Park, Hanayume, Mynavi, etc.), extract the following information.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "<venue name in Japanese>",
  "location": "<area/address>",
  "accessInfo": "<nearest station and walking time>",
  "capacityMin": <number or null>,
  "capacityMax": <number or null>,
  "ceremonyStyles": ["チャペル" | "神前" | "人前" | "ガーデン"],
  "estimatedPrice": <estimated total in yen or null>,
  "features": ["<feature1>", "<feature2>"],
  "photoUrls": ["<url1>", "<url2>"],
  "confidence": "high" | "medium" | "low"
}

Guidelines:
- If a field cannot be determined, use null (not empty string)
- For price, look for "見積もり例", "お見積り", "挙式+披露宴" patterns
- For capacity, look for "着席" followed by number
- For ceremony styles, map to the enum values above
- photoUrls: prefer large venue/ceremony photos, skip thumbnails and icons
- confidence: "high" if major fields found, "medium" if some missing, "low" if minimal data

Note: The input may include OGP (og:title / og:description / og:image), Twitter Cards,
and JSON-LD (Schema.org Venue / LocalBusiness / Organization / Event) blocks in
addition to (or instead of) the main body text. Many Japanese wedding sites (e.g. Zexy)
are SPAs that leave the visible body empty server-side but populate these structured
fields for SEO. Treat OGP/JSON-LD as primary sources when they are present — the
"name", "address", "image", "telephone", "geo" fields from JSON-LD and the og:title /
og:description values are usually the most reliable signals.`;

/**
 * Strip optional ```json ... ``` markdown fences that Claude sometimes wraps JSON in,
 * even when explicitly instructed not to. Falls through to the original string when
 * no fence is detected.
 */
function extractJson(s: string): string {
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : s.trim();
}

export async function addVenueFromUrl(url: string): Promise<{
  extracted?: ExtractedVenueData;
  warning?: string;
  error?: string;
}> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください。手動で入力してください。" };
  }

  const guard = guardExternalUrl(url);
  if (!guard.ok) {
    if (guard.reason === "invalid") return { error: "有効な URL を入力してください" };
    if (guard.reason === "scheme") return { error: "https:// で始まる URL を入力してください" };
    return { error: "この URL は取得できません" };
  }

  try {
    // Use a realistic modern Chrome UA — upstream venue sites (especially Zexy)
    // serve a bot-challenge / 403 page to the generic "Haretoki/1.0" UA.
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        DNT: "1",
        Referer: "https://zexy.net/",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("addVenueFromUrl non-2xx:", { url, status: response.status });
      return {
        error: `ページを開けませんでした (HTTP ${response.status})。URL を見直すか、手動で入力してみてください。`,
      };
    }

    const html = await response.text();

    // Extract structured metadata (OGP / JSON-LD / Twitter / <title>) BEFORE the
    // body-stripping empty-check. SPA sites like Zexy leave the rendered body near-empty
    // but still populate these SEO signals — they often contain the venue name,
    // description, hero image, and even Schema.org Venue/LocalBusiness blobs.
    const metadata = extractMetadata(html);

    // Strip scripts, styles, and tags for the fallback body excerpt.
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const bodyIsShort = textContent.length < 500;
    const metadataIsUseful = hasUsefulMetadata(metadata);
    const usingMetadataPath = bodyIsShort || metadataIsUseful;

    // Only abort when BOTH the rendered body is empty AND no structured metadata
    // exists. Pre-fix, short body alone aborted — which made every Zexy URL fail.
    if (bodyIsShort && !metadataIsUseful) {
      console.error("addVenueFromUrl empty HTML and no metadata:", {
        url,
        textLength: textContent.length,
      });
      return {
        error:
          "ページの中身を読めませんでした (JavaScript 必須のページかもしれません)。手動で入力してみてください。",
      };
    }

    // Build the prompt payload. When metadata is available (always, for modern SPAs)
    // prefer the structured blob; fall back to raw body text when we have a full page.
    const prompt = usingMetadataPath
      ? buildMetadataPrompt(url, metadata, textContent)
      : `以下はURL ${url} から取得したウェブページの内容です。結婚式場の情報を構造化データとして抽出してください:\n\n${textContent.slice(0, 30000)}`;

    const claudeResponse = await askClaude(URL_EXTRACTION_SYSTEM_PROMPT, prompt);

    if (!claudeResponse) {
      return { error: "AI がうまく読めませんでした。手動で入力してみてください。" };
    }

    // Claude occasionally wraps JSON in markdown fences despite the system prompt.
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractJson(claudeResponse));
    } catch (parseErr) {
      console.error("addVenueFromUrl JSON parse failed:", {
        url,
        error: parseErr instanceof Error ? parseErr.message : parseErr,
        snippet: claudeResponse.slice(0, 200),
      });
      return {
        error: "ページの中身をうまく整理できませんでした。手動で入力してみてください。",
      };
    }

    const validated = extractedVenueSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("addVenueFromUrl schema validation failed:", {
        url,
        issues: validated.error.issues,
      });
      return {
        error: "ページの中身をうまく整理できませんでした。手動で入力してみてください。",
      };
    }

    // When the rendered body was empty, we only saw OGP/JSON-LD. Surface a warning
    // so the UI can nudge the user to verify or complete missing fields manually.
    const warning =
      bodyIsShort && metadataIsUseful
        ? "部分的な情報のみ読み取れました。手動で補完してください。"
        : undefined;

    return { extracted: validated.data, warning };
  } catch (error) {
    if (error instanceof ClaudeCreditsError) {
      return {
        error: "AI機能の利用枠を超えました。管理者にお問い合わせいただくか、手動で入力してください。",
      };
    }
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    console.error("addVenueFromUrl failed:", {
      url,
      error: error instanceof Error ? `${error.name}: ${error.message}` : error,
    });
    captureError(error, { action: "addVenueFromUrl", url });
    if (isAbort) {
      return {
        error: "読み込みに時間がかかりすぎました。手動で入力するか、URL を見直してください。",
      };
    }
    return { error: "式場情報をうまく取れませんでした。手動で入力してみてください。" };
  }
}

export async function confirmVenueFromUrl(
  extracted: ExtractedVenueData,
  sourceUrl: string
) {
  const parsed = extractedVenueSchema.safeParse(extracted);
  if (!parsed.success) {
    return { success: false as const, error: "データの形式が正しくありません" };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.create({
    data: {
      projectId,
      name: parsed.data.name,
      location: parsed.data.location,
      accessInfo: parsed.data.accessInfo,
      capacityMin: parsed.data.capacityMin,
      capacityMax: parsed.data.capacityMax,
      ceremonyStyles: parsed.data.ceremonyStyles,
      sourceUrls: [sourceUrl],
      photoUrls: parsed.data.photoUrls,
    },
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");

  // After venue creation, trigger review collection (fire-and-forget)
  const reviewSource = reviewSourceFromUrl(sourceUrl);
  if (reviewSource) {
    import("@/server/actions/reviews")
      .then(({ analyzeVenueReviews }) =>
        analyzeVenueReviews(venue.id, sourceUrl, reviewSource),
      )
      .catch((err) => {
        console.error("[confirmVenueFromUrl] auto-review-fetch failed:", err);
      });
  }

  return { success: true as const, venue };
}

/**
 * Run async tasks with a bounded concurrency limit.
 * Inline implementation (p-limit isn't a dependency). Preserves input order in results.
 */
async function limitedAll<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array(workerCount)
    .fill(0)
    .map(async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        results[idx] = await fn(items[idx], idx);
      }
    });
  await Promise.all(workers);
  return results;
}

/**
 * Bulk-import multiple venues from a list of URLs.
 * Caps at 10 items; remaining URLs are returned as `skipped` so the UI can
 * surface a gentle notice instead of silently dropping the whole request.
 * Uses bounded concurrency (3) to avoid hammering upstream sites + Claude API.
 */
export async function bulkAddVenuesFromUrls(urls: string[]): Promise<{
  results: Array<{
    url: string;
    success: boolean;
    venueName?: string;
    error?: string;
  }>;
  skipped: string[];
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (urls.length === 0) {
    return { results: [], skipped: [] };
  }

  const MAX = 10;
  const CONCURRENCY = 3;
  const processing = urls.slice(0, MAX);
  const skipped = urls.slice(MAX);

  const results = await limitedAll(processing, CONCURRENCY, async (url) => {
    try {
      const extractResult = await addVenueFromUrl(url);
      if (extractResult.error || !extractResult.extracted) {
        return { url, success: false, error: extractResult.error ?? "読み取りに失敗" };
      }
      const confirmResult = await confirmVenueFromUrl(extractResult.extracted, url);
      if (!confirmResult.success) {
        return { url, success: false, error: "登録に失敗" };
      }
      return {
        url,
        success: true,
        venueName: extractResult.extracted.name,
      };
    } catch {
      return { url, success: false, error: "予期しないエラー" };
    }
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");

  return { results, skipped };
}

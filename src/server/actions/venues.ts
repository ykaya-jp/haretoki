"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { venueSchema } from "@/server/actions/venue-schema";
import type { VenueInput } from "@/server/actions/venue-schema";
import type { VenueStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { askClaude, isClaudeAvailable } from "@/lib/claude";

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

  revalidatePath("/explore");
  revalidatePath("/home");

  return { success: true as const, venue };
}

export interface VenueFilters {
  status?: string;
  minScore?: number;
  dimensionMinScore?: { dimension: string; score: number };
  costMin?: number;
  costMax?: number;
  dressBringIn?: string;
  dressBringInFeeMax?: number;
  paymentMethod?: string;
  sortBy?: "score_desc" | "cost_asc" | "cost_desc" | "created_desc";
  query?: string;
  // Onboarding-derived personalization filters
  styles?: string[];
  areas?: string[];
  guestCount?: number;
  budgetMax?: number;
}

export async function getVenues(filters?: VenueFilters) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Build where clause
  const where: Record<string, unknown> = { projectId };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.costMin !== undefined) {
    where.costMin = { gte: filters.costMin };
  }
  if (filters?.costMax !== undefined) {
    where.costMax = { lte: filters.costMax };
  }
  if (filters?.dressBringIn) {
    where.dressBringIn = filters.dressBringIn;
  }
  if (filters?.dressBringInFeeMax !== undefined) {
    where.dressBringInFee = { lte: filters.dressBringInFeeMax };
  }
  if (filters?.paymentMethod) {
    where.paymentMethods = { has: filters.paymentMethod };
  }
  if (filters?.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }
  // Onboarding-derived filters: ceremony styles match-any
  if (filters?.styles && filters.styles.length > 0) {
    where.ceremonyStyles = { hasSome: filters.styles };
  }
  // Guest count fits inside capacity range (allow null endpoints)
  if (filters?.guestCount !== undefined) {
    const count = filters.guestCount;
    where.AND = [
      ...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
      { OR: [{ capacityMin: null }, { capacityMin: { lte: count } }] },
      { OR: [{ capacityMax: null }, { capacityMax: { gte: count } }] },
    ];
  }
  // Area: match any of the provided areas against location substring
  if (filters?.areas && filters.areas.length > 0) {
    const areaConds = filters.areas.map((a) => ({
      location: { contains: a, mode: "insensitive" as const },
    }));
    where.AND = [
      ...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
      { OR: areaConds },
    ];
  }

  // Build orderBy
  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (filters?.sortBy === "cost_asc") {
    orderBy = { costMin: "asc" };
  } else if (filters?.sortBy === "cost_desc") {
    orderBy = { costMax: "desc" };
  }

  const venues = await prisma.venue.findMany({
    where,
    include: {
      scores: true,
      estimates: {
        include: { items: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy,
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
      const userScores = venue.scores.filter((s) => s.source === "user_rating");
      if (userScores.length === 0) return false;
      const avg = userScores.reduce((acc, s) => acc + Number(s.score), 0) / userScores.length;
      return avg >= (filters.minScore ?? 0);
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

  // Post-query sort for score (requires aggregation)
  if (filters?.sortBy === "score_desc") {
    return filtered.sort((a, b) => {
      const avgA = calcAvgScore(a.scores);
      const avgB = calcAvgScore(b.scores);
      return (avgB ?? 0) - (avgA ?? 0);
    });
  }

  return filtered;
}

function calcAvgScore(scores: Array<{ source: string; score: unknown }>): number | null {
  const userScores = scores.filter((s) => s.source === "user_rating");
  if (userScores.length === 0) return null;
  return userScores.reduce((acc, s) => acc + Number(s.score), 0) / userScores.length;
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
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
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
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 10 * 1024 * 1024) continue; // 10MB limit per file
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
    revalidatePath(`/venues/${venueForUpload.id}`);
  }

  return { success: true, urls };
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
- confidence: "high" if major fields found, "medium" if some missing, "low" if minimal data`;

export async function addVenueFromUrl(url: string): Promise<{
  extracted?: ExtractedVenueData;
  error?: string;
}> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください。手動で入力してください。" };
  }

  try {
    new URL(url);
  } catch {
    return { error: "有効なURLを入力してください" };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Haretoki/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { error: "ページを取得できませんでした。URLを確認するか、手動で入力してください。" };
    }

    const html = await response.text();

    // Strip scripts, styles, and tags
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const claudeResponse = await askClaude(
      URL_EXTRACTION_SYSTEM_PROMPT,
      `以下はURL ${url} から取得したウェブページの内容です。結婚式場の情報を構造化データとして抽出してください:\n\n${textContent.slice(0, 30000)}`
    );

    if (!claudeResponse) {
      return { error: "AI解析に失敗しました。手動で入力してください。" };
    }

    const extracted = JSON.parse(claudeResponse) as ExtractedVenueData;
    return { extracted };
  } catch {
    return { error: "式場情報の取得に失敗しました。手動で入力してください。" };
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

  revalidatePath("/explore");
  revalidatePath("/home");

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
  await requireProjectMembership(user.id);

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

  revalidatePath("/explore");
  revalidatePath("/home");

  return { results, skipped };
}

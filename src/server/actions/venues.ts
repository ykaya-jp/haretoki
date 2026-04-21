"use server";

import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { venueSchema } from "@/server/actions/venue-schema";
import type { VenueInput } from "@/server/actions/venue-schema";
import { Prisma, type VenueStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { askClaude, isClaudeAvailable, ClaudeCreditsError } from "@/lib/claude";
import { computeInputHash } from "@/lib/anthropic";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";
import { buildVenueWhere, type VenueFilters } from "@/server/actions/venue-filters";
import { computeCompositeScore } from "@/lib/venue-score";
import {
  extractMetadata,
  hasUsefulMetadata,
  buildMetadataPrompt,
} from "@/server/actions/url-metadata";
import { captureServerEvent } from "@/lib/analytics/server";
import { captureError, captureMessage } from "@/lib/sentry";
import { guardExternalUrl } from "@/lib/url-guard";
import type { ReviewSource } from "@/generated/prisma/client";
import { deriveRelatedUrls } from "@/lib/url-import/domain-router";
import { parseJsonLd } from "@/lib/url-import/jsonld-parser";
import {
  extractImagesFromHtml,
  isLikelyAssetUrl,
  mergePhotoUrls,
} from "@/lib/url-import/extract-images";
import {
  uploadVenuePhotoFromUrl,
  type PhotoUploadReason,
  type PhotoUploadResult,
} from "@/lib/supabase/storage";
import { saveExtractedReviews } from "@/server/actions/reviews";
import { VIBE_TAGS } from "@/lib/vibe-tags";
import {
  matchExistingVenue,
  mergeVenueFields,
  normalizeName,
  type ExistingVenueSummary,
  type VenueCandidate,
  type VenueFieldBag,
} from "@/lib/venue-dedupe";

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

  // Auto-favorite the new venue for the user who added it. Model: the
  // "Candidates" tab shows venues the couple is actively tracking —
  // adding a venue is a stronger expression of interest than just
  // browsing it, so it lands in the adder's "自分" tab (and the
  // partner sees it in their "パートナー" tab) without a separate
  // heart tap. Idempotent via the composite unique on (userId, venueId).
  await prisma.venueFavorite.upsert({
    where: { venueId_userId: { userId: user.id, venueId: venue.id } },
    update: {},
    create: { userId: user.id, venueId: venue.id },
  });

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");
  revalidatePath("/candidates");

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

/** Delete a venue and all related data (scores, estimates, visits, etc). */
export async function deleteVenue(
  venueId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to user's project
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: { id: true },
  });
  if (!venue) {
    return { success: false, error: "式場が見つかりません" };
  }

  // Cascade delete — Prisma schema should handle relations,
  // but explicitly delete in order to be safe
  await prisma.$transaction([
    prisma.venueChecklistAnswer.deleteMany({ where: { venueId } }),
    prisma.venueFavorite.deleteMany({ where: { venueId } }),
    prisma.venueScore.deleteMany({ where: { venueId } }),
    prisma.review.deleteMany({ where: { venueId } }),
    prisma.estimateItem.deleteMany({
      where: { estimate: { venueId } },
    }),
    prisma.estimate.deleteMany({ where: { venueId } }),
    prisma.visitRating.deleteMany({
      where: { visit: { venueId } },
    }),
    prisma.visitChecklistItem.deleteMany({
      where: { visit: { venueId } },
    }),
    prisma.visitNoteMedia.deleteMany({
      where: { visitNote: { visit: { venueId } } },
    }),
    prisma.visitNote.deleteMany({
      where: { visit: { venueId } },
    }),
    prisma.visit.deleteMany({ where: { venueId } }),
    prisma.venuePlan.deleteMany({ where: { venueId } }),
    prisma.venue.delete({ where: { id: venueId } }),
  ]);

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");
  revalidatePath("/candidates");

  return { success: true };
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
      sourceUrls: true,
      status: true,
      scores: true,
      vibeTags: true,
      // Deep extraction (v2) — JSON-LD derived. These feed the Fact Sheet /
      // Amenities / Cost Breakdown / Cuisine sections in the venue detail
      // page. Stored by confirmVenueFromUrl but never surfaced in UI until
      // Phase B (v3). See plan: dapper-tinkering-quill.md.
      externalRatingValue: true,
      externalReviewCount: true,
      postalCode: true,
      streetAddress: true,
      latitude: true,
      longitude: true,
      phoneNumber: true,
      hasParking: true,
      parkingCapacity: true,
      hasShuttle: true,
      hasAccommodation: true,
      acceptsSecondParty: true,
      barrierFree: true,
      ceremonyFeeExact: true,
      productionFeeMin: true,
      productionFeeMax: true,
      serviceFeeRate: true,
      operatingHours: true,
      closedDays: true,
      cuisineTypes: true,
      chefCredentials: true,
      reviewClusters: true,
    },
  });
}

// Deep-extraction field-list contract lives in venue-detail-fields.ts — a
// plain-module sibling. "use server" modules cannot export non-async values,
// so the const had to move out. Tests should import from that file.

/**
 * Lightweight — just the latest estimate's total, for the above-the-fold
 * price ribbon. One row, one column, sorted by version desc. Kept
 * separate from getVenueEstimates so the ribbon can stream (or await
 * inline) without also pulling line items + upgrade predictions.
 */
export async function getVenueLatestEstimateTotal(
  id: string,
): Promise<number | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const latest = await prisma.estimate.findFirst({
    where: { venueId: id, venue: { projectId } },
    orderBy: { version: "desc" },
    select: { total: true },
  });
  return latest?.total ?? null;
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

export interface ExtractedIndividualReviewData {
  title: string | null;
  body: string;
  rating: number | null;
  author: string | null;
  visitedAt: string | null;
}

export interface ReviewClusterTheme {
  theme: string;
  summary: string;
  count?: number;
}

export interface ReviewClustersData {
  positive: ReviewClusterTheme[];
  negative: ReviewClusterTheme[];
}

/**
 * Narrow a Prisma.JsonValue (which is `string | number | boolean | … | object`)
 * down to ReviewClustersData. Older rows may carry null, legacy strings, or
 * partially-shaped JSON from earlier experiments — treat anything that isn't
 * the canonical `{ positive, negative }` shape as null so merge logic can
 * simply prefer the new cluster pass.
 */
function castReviewClusters(
  raw: Prisma.JsonValue | null | undefined,
): ReviewClustersData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const positive = Array.isArray(r.positive) ? (r.positive as ReviewClusterTheme[]) : [];
  const negative = Array.isArray(r.negative) ? (r.negative as ReviewClusterTheme[]) : [];
  if (positive.length === 0 && negative.length === 0) return null;
  return { positive, negative };
}

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
  costMin: number | null;
  costMax: number | null;
  paymentMethodEnums: ("credit_card" | "cash" | "bank_transfer" | "installment")[];
  dressBringIn: "allowed" | "not_allowed" | "negotiable" | null;
  dressBringInFee: number | null;
  maxInstallments: number | null;
  vibeTags: string[];
  reviews: ExtractedIndividualReviewData[];
  /** AI-clustered review themes (positive / negative). Null when clustering
   *  wasn't attempted or the corpus was too thin. Optional so older
   *  fixtures that predate the cluster pass still satisfy the type. */
  reviewClusters?: ReviewClustersData | null;

  // v2 deep extraction — populated from JSON-LD parser where available,
  // falls back to Claude body inference for facility/cost-breakdown flags.
  externalRatingValue?: number | null;
  externalReviewCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  postalCode?: string | null;
  streetAddress?: string | null;
  phoneNumber?: string | null;
  hasParking?: boolean | null;
  parkingCapacity?: number | null;
  hasShuttle?: boolean | null;
  hasAccommodation?: boolean | null;
  acceptsSecondParty?: boolean | null;
  barrierFree?: boolean | null;
  ceremonyFeeExact?: number | null;
  productionFeeMin?: number | null;
  productionFeeMax?: number | null;
  serviceFeeRate?: number | null;
  operatingHours?: string | null;
  closedDays?: string[];
  cuisineTypes?: string[];
  chefCredentials?: string | null;
}

const CLOSED_DAY_IDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "irregular",
] as const;

const CUISINE_TYPE_IDS = [
  "french",
  "japanese",
  "italian",
  "chinese",
  "fusion",
  "buffet",
] as const;

const VIBE_TAG_IDS = VIBE_TAGS.map((v) => v.id) as [string, ...string[]];

const extractedVenueSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().max(200).nullable(),
  accessInfo: z.string().max(500).nullable(),
  capacityMin: z.number().int().positive().nullable(),
  capacityMax: z.number().int().positive().nullable(),
  ceremonyStyles: z.array(z.string().max(50)).max(10),
  estimatedPrice: z.number().int().positive().nullable(),
  features: z.array(z.string().max(100)).max(20),
  photoUrls: z.array(z.string().url().max(1000)).max(30),
  confidence: z.enum(["high", "medium", "low"]),
  costMin: z.number().int().positive().nullable().optional().default(null),
  costMax: z.number().int().positive().nullable().optional().default(null),
  paymentMethodEnums: z
    .array(z.enum(["credit_card", "cash", "bank_transfer", "installment"]))
    .max(4)
    .optional()
    .default([]),
  dressBringIn: z
    .enum(["allowed", "not_allowed", "negotiable"])
    .nullable()
    .optional()
    .default(null),
  dressBringInFee: z.number().int().nonnegative().nullable().optional().default(null),
  maxInstallments: z.number().int().positive().nullable().optional().default(null),
  vibeTags: z.array(z.enum(VIBE_TAG_IDS)).max(8).optional().default([]),
  reviews: z
    .array(
      z.object({
        title: z.string().max(200).nullable(),
        body: z.string().min(10).max(3000),
        rating: z.number().min(1).max(5).nullable(),
        author: z.string().max(50).nullable(),
        visitedAt: z.string().max(50).nullable(),
      }),
    )
    // Raised from 8 → 20. Users report the venue detail page shows only
    // 3-5 reviews for venues that clearly list 15-30 on the source page
    // (zexy / wedding park) — Claude was capped too tight to fit all
    // visible entries. 20 still fits the completion budget and gives
    // couples a statistically meaningful sample.
    .max(20)
    .optional()
    .default([]),

  // AI-clustered review themes — rolled up from the multi-page kuchikomi
  // corpus. Each theme gets a short summary + ball-park count. Both arrays
  // may be empty when there's too little source material to cluster.
  reviewClusters: z
    .object({
      positive: z
        .array(
          z.object({
            theme: z.string().min(1).max(40),
            summary: z.string().min(1).max(400),
            count: z.number().int().min(0).max(100000).optional(),
          }),
        )
        .max(15)
        .default([]),
      negative: z
        .array(
          z.object({
            theme: z.string().min(1).max(40),
            summary: z.string().min(1).max(400),
            count: z.number().int().min(0).max(100000).optional(),
          }),
        )
        .max(15)
        .default([]),
    })
    .nullable()
    .optional()
    .default(null),

  // v2 deep extraction
  externalRatingValue: z.number().min(0).max(5).nullable().optional().default(null),
  externalReviewCount: z.number().int().nonnegative().nullable().optional().default(null),
  latitude: z.number().min(-90).max(90).nullable().optional().default(null),
  longitude: z.number().min(-180).max(180).nullable().optional().default(null),
  postalCode: z.string().max(16).nullable().optional().default(null),
  streetAddress: z.string().max(200).nullable().optional().default(null),
  phoneNumber: z.string().max(32).nullable().optional().default(null),
  hasParking: z.boolean().nullable().optional().default(null),
  parkingCapacity: z.number().int().positive().nullable().optional().default(null),
  hasShuttle: z.boolean().nullable().optional().default(null),
  hasAccommodation: z.boolean().nullable().optional().default(null),
  acceptsSecondParty: z.boolean().nullable().optional().default(null),
  barrierFree: z.boolean().nullable().optional().default(null),
  ceremonyFeeExact: z.number().int().positive().nullable().optional().default(null),
  productionFeeMin: z.number().int().positive().nullable().optional().default(null),
  productionFeeMax: z.number().int().positive().nullable().optional().default(null),
  serviceFeeRate: z.number().min(0).max(1).nullable().optional().default(null),
  operatingHours: z.string().max(100).nullable().optional().default(null),
  closedDays: z.array(z.enum(CLOSED_DAY_IDS)).max(7).optional().default([]),
  cuisineTypes: z.array(z.enum(CUISINE_TYPE_IDS)).max(5).optional().default([]),
  chefCredentials: z.string().max(500).nullable().optional().default(null),
});

const URL_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured wedding venue information from Japanese web page content.

You will receive multiple related sub-pages of the same venue concatenated as labelled sections (DETAIL / PHOTOS / REVIEWS / PLANS). Merge information across them and extract the following.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "<venue name in Japanese>",
  "location": "<area/address>",
  "accessInfo": "<nearest station and walking time>",
  "capacityMin": <number or null>,
  "capacityMax": <number or null>,
  "ceremonyStyles": ["チャペル" | "神前" | "人前" | "ガーデン"],
  "estimatedPrice": <rough total in yen or null>,
  "features": ["<short feature label>", ...],
  "photoUrls": ["<url1>", "<url2>", ... up to 20],
  "confidence": "high" | "medium" | "low",
  "costMin": <yen int or null>,
  "costMax": <yen int or null>,
  "paymentMethodEnums": ["credit_card" | "cash" | "bank_transfer" | "installment"],
  "dressBringIn": "allowed" | "not_allowed" | "negotiable" | null,
  "dressBringInFee": <yen int or null>,
  "maxInstallments": <payment installment count or null>,
  "vibeTags": ["natural_light"|"garden"|"glass"|"private_floor"|"historic"|"rooftop"|"chapel"|"riverside"|"modern"|"classical"],
  "reviews": [
    {
      "title": "<review headline or null>",
      "body": "<200-500 字程度に要約した感想 (原文の丸写しはしない)>",
      "rating": <1-5 number or null>,
      "author": "<handle name only, no PII>",
      "visitedAt": "<e.g. 2024年5月 or null>"
    }
  ],
  "reviewClusters": {
    "positive": [
      { "theme": "<テーマ名 20字以内>", "summary": "<60-120 字のまとめ>", "count": <このテーマに該当するレビュー数 integer> }
    ],
    "negative": [
      { "theme": "<テーマ名 20字以内>", "summary": "<60-120 字のまとめ>", "count": <integer> }
    ]
  }
}

Extra deep-extraction fields (all optional — emit null / [] when unsure):
  "hasParking": <true|false|null>,
  "parkingCapacity": <number of spaces or null>,
  "hasShuttle": <true|false|null>,
  "hasAccommodation": <true|false|null>,
  "acceptsSecondParty": <true|false|null>,
  "barrierFree": <true|false|null>,
  "ceremonyFeeExact": <挙式料 yen or null>,
  "productionFeeMin": <演出費 下限 yen or null>,
  "productionFeeMax": <演出費 上限 yen or null>,
  "serviceFeeRate": <0-1 decimal (0.1 for 10%) or null>,
  "operatingHours": "<e.g. '11:00-20:00' or null>",
  "closedDays": ["monday"|"tuesday"|...|"sunday"|"irregular"],
  "cuisineTypes": ["french"|"japanese"|"italian"|"chinese"|"fusion"|"buffet"],
  "chefCredentials": "<シェフ経歴 短文 or null, 500字以内>"

Guidelines:
- Use null (not empty string) when a field cannot be determined.
- costMin / costMax: parse 見積もり例 / 挙式+披露宴 / 総額 / 参考費用 patterns. Convert "300万円" → 3000000. If only one value is visible put it in both costMin and costMax.
- ceremonyFeeExact: parse 挙式料 金額, typically 300,000-500,000 yen range.
- productionFeeMin / Max: 演出費 / プロデュース料 range.
- serviceFeeRate: "サービス料 10%" → 0.1.
- paymentMethodEnums: map "クレジットカード" → credit_card, "現金" → cash, "銀行振込" → bank_transfer, "分割" / "ローン" → installment.
- dressBringIn: "持ち込み可" → allowed, "持ち込み不可" → not_allowed, "要相談" / "応相談" → negotiable.
- dressBringInFee: fee in yen when dressBringIn=allowed with charge.
- maxInstallments: payment installment max count when explicitly stated.
- vibeTags: pick tags that clearly match from visible photo descriptions + body copy. Emit the enum id, not the Japanese label. Max 5.
- ceremonyStyles: enum values チャペル / 神前 / 人前 / ガーデン.
- hasParking: true if 駐車場 is advertised. parkingCapacity: 台数 when given.
- hasShuttle: true if 送迎 / シャトル is offered.
- hasAccommodation: true if 提携宿泊 / 宿泊施設 is mentioned.
- acceptsSecondParty: true if 二次会 use is explicitly permitted.
- barrierFree: true if バリアフリー / 車椅子 対応 is mentioned.
- closedDays: emit enum ids. "火曜・水曜定休" → ["tuesday","wednesday"]. "不定休" → ["irregular"].
- cuisineTypes: "フレンチ"→french, "和食"→japanese, "イタリアン"→italian, "中華"→chinese, "フュージョン"→fusion, "ビュッフェ"→buffet.
- chefCredentials: brief one-sentence summary of head chef background. Professional only, no PII.
- photoUrls: prefer large venue/ceremony/reception/chapel hero images. Skip thumbnails, icons, avatars, and marketing banners. Absolute URLs only.
- confidence: "high" if most core fields are present, "medium" if some missing, "low" if minimal.
- reviews: ページ上に表示されている口コミをできる限り全て拾う（最大 20 件まで）。少なすぎるより多い方がよい。必ず Japanese で要約すること。原文の長文コピペは NG — 200-500 字程度の要約に書き直す。出典 URL は呼び出し側で付与するのでここでは不要。複数ページの重複する口コミは 1 件にまとめる。author はハンドル名のみ、本名や電話番号など PII を含めてはいけない。
- reviewClusters: REVIEWS セクション全体（複数ページ分の生テキスト）を読み、肯定的テーマと否定的テーマをそれぞれ 5-12 個ずつに「クラスタ」する。1400 件規模のコーパスを前提に、同じ話（例: 「チャペルの光が綺麗」「スタッフが親切」「料理が冷めていた」等）は 1 テーマにまとめる。各テーマの summary は 60-120 字のプレーン文。count は該当しそうな件数のざっくり見積もり（正確でなくて良いが 0 にはしない）。レビューが明らかに少ない（≤5 件）場合や見つからない場合は positive / negative どちらも空配列でよい。テーマ名は 20 字以内で具体的に（「良い」「悪い」のような粒度は禁止）。
  * positive の例: 「チャペルの自然光」「スタッフのホスピタリティ」「料理のクオリティ」
  * negative の例: 「見積もりの追加費用」「人数に対する披露宴会場の狭さ」「送迎バスの待ち時間」

IMPORTANT: Fields derivable directly from JSON-LD (aggregateRating value/count, GeoCoordinates latitude/longitude, PostalAddress postalCode/streetAddress, telephone) are handled by a separate structured parser — OMIT them from your output. Do not guess or rewrite these.

Note: The input may include OGP (og:title / og:description / og:image), Twitter Cards,
and JSON-LD (Schema.org Venue / LocalBusiness / Organization / Event / Review) blocks in
addition to (or instead of) the main body text. Many Japanese wedding sites (e.g. Zexy)
are SPAs that leave the visible body empty server-side but populate these structured
fields for SEO. Treat OGP/JSON-LD as primary sources when they are present — the
"name", "address", "image", "telephone", "geo", "review", "aggregateRating" fields from
JSON-LD and og:title / og:description are usually the most reliable signals.`;

/**
 * Strip optional ```json ... ``` markdown fences that Claude sometimes wraps JSON in,
 * even when explicitly instructed not to. Falls through to the original string when
 * no fence is detected.
 */
function extractJson(s: string): string {
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : s.trim();
}

/** Scan the raw textContent for common Japanese venue signals the
 *  JSON-LD block doesn't carry — access info, ceremony styles,
 *  cuisine types. Heuristic, but zero external calls.
 */
function scrapeBodyHints(
  textContent: string,
): {
  accessInfo: string | null;
  ceremonyStyles: string[];
  cuisineTypes: ("french" | "japanese" | "italian" | "chinese" | "fusion" | "buffet")[];
} {
  const snippet = textContent.slice(0, 80_000);

  // "表参道駅徒歩3分" / "○○駅A4出口より徒歩3分" style.
  const walkMatch = snippet.match(/([^\s]{1,12}駅)[^\s。、]{0,40}徒歩\s*[約\s]*([0-9０-９]{1,2})\s*分/);
  const accessInfo = walkMatch ? `${walkMatch[1]} 徒歩 ${walkMatch[2].replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)))} 分` : null;

  // Canonical 4-value enum (matches the Claude prompt above, see
  // ceremonyStyles enum in systemPrompt). ホテル / レストラン /
  // ハウスウェディング are venue *types*, not ceremony styles, and
  // surfacing them as chips produced 6-chip rows on zexy pages that
  // mentioned every word in their nav. We also keep "教会式" as a
  // synonym mapped to チャペル, since zexy body copy uses both.
  const CEREMONY_KEYWORDS: Array<{ kw: string; label: string }> = [
    { kw: "チャペル", label: "チャペル" },
    { kw: "教会式", label: "チャペル" },
    { kw: "神前", label: "神前" },
    { kw: "人前", label: "人前" },
    { kw: "ガーデン", label: "ガーデン" },
  ];
  const seenCeremony = new Set<string>();
  for (const { kw, label } of CEREMONY_KEYWORDS) {
    if (snippet.includes(kw)) seenCeremony.add(label);
  }
  const ceremonyStyles = Array.from(seenCeremony).slice(0, 4);

  const CUISINE_MAP: { kw: string; id: "french" | "japanese" | "italian" | "chinese" | "fusion" | "buffet" }[] = [
    { kw: "フレンチ", id: "french" },
    { kw: "和食", id: "japanese" },
    { kw: "懐石", id: "japanese" },
    { kw: "日本料理", id: "japanese" },
    { kw: "イタリアン", id: "italian" },
    { kw: "中華", id: "chinese" },
    { kw: "フュージョン", id: "fusion" },
    { kw: "折衷", id: "fusion" },
    { kw: "ブッフェ", id: "buffet" },
    { kw: "ビュッフェ", id: "buffet" },
  ];
  const seenCuisine = new Set<"french" | "japanese" | "italian" | "chinese" | "fusion" | "buffet">();
  for (const { kw, id } of CUISINE_MAP) {
    if (snippet.includes(kw)) seenCuisine.add(id);
  }

  return {
    accessInfo,
    ceremonyStyles,
    cuisineTypes: Array.from(seenCuisine).slice(0, 5),
  };
}

/**
 * Rescue path when Claude extraction fails end-to-end. Builds a minimum
 * valid ExtractedVenueData from JSON-LD + OpenGraph metadata + raw HTML
 * body hints — enough to let the couple commit the venue and fill in
 * detail later.
 *
 * Returns null if we don't even have a venue name (at which point the
 * page really does have no extractable signal and the error path is
 * the right behaviour).
 */
function buildFallbackExtracted(
  structured: ReturnType<typeof parseJsonLd>,
  metadata: ReturnType<typeof extractMetadata>,
  textContent: string = "",
): ExtractedVenueData | null {
  const name =
    structured.name ||
    metadata.og["og:title"] ||
    metadata.title ||
    null;
  if (!name) return null;

  const locationParts = [
    structured.address?.region,
    structured.address?.locality,
    structured.address?.street,
  ].filter((p): p is string => !!p);
  const location = locationParts.length > 0 ? locationParts.join(" ").slice(0, 200) : null;

  // JSON-LD `image` array first — Schema.org-grade URLs, typically the
  // actual venue photo set (zexy: `/p/wedding/.../images/001008690602.jpg`).
  // og:image comes next and is often a shared promo banner
  // (zexy: `/images/common/ic_new_text.gif`) that beat the real photos
  // when it was ordered first. Extract-images DROP_PATTERNS still filters
  // obvious asset URLs as a second layer.
  const photoCandidates: string[] = [];
  if (structured.images) photoCandidates.push(...structured.images);
  const ogImage = metadata.og["og:image"];
  if (ogImage) photoCandidates.push(ogImage);
  const photoUrls = Array.from(new Set(photoCandidates))
    .filter((u) => {
      try {
        new URL(u);
      } catch {
        return false;
      }
      // Drop shared asset / promo-banner URLs (e.g. zexy
      // `/images/common/ic_new_text.gif`) that would otherwise render
      // as the venue hero.
      if (isLikelyAssetUrl(u)) return false;
      return true;
    })
    .slice(0, 30);

  const bodyHints = scrapeBodyHints(textContent);

  return {
    name: name.slice(0, 200),
    location,
    accessInfo: bodyHints.accessInfo,
    capacityMin: null,
    capacityMax: null,
    ceremonyStyles: bodyHints.ceremonyStyles,
    estimatedPrice: null,
    features: [],
    photoUrls,
    confidence: "low",
    costMin: null,
    costMax: null,
    paymentMethodEnums: [],
    dressBringIn: null,
    dressBringInFee: null,
    maxInstallments: null,
    vibeTags: [],
    reviews: [],
    reviewClusters: null,
    externalRatingValue: structured.aggregateRating?.value ?? null,
    externalReviewCount: structured.aggregateRating?.count ?? null,
    latitude: structured.geo?.lat ?? null,
    longitude: structured.geo?.lng ?? null,
    postalCode: structured.address?.postal ?? null,
    streetAddress: structured.address?.street ?? null,
    phoneNumber: structured.phone ?? null,
    hasParking: null,
    parkingCapacity: null,
    hasShuttle: null,
    hasAccommodation: null,
    acceptsSecondParty: null,
    barrierFree: null,
    ceremonyFeeExact: null,
    productionFeeMin: null,
    productionFeeMax: null,
    serviceFeeRate: null,
    operatingHours: null,
    closedDays: [],
    cuisineTypes: bodyHints.cuisineTypes,
    chefCredentials: null,
  };
}

/**
 * Fetch a single page and return its extracted metadata + body excerpt.
 * Returns null on any non-2xx / network / timeout failure so the caller can
 * gracefully degrade (the detail page is retried as a hard error elsewhere).
 */
async function fetchPageForExtraction(
  targetUrl: string,
  referer: string,
): Promise<{
  html: string;
  metadata: ReturnType<typeof extractMetadata>;
  textContent: string;
  hadUsefulSignal: boolean;
} | null> {
  try {
    const guard = guardExternalUrl(targetUrl);
    if (!guard.ok) return null;
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        DNT: "1",
        Referer: referer,
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.warn("[fetchPageForExtraction] non-2xx:", {
        url: targetUrl,
        status: response.status,
      });
      return null;
    }
    const html = await response.text();
    const metadata = extractMetadata(html);
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hadUsefulSignal = hasUsefulMetadata(metadata) || textContent.length >= 500;
    return { html, metadata, textContent, hadUsefulSignal };
  } catch (err) {
    console.warn("[fetchPageForExtraction] fetch failed:", {
      url: targetUrl,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
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
    // Derive related sub-pages (photos / reviews / plans) so we can merge
    // multi-page context before handing to Claude. Unknown domains fall back
    // to detail-only, preserving the pre-existing single-URL behaviour.
    let related: ReturnType<typeof deriveRelatedUrls>;
    try {
      related = deriveRelatedUrls(url);
    } catch {
      return { error: "有効な URL を入力してください" };
    }

    const origin = new URL(related.detail).origin;
    const targets: Array<{
      key: "DETAIL" | "PHOTOS" | "REVIEWS" | "REVIEWS_PAGE" | "PLANS";
      url: string;
    }> = [{ key: "DETAIL", url: related.detail }];
    if (related.photos) targets.push({ key: "PHOTOS", url: related.photos });
    if (related.reviews) targets.push({ key: "REVIEWS", url: related.reviews });
    // Additional review pages (zexy ?pn=2..5) widen the corpus from ~10
    // to ~50 reviews. Keyed as REVIEWS_PAGE so the prompt-building step
    // can collapse them into the same REVIEWS section rather than
    // presenting each page as a separate header to Claude.
    if (related.reviewPages) {
      for (const page of related.reviewPages) {
        targets.push({ key: "REVIEWS_PAGE", url: page });
      }
    }
    if (related.plans) targets.push({ key: "PLANS", url: related.plans });

    const fetched = await limitedAll(targets, 4, (t) =>
      fetchPageForExtraction(t.url, `${origin}/`),
    );

    const detailPage = fetched[0];
    if (!detailPage) {
      console.error("addVenueFromUrl detail fetch failed:", { url });
      return {
        error: `ページを開けませんでした。URL を見直すか、手動で入力してみてください。`,
      };
    }

    const detailBodyShort = detailPage.textContent.length < 500;
    const detailMetadataUseful = hasUsefulMetadata(detailPage.metadata);

    if (detailBodyShort && !detailMetadataUseful) {
      console.error("addVenueFromUrl empty HTML and no metadata:", {
        url,
        textLength: detailPage.textContent.length,
      });
      return {
        error:
          "ページの中身を読めませんでした (JavaScript 必須のページかもしれません)。手動で入力してみてください。",
      };
    }

    // Build multi-section prompt: DETAIL section first, then any successful
    // sub-pages. Each section caps body at 5000 chars except REVIEWS which
    // is widened (see below). JSON-LD blobs keep their original cap inside
    // buildMetadataPrompt.
    //
    // REVIEWS pages (original + REVIEWS_PAGE pagination entries) are merged
    // into a single REVIEWS section with 12_000 chars cap so Claude can see
    // 30-60 reviews worth of body text for clustering. Individual pages as
    // their own sections would waste tokens on duplicated masthead markup
    // and fragment the corpus across N prompt headers.
    const sections: string[] = [];
    const reviewBodies: string[] = [];
    let reviewHeaderUrl: string | null = null;
    targets.forEach((t, i) => {
      const page = fetched[i];
      if (t.key === "REVIEWS" || t.key === "REVIEWS_PAGE") {
        if (t.key === "REVIEWS") reviewHeaderUrl = t.url;
        if (page) reviewBodies.push(page.textContent);
        return;
      }
      if (!page) {
        sections.push(`=== ${t.key} (${t.url}) ===\n(fetch failed)`);
        return;
      }
      sections.push(
        `=== ${t.key} (${t.url}) ===\n` +
          buildMetadataPrompt(t.url, page.metadata, page.textContent.slice(0, 5000)),
      );
    });
    if (reviewBodies.length > 0) {
      const headerUrl = reviewHeaderUrl ?? related.reviews ?? "";
      // buildMetadataPrompt internally caps body at 2000 chars — too tight
      // for 50+ reviews. Emit REVIEWS as a minimal headered block with
      // just the merged body so Claude sees the full corpus. Cap at 12k
      // chars (≈ the middle of Haiku's prompt-cost/quality sweet spot).
      const mergedReviewText = reviewBodies.join("\n\n").slice(0, 12_000);
      sections.push(
        `=== REVIEWS (${headerUrl}, merged ${reviewBodies.length} pages) ===\n` +
          mergedReviewText,
      );
    }

    const prompt =
      `以下は同じ結婚式場の複数ページを連結した内容です。重複はまとめ、可能な限り情報を抽出してください。\n\n` +
      sections.join("\n\n");

    // Structured parser — run EARLY (before Claude) so we can use JSON-LD
    // as a fallback if Claude returns nothing. Most wedding CDNs embed
    // enough Schema.org data (name, address, og:image) to bootstrap a
    // venue record even when the AI step fails.
    const jsonLdBlobs: unknown[] = [];
    fetched.forEach((page) => {
      if (!page) return;
      for (const blob of page.metadata.jsonLd) jsonLdBlobs.push(blob);
    });
    const structured = parseJsonLd(jsonLdBlobs);

    const urlExtractionHash = computeInputHash(
      JSON.stringify({ system: URL_EXTRACTION_SYSTEM_PROMPT, user: prompt }),
    );
    const cachedExtraction = await getCachedResponse(urlExtractionHash);
    let claudeResponse: string | null;
    if (cachedExtraction) {
      claudeResponse = cachedExtraction;
    } else {
      claudeResponse = await askClaude(URL_EXTRACTION_SYSTEM_PROMPT, prompt, {
        maxTokens: 4096,
      });
      if (claudeResponse) {
        await setCachedResponse(urlExtractionHash, claudeResponse, "claude-haiku-4-5-20251001");
      }
    }

    // If Claude failed entirely, try to rescue with JSON-LD + og metadata
    // alone. This is lower-confidence but gives zexy / hanayume pages a
    // non-null result the user can commit and fill in by hand.
    if (!claudeResponse) {
      console.warn("[addVenueFromUrl] claude returned null, attempting JSON-LD fallback", { url });
      const fallback = buildFallbackExtracted(structured, detailPage.metadata, detailPage.textContent);
      if (fallback) {
        return { extracted: fallback, warning: "AI 解析に失敗したため、取れた情報だけで下書きしました。内容を確認してください。" };
      }
      return { error: "AI がうまく読めませんでした。手動で入力してみてください。" };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractJson(claudeResponse));
    } catch (parseErr) {
      console.error("[addVenueFromUrl] claude JSON parse failed, attempting JSON-LD fallback:", {
        url,
        error: parseErr instanceof Error ? parseErr.message : parseErr,
        snippet: claudeResponse.slice(0, 200),
      });
      const fallback = buildFallbackExtracted(structured, detailPage.metadata, detailPage.textContent);
      if (fallback) {
        return { extracted: fallback, warning: "AI 解析結果を読めなかったため、取れた情報だけで下書きしました。内容を確認してください。" };
      }
      return { error: "ページの中身をうまく整理できませんでした。手動で入力してみてください。" };
    }

    const validated = extractedVenueSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error("[addVenueFromUrl] claude schema validation failed, attempting JSON-LD fallback:", {
        url,
        issues: validated.error.issues,
      });
      const fallback = buildFallbackExtracted(structured, detailPage.metadata, detailPage.textContent);
      if (fallback) {
        return { extracted: fallback, warning: "AI 解析結果の形が合わなかったため、取れた情報だけで下書きしました。内容を確認してください。" };
      }
      return { error: "ページの中身をうまく整理できませんでした。手動で入力してみてください。" };
    }

    const enriched: ExtractedVenueData = {
      ...validated.data,
      // Canonical structured overrides (never let Claude fight these).
      externalRatingValue:
        structured.aggregateRating?.value ?? validated.data.externalRatingValue ?? null,
      externalReviewCount:
        structured.aggregateRating?.count ?? validated.data.externalReviewCount ?? null,
      latitude: structured.geo?.lat ?? validated.data.latitude ?? null,
      longitude: structured.geo?.lng ?? validated.data.longitude ?? null,
      postalCode: structured.address?.postal ?? validated.data.postalCode ?? null,
      streetAddress: structured.address?.street ?? validated.data.streetAddress ?? null,
      phoneNumber: structured.phone ?? validated.data.phoneNumber ?? null,
    };

    // Union JSON-LD Organization images (usually higher-resolution CDN URLs)
    // into Claude's photoUrls — dedupe preserves insertion order.
    if (structured.images && structured.images.length > 0) {
      const merged = [...enriched.photoUrls, ...structured.images];
      enriched.photoUrls = Array.from(new Set(merged)).slice(0, 30);
    }

    // Scrape raw HTML for <img src|data-src>, <source srcset>, <picture>.
    // Claude often misses lazy-loaded + srcset images — cheerio pulls them
    // directly so the upload pipeline gets a richer candidate set.
    const scrapedImages: string[] = [];
    targets.forEach((t, i) => {
      const page = fetched[i];
      if (!page) return;
      const imgs = extractImagesFromHtml(page.html, t.url, 30);
      for (const u of imgs) scrapedImages.push(u);
    });
    if (scrapedImages.length > 0) {
      enriched.photoUrls = mergePhotoUrls(enriched.photoUrls, scrapedImages, 30);
    }

    // When the rendered body was empty, we only saw OGP/JSON-LD. Surface a warning
    // so the UI can nudge the user to verify or complete missing fields manually.
    const warning =
      detailBodyShort && detailMetadataUseful
        ? "部分的な情報のみ読み取れました。手動で補完してください。"
        : undefined;

    return { extracted: enriched, warning };
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

/**
 * Build a `VenueFieldBag` from validated Claude + JSON-LD output. Shared by
 * the create and merge branches below.
 */
function buildVenueFieldBag(
  parsed: z.infer<typeof extractedVenueSchema>,
  sourceUrl: string,
): VenueFieldBag {
  return {
    name: parsed.name,
    location: parsed.location,
    accessInfo: parsed.accessInfo,
    capacityMin: parsed.capacityMin,
    capacityMax: parsed.capacityMax,
    ceremonyStyles: parsed.ceremonyStyles,
    sourceUrls: [sourceUrl],
    photoUrls: [],
    costMin: parsed.costMin,
    costMax: parsed.costMax,
    paymentMethodEnums: parsed.paymentMethodEnums,
    dressBringIn: parsed.dressBringIn,
    dressBringInFee: parsed.dressBringInFee,
    maxInstallments: parsed.maxInstallments,
    vibeTags: parsed.vibeTags,
    externalRatingValue: parsed.externalRatingValue,
    externalReviewCount: parsed.externalReviewCount,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    postalCode: parsed.postalCode,
    streetAddress: parsed.streetAddress,
    phoneNumber: parsed.phoneNumber,
    hasParking: parsed.hasParking,
    parkingCapacity: parsed.parkingCapacity,
    hasShuttle: parsed.hasShuttle,
    hasAccommodation: parsed.hasAccommodation,
    acceptsSecondParty: parsed.acceptsSecondParty,
    barrierFree: parsed.barrierFree,
    ceremonyFeeExact: parsed.ceremonyFeeExact,
    productionFeeMin: parsed.productionFeeMin,
    productionFeeMax: parsed.productionFeeMax,
    serviceFeeRate: parsed.serviceFeeRate,
    operatingHours: parsed.operatingHours,
    closedDays: parsed.closedDays,
    cuisineTypes: parsed.cuisineTypes,
    chefCredentials: parsed.chefCredentials,
    // Clusters included so mergeVenueFields' "new wins" strategy picks up
    // a freshly-rolled-up cluster pass on re-import.
    reviewClusters: parsed.reviewClusters ?? null,
  };
}

/**
 * `confirmVenueFromUrl` creates a new Venue — OR merges additional info
 * into an already-tracked one when the same venue is registered from a
 * different site (cross-site dedupe).
 *
 * `forceNew=true` is the UI escape hatch ("別の式場として追加") to bypass
 * dedupe when the matcher picked the wrong row.
 */
export async function confirmVenueFromUrl(
  extracted: ExtractedVenueData,
  sourceUrl: string,
  options: { forceNew?: boolean } = {},
) {
  const parsed = extractedVenueSchema.safeParse(extracted);
  if (!parsed.success) {
    return { success: false as const, error: "データの形式が正しくありません" };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const uniquePhotoUrls = Array.from(new Set(parsed.data.photoUrls)).slice(0, 15);
  let origin: string | undefined;
  try {
    origin = new URL(sourceUrl).origin;
  } catch {
    origin = undefined;
  }

  const candidateBag = buildVenueFieldBag(parsed.data, sourceUrl);
  const candidateNormalizedName = normalizeName(parsed.data.name);
  const candidate: VenueCandidate = {
    name: parsed.data.name,
    location: parsed.data.location,
    postalCode: parsed.data.postalCode ?? null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    normalizedName: candidateNormalizedName,
  };

  // Cross-site dedupe: look for an already-tracked venue in the same project.
  // Scoped query narrows to likely candidates only (same normalized name OR
  // near-by geo) to keep payload small even for large projects.
  let match: { venue: ExistingVenueSummary; tier: string } | null = null;
  if (!options.forceNew) {
    const nameMatchFilter = {
      projectId,
      normalizedName: candidateNormalizedName,
    };
    const geoFilter =
      candidate.latitude !== null && candidate.longitude !== null
        ? {
            projectId,
            latitude: {
              gte: candidate.latitude - 0.002,
              lte: candidate.latitude + 0.002,
            },
            longitude: {
              gte: candidate.longitude - 0.002,
              lte: candidate.longitude + 0.002,
            },
          }
        : null;

    const candidates = await prisma.venue.findMany({
      where: geoFilter
        ? { OR: [nameMatchFilter, geoFilter] }
        : nameMatchFilter,
      select: {
        id: true,
        name: true,
        location: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        normalizedName: true,
      },
      take: 20,
    });

    match = matchExistingVenue(candidate, candidates);
  }

  if (match) {
    // ─── MERGE branch ────────────────────────────────────────────────
    const existing = await prisma.venue.findUniqueOrThrow({
      where: { id: match.venue.id },
    });

    // Upload any incoming photos first so `mergeVenueFields` can union the
    // supabase URLs instead of external CDN ones. Result shape gives us
    // per-reason failure counters without try/catch churn.
    const uploadedPhotoUrls: string[] = [];
    const photoFailedReasons: Record<PhotoUploadReason, number> = {
      "403": 0,
      timeout: 0,
      "invalid-ct": 0,
      "size-limit": 0,
      network: 0,
    };
    if (uniquePhotoUrls.length > 0) {
      const uploadResults = await limitedAll(uniquePhotoUrls, 3, (src) =>
        uploadVenuePhotoFromUrl(src, projectId, existing.id, origin),
      );
      for (const r of uploadResults) {
        if (r.ok) {
          uploadedPhotoUrls.push(r.url);
        } else {
          photoFailedReasons[r.reason] = (photoFailedReasons[r.reason] ?? 0) + 1;
          reportPhotoUploadFailure(r);
          if (shouldKeepOriginalUrl(r)) {
            uploadedPhotoUrls.push(r.srcUrl);
          }
        }
      }
    }

    const existingBag: VenueFieldBag = {
      ...existing,
      // prisma returns Decimal — normalise to number for the merger.
      serviceFeeRate:
        existing.serviceFeeRate !== null
          ? Number(existing.serviceFeeRate)
          : null,
      // JSON column — narrow the Prisma.JsonValue to the cluster shape.
      // Incorrectly shaped historic values simply drop through as null.
      reviewClusters: castReviewClusters(existing.reviewClusters),
    };
    const mergeInput: VenueFieldBag = {
      ...candidateBag,
      photoUrls: uploadedPhotoUrls,
    };
    const { data: patch, updatedFields } = mergeVenueFields(existingBag, mergeInput);

    const updated = await prisma.venue.update({
      where: { id: existing.id },
      data: patch as Prisma.VenueUpdateInput,
    });

    // Adopting an existing venue (partner already added it, this user
    // just ran another URL import that merged in) counts as an
    // expression of interest → auto-favorite so the merged venue
    // shows up in the current user's "自分" tab even though they
    // didn't originate it. Idempotent via composite unique.
    await prisma.venueFavorite.upsert({
      where: { venueId_userId: { userId: user.id, venueId: existing.id } },
      update: {},
      create: { userId: user.id, venueId: existing.id },
    });

    const reviewSource = reviewSourceFromUrl(sourceUrl);
    if (reviewSource && parsed.data.reviews.length > 0) {
      try {
        await saveExtractedReviews(
          existing.id,
          parsed.data.reviews,
          sourceUrl,
          reviewSource,
        );
      } catch (err) {
        console.warn("[confirmVenueFromUrl merge] saveExtractedReviews failed:", err);
      }
    }

    const reviewSummaryStatus = await runReviewSummary(
      existing.id,
      sourceUrl,
      reviewSource,
      parsed.data.reviews.length,
    );

    revalidateTag(`project:${projectId}`, { expire: 0 });
    revalidatePath("/explore");
    revalidatePath("/home");
    revalidatePath(`/venues/${existing.id}`);

    return {
      success: true as const,
      mode: "merged" as const,
      matchTier: match.tier,
      venue: updated,
      updatedFields,
      photoUploadedCount: uploadedPhotoUrls.length,
      photoRequestedCount: uniquePhotoUrls.length,
      photoFailedReasons,
      individualReviewCount: parsed.data.reviews.length,
      reviewSummaryStatus,
    };
  }

  // ─── CREATE branch ─────────────────────────────────────────────────
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
      photoUrls: [],
      costMin: parsed.data.costMin,
      costMax: parsed.data.costMax,
      paymentMethodEnums: parsed.data.paymentMethodEnums,
      dressBringIn: parsed.data.dressBringIn,
      dressBringInFee: parsed.data.dressBringInFee,
      maxInstallments: parsed.data.maxInstallments,
      vibeTags: parsed.data.vibeTags,
      externalRatingValue: parsed.data.externalRatingValue,
      externalReviewCount: parsed.data.externalReviewCount,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      postalCode: parsed.data.postalCode,
      streetAddress: parsed.data.streetAddress,
      phoneNumber: parsed.data.phoneNumber,
      hasParking: parsed.data.hasParking,
      parkingCapacity: parsed.data.parkingCapacity,
      hasShuttle: parsed.data.hasShuttle,
      hasAccommodation: parsed.data.hasAccommodation,
      acceptsSecondParty: parsed.data.acceptsSecondParty,
      barrierFree: parsed.data.barrierFree,
      ceremonyFeeExact: parsed.data.ceremonyFeeExact,
      productionFeeMin: parsed.data.productionFeeMin,
      productionFeeMax: parsed.data.productionFeeMax,
      serviceFeeRate: parsed.data.serviceFeeRate,
      operatingHours: parsed.data.operatingHours,
      closedDays: parsed.data.closedDays,
      cuisineTypes: parsed.data.cuisineTypes,
      chefCredentials: parsed.data.chefCredentials,
      // AI review clusters — stored as JSON so the detail page can
      // render "良いところ / 気になる点" panels without re-running
      // Claude on every request. Null when the model returned nothing
      // clusterable or the venue had too few reviews.
      reviewClusters:
        parsed.data.reviewClusters != null
          ? (parsed.data.reviewClusters as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      normalizedName: candidateNormalizedName,
    },
  });

  // Auto-favorite new URL-imported venues for the user who added them —
  // same rationale as createVenue's auto-favorite. Without this a venue
  // imported from zexy lives in the shared Project but doesn't appear
  // in anyone's Candidates tab until someone taps the heart.
  await prisma.venueFavorite.upsert({
    where: { venueId_userId: { userId: user.id, venueId: venue.id } },
    update: {},
    create: { userId: user.id, venueId: venue.id },
  });

  const uploadedPhotoUrls: string[] = [];
  const photoFailedReasons: Record<PhotoUploadReason, number> = {
    "403": 0,
    timeout: 0,
    "invalid-ct": 0,
    "size-limit": 0,
    network: 0,
  };
  if (uniquePhotoUrls.length > 0) {
    const uploadResults = await limitedAll(uniquePhotoUrls, 3, (src) =>
      uploadVenuePhotoFromUrl(src, projectId, venue.id, origin),
    );
    for (const r of uploadResults) {
      if (r.ok) {
        uploadedPhotoUrls.push(r.url);
      } else {
        photoFailedReasons[r.reason] = (photoFailedReasons[r.reason] ?? 0) + 1;
        reportPhotoUploadFailure(r);
        if (shouldKeepOriginalUrl(r)) {
          uploadedPhotoUrls.push(r.srcUrl);
        }
      }
    }
    if (uploadedPhotoUrls.length > 0) {
      await prisma.venue.update({
        where: { id: venue.id },
        data: { photoUrls: uploadedPhotoUrls },
      });
    }
  }

  const reviewSource = reviewSourceFromUrl(sourceUrl);
  if (reviewSource && parsed.data.reviews.length > 0) {
    try {
      await saveExtractedReviews(venue.id, parsed.data.reviews, sourceUrl, reviewSource);
    } catch (err) {
      console.warn("[confirmVenueFromUrl] saveExtractedReviews failed:", err);
    }
  }

  const reviewSummaryStatus = await runReviewSummary(
    venue.id,
    sourceUrl,
    reviewSource,
    parsed.data.reviews.length,
  );

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");
  revalidatePath(`/venues/${venue.id}`);

  return {
    success: true as const,
    mode: "created" as const,
    venue: { ...venue, photoUrls: uploadedPhotoUrls },
    updatedFields: [] as string[],
    photoUploadedCount: uploadedPhotoUrls.length,
    photoRequestedCount: uniquePhotoUrls.length,
    photoFailedReasons,
    individualReviewCount: parsed.data.reviews.length,
    reviewSummaryStatus,
  };
}

/**
 * P8-B fallback — when Supabase Storage upload fails for reasons where
 * the source URL itself is almost certainly valid (403 hotlink blocks,
 * invalid content-type from a misbehaving CDN), keep the original CDN
 * URL in `photoUrls`. next/image's loader then fetches it server-side
 * from Vercel's region (different IP than ours, no Referer/cookie
 * forwarding baggage) and caches in the edge CDN. Only hosts listed in
 * next.config.ts `images.remotePatterns` + CSP `img-src` will actually
 * render client-side, so leaking an arbitrary URL here is safe.
 *
 * Excluded reasons:
 *   - timeout / network: the URL might simply be dead; don't keep a
 *     reference we can't ever serve.
 *   - size-limit: the resource is too big; next/image would reject too.
 */
const RECOVERABLE_UPLOAD_REASONS = new Set<PhotoUploadReason>(["403", "invalid-ct"]);

function shouldKeepOriginalUrl(
  failure: PhotoUploadResult & { ok: false },
): boolean {
  return RECOVERABLE_UPLOAD_REASONS.has(failure.reason);
}

/**
 * Warning-level Sentry event + console.warn for a single photo upload
 * failure. Groups by host + reason so production noise is aggregable
 * (e.g. "zexy.net 403 spike after CDN change").
 */
function reportPhotoUploadFailure(
  failure: PhotoUploadResult & { ok: false },
): void {
  let host = "(unknown)";
  try {
    host = new URL(failure.srcUrl).host;
  } catch {
    // malformed URL — keep fallback host.
  }
  console.warn("[photo_upload_failed]", {
    reason: failure.reason,
    host,
    srcUrl: failure.srcUrl,
    detail: failure.detail,
  });
  captureMessage("photo_upload_failed", {
    level: "warning",
    extra: {
      reason: failure.reason,
      host,
      srcUrl: failure.srcUrl,
      detail: failure.detail,
    },
  });
}

/**
 * Status of the post-import review summarization step. Returned in the
 * `confirmVenueFromUrl` payload so the Add-Venue sheet can show distinct
 * progress + toast copy for each outcome.
 */
export type ReviewSummaryStatus =
  | "completed"   // Claude successfully returned a summary
  | "timeout"    // 15s budget elapsed; reviews saved, summary TBD
  | "skipped"    // no source / no extracted reviews → nothing to summarise
  | "failed";    // API error; reviews saved, summary not produced

/**
 * Run AI review summarisation **synchronously** (bounded by analyze's
 * own 15s timeout). Returns a ReviewSummaryStatus token so the caller
 * can forward it through the server-action payload to the client.
 *
 * Why sync (not fire-and-forget like v2): users expect a single "取り込み
 * 完了" toast that covers photos + reviews + summary. Fire-and-forget
 * meant the toast fired before the summary landed, so `/venues/{id}`
 * looked like "nothing happened" even though the pipeline had succeeded.
 */
async function runReviewSummary(
  venueId: string,
  sourceUrl: string,
  reviewSource: ReviewSource | null,
  extractedReviewCount: number,
): Promise<ReviewSummaryStatus> {
  if (!reviewSource) return "skipped";
  if (extractedReviewCount === 0) return "skipped";
  try {
    const { analyzeVenueReviews } = await import("@/server/actions/reviews");
    const result = await analyzeVenueReviews(venueId, sourceUrl, reviewSource);
    if (result.ok) return "completed";
    if (result.reason === "timeout") return "timeout";
    if (result.reason === "no-reviews") return "skipped";
    return "failed";
  } catch (err) {
    console.warn("[runReviewSummary] unexpected error:", err);
    return "failed";
  }
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

/**
 * Re-run the URL-import pipeline for an already-tracked venue so the
 * deep-extraction columns (external rating, address, amenities, cost
 * breakdown, cuisine …) are backfilled when they were added after the
 * venue was originally saved.
 *
 * Unlike `confirmVenueFromUrl` this bypasses the cross-site dedupe
 * matcher — we already know which venue to write into, so we just
 * re-extract from each stored sourceUrl and merge the fresh bag onto
 * the existing row.
 */
export async function refreshVenueFromSource(venueId: string): Promise<
  | { success: true; updatedFields: string[]; photoAddedCount: number; reviewCount: number }
  | { success: false; error: string }
> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
  });
  if (!existing) return { success: false, error: "式場が見つかりません" };

  const urls = (existing.sourceUrls ?? []).filter((u): u is string => typeof u === "string" && u.length > 0);
  if (urls.length === 0) {
    return { success: false, error: "登録元の URL が無いため更新できません" };
  }

  // Accumulators across sourceUrls — each URL can contribute new fields.
  const allUpdatedFields = new Set<string>();
  let totalPhotoAdded = 0;
  let totalReviewCount = 0;

  // Snapshot of the current row; subsequent merges compose on top so that
  // a later URL can still contribute a field an earlier URL didn't have.
  let currentBag: VenueFieldBag = {
    ...existing,
    serviceFeeRate:
      existing.serviceFeeRate !== null ? Number(existing.serviceFeeRate) : null,
    reviewClusters: castReviewClusters(existing.reviewClusters),
  };

  for (const sourceUrl of urls) {
    const extractResult = await addVenueFromUrl(sourceUrl);
    if (extractResult.error || !extractResult.extracted) continue;

    const parsed = extractedVenueSchema.safeParse(extractResult.extracted);
    if (!parsed.success) continue;

    let origin: string | undefined;
    try {
      origin = new URL(sourceUrl).origin;
    } catch {
      origin = undefined;
    }

    const incomingPhotoUrls = Array.from(new Set(parsed.data.photoUrls)).slice(0, 15);
    const uploadedPhotoUrls: string[] = [];
    if (incomingPhotoUrls.length > 0) {
      const uploadResults = await limitedAll(incomingPhotoUrls, 3, (src) =>
        uploadVenuePhotoFromUrl(src, projectId, existing.id, origin),
      );
      for (const r of uploadResults) {
        if (r.ok) {
          uploadedPhotoUrls.push(r.url);
        } else {
          reportPhotoUploadFailure(r);
          if (shouldKeepOriginalUrl(r)) {
            uploadedPhotoUrls.push(r.srcUrl);
          }
        }
      }
    }

    const incomingBag: VenueFieldBag = {
      ...buildVenueFieldBag(parsed.data, sourceUrl),
      photoUrls: uploadedPhotoUrls,
    };
    const { data: patch, updatedFields } = mergeVenueFields(currentBag, incomingBag);

    if (Object.keys(patch).length > 0) {
      await prisma.venue.update({
        where: { id: existing.id },
        data: patch as Prisma.VenueUpdateInput,
      });
      for (const f of updatedFields) allUpdatedFields.add(f);
      // Carry the merged state forward so the next URL's merger sees it.
      currentBag = { ...currentBag, ...(patch as Partial<VenueFieldBag>) };
    }

    totalPhotoAdded += uploadedPhotoUrls.length;

    const reviewSource = reviewSourceFromUrl(sourceUrl);
    if (reviewSource && parsed.data.reviews.length > 0) {
      try {
        await saveExtractedReviews(
          existing.id,
          parsed.data.reviews,
          sourceUrl,
          reviewSource,
        );
        totalReviewCount += parsed.data.reviews.length;
      } catch (err) {
        console.warn("[refreshVenueFromSource] saveExtractedReviews failed:", err);
      }
    }
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/explore");
  revalidatePath("/home");
  revalidatePath(`/venues/${existing.id}`);

  return {
    success: true,
    updatedFields: Array.from(allUpdatedFields),
    photoAddedCount: totalPhotoAdded,
    reviewCount: totalReviewCount,
  };
}

/** Return all venue IDs belonging to the current user's project (for Realtime filtering). */
export async function getProjectVenueIds(): Promise<string[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const venues = await prisma.venue.findMany({
    where: { projectId },
    select: { id: true },
  });
  return venues.map((v: { id: string }) => v.id);
}

/** Return all visit IDs belonging to the current user's project (for visit_ratings Realtime filtering). */
export async function getProjectVisitIds(): Promise<string[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const visits = await prisma.visit.findMany({
    where: { venue: { projectId } },
    select: { id: true },
  });
  return visits.map((v: { id: string }) => v.id);
}

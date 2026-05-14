"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag, cacheTag } from "next/cache";
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";
import { CHECKLIST_PRESETS, STARTER_PRESET_IDS, getPresetById } from "@/lib/checklist-presets";
import { getChecklistItemsForDimension, ITEM_TO_DIMENSION } from "@/lib/dimension-checklist-map";
import { calculateDimensionScore } from "@/lib/checklist-score-calculator";
import type { Tier1Dimension } from "@/lib/constants";
import { getReviewSummariesForVenues } from "@/server/actions/comparison";
import {
  COMPARE_MAX_VENUES,
  type ComparisonAnswer,
  type ComparisonMatrix,
  type ComparisonVenue,
} from "@/lib/comparison-types";

// ── Zod schemas ────────────────────────────────────────────────────────────────

const saveAnswerSchema = z.object({
  status: z.enum(["yes", "no", "unknown"]).nullable().optional(),
  memo: z.string().max(2000).nullable().optional(),
  numberValue: z.number().nullable().optional(),
  photoUrls: z.array(z.string().url()).optional(),
});

// ── Cache tag helpers ──────────────────────────────────────────────────────────

function checklistTag(projectId: string) {
  return `checklist:${projectId}`;
}

function answerTag(venueId: string) {
  return `checklist-answers:${venueId}`;
}

// ── List active item ids for the current project ───────────────────────────────

// Inner cached loader — pure DB I/O, no cookies()/headers() so it's safe
// under Next 16 cacheComponents.
async function fetchActiveItemIds(projectId: string): Promise<string[]> {
  "use cache";
  cacheTag(checklistTag(projectId));

  const rows = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { itemId: true },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => r.itemId);
}

export async function listActiveItems(): Promise<{ projectId: string; activeItemIds: string[] }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const activeItemIds = await fetchActiveItemIds(projectId);
  return { projectId, activeItemIds };
}

// ── Toggle a single item on/off ────────────────────────────────────────────────

export async function toggleItem(
  itemId: string,
  active: boolean
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Validate itemId exists in presets
  if (!getPresetById(itemId)) {
    return { success: false };
  }

  if (active) {
    await prisma.projectChecklist.upsert({
      where: { projectId_itemId: { projectId, itemId } },
      create: { projectId, itemId },
      update: {},
    });
  } else {
    await prisma.projectChecklist.deleteMany({
      where: { projectId, itemId },
    });
  }

  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath("/checklist");
  return { success: true };
}

// ── Apply the starter preset (16 curated items across all 6 categories) ──────

/**
 * First-run wizard: bulk-activate STARTER_PRESET_IDS for the current project.
 * Idempotent — skipDuplicates means re-running is safe. Validates that every
 * starter id still exists in the preset library (guards against stale exports
 * after a preset rename).
 */
export async function applyStarterPreset(): Promise<{ success: boolean; added: number }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const valid = STARTER_PRESET_IDS.filter((id) => getPresetById(id));
  if (valid.length === 0) return { success: false, added: 0 };

  const res = await prisma.projectChecklist.createMany({
    data: valid.map((itemId) => ({ projectId, itemId })),
    skipDuplicates: true,
  });

  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath("/checklist");
  return { success: true, added: res.count };
}

// ── Bulk toggle (enable/disable all items in a dimension) ─────────────────────

export async function bulkToggleDimension(
  dimension: string,
  active: boolean
): Promise<{ success: boolean; count: number }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const items = getChecklistItemsForDimension(dimension as Tier1Dimension);
  if (items.length === 0) return { success: false, count: 0 };

  if (active) {
    await prisma.projectChecklist.createMany({
      data: items.map((p) => ({ projectId, itemId: p.id })),
      skipDuplicates: true,
    });
  } else {
    await prisma.projectChecklist.deleteMany({
      where: { projectId, itemId: { in: items.map((p) => p.id) } },
    });
  }

  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath("/checklist");
  return { success: true, count: items.length };
}

// ── Get answers for a single venue ────────────────────────────────────────────

type AnswerMap = Record<string, { status: string | null; memo: string | null; numberValue: number | null; photoUrls: string[] }>;

async function fetchAnswersForVenue(venueId: string, projectId: string): Promise<AnswerMap> {
  "use cache";
  cacheTag(answerTag(venueId));
  cacheTag(checklistTag(projectId));

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({ where: { id: venueId, projectId } });
  if (!venue) return {};

  const answers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId,
      projectChecklist: { projectId },
    },
    include: { projectChecklist: { select: { itemId: true } } },
  });

  const result: AnswerMap = {};
  for (const ans of answers) {
    result[ans.projectChecklist.itemId] = {
      status: ans.status,
      memo: ans.memo,
      numberValue: ans.numberValue ? Number(ans.numberValue) : null,
      photoUrls: ans.photoUrls,
    };
  }
  return result;
}

export async function getAnswersForVenue(venueId: string): Promise<AnswerMap> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return fetchAnswersForVenue(venueId, projectId);
}

// ── Save (upsert) an answer ────────────────────────────────────────────────────

export async function saveAnswer(
  venueId: string,
  itemId: string,
  patch: z.infer<typeof saveAnswerSchema>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId).then(({ projectId }) => ({ projectId }));

  const parsed = saveAnswerSchema.safeParse(patch);
  if (!parsed.success) {
    return { success: false, error: "入力内容を確認してください" };
  }

  // Ensure item is active for this project (auto-activate if missing)
  const row = await prisma.projectChecklist.upsert({
    where: { projectId_itemId: { projectId, itemId } },
    create: { projectId, itemId },
    update: {},
  });

  const data = parsed.data;
  await prisma.venueChecklistAnswer.upsert({
    where: { projectChecklistId_venueId: { projectChecklistId: row.id, venueId } },
    create: {
      projectChecklistId: row.id,
      venueId,
      status: data.status ?? null,
      memo: data.memo ?? null,
      numberValue: data.numberValue ?? null,
      photoUrls: data.photoUrls ?? [],
    },
    update: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.memo !== undefined && { memo: data.memo }),
      ...(data.numberValue !== undefined && { numberValue: data.numberValue }),
      ...(data.photoUrls !== undefined && { photoUrls: data.photoUrls }),
    },
  });

  revalidateTag(answerTag(venueId), { expire: 0 });
  revalidateTag(checklistTag(projectId), { expire: 0 });
  revalidatePath(`/venues/${venueId}/checklist`);
  revalidatePath("/compare");
  return { success: true };
}

// ── Suggested scores from checklist answers (proposal, not auto-saved) ────────

export interface SuggestedScore {
  dimension: string;
  suggestedScore: number;
  currentScore: number | null;
  answeredCount: number;
  totalYesnoItems: number;
}

/**
 * Calculate suggested dimension scores from checklist answers.
 * Does NOT save to DB — returns proposals for user to accept/dismiss.
 */
export async function getSuggestedScores(
  venueId: string,
): Promise<SuggestedScore[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get all active checklist rows for this project
  const activeRows = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { id: true, itemId: true },
  });

  // Get all answers for this venue
  const answers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId,
      projectChecklistId: { in: activeRows.map((r) => r.id) },
    },
    include: { projectChecklist: { select: { itemId: true } } },
  });

  const answerMap = new Map<string, string | null>();
  for (const ans of answers) {
    answerMap.set(ans.projectChecklist.itemId, ans.status);
  }

  // Get current user_rating scores for comparison
  const currentScores = await prisma.venueScore.findMany({
    where: { venueId, source: "user_rating" },
    select: { dimension: true, score: true },
  });
  const currentMap = new Map(
    currentScores.map((s) => [s.dimension, Number(s.score)])
  );

  // Calculate suggestion for each dimension (except overall)
  const { TIER1_DIMENSIONS } = await import("@/lib/constants");
  const suggestions: SuggestedScore[] = [];

  for (const dim of TIER1_DIMENSIONS) {
    if (dim === "overall") continue;

    const score = calculateDimensionScore(dim, answerMap);
    if (score === null) continue;

    const current = currentMap.get(dim) ?? null;

    // Only suggest if different from current (or no current score)
    if (current === null || Math.abs(current - score) >= 0.5) {
      const yesnoItems = CHECKLIST_PRESETS.filter(
        (p) => p.type === "yesno" && (ITEM_TO_DIMENSION as Record<string, string>)[p.id] === dim
      );
      const answered = yesnoItems.filter((p) => {
        const s = answerMap.get(p.id);
        return s === "yes" || s === "no" || s === "unknown";
      }).length;

      suggestions.push({
        dimension: dim,
        suggestedScore: score,
        currentScore: current,
        answeredCount: answered,
        totalYesnoItems: yesnoItems.length,
      });
    }
  }

  return suggestions;
}

/**
 * Accept a suggested score — saves it as user_rating (user-approved).
 */
export async function acceptSuggestedScore(
  venueId: string,
  dimension: string,
  score: number,
): Promise<{ success: boolean }> {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  const dim = dimension as import("@/generated/prisma/client").ScoreDimension;
  await prisma.venueScore.upsert({
    where: {
      venueId_dimension_source: {
        venueId,
        dimension: dim,
        source: "user_rating",
      },
    },
    create: { venueId, dimension: dim, source: "user_rating", score },
    update: { score },
  });

  revalidateTag(`project:${(await requireProjectMembership(user.id)).projectId}`, { expire: 0 });
  revalidatePath(`/venues/${venueId}`);
  return { success: true };
}

// ── Comparison matrix data ─────────────────────────────────────────────────────
// Types + constants moved to `@/lib/comparison-types` so they can live
// alongside the server action without violating Next.js's rule that
// "use server" files expose only async functions. Everything below
// re-exports through the types module so existing call sites continue
// to import from `@/server/actions/checklist` unchanged.

export async function getComparisonMatrix(venueIds: string[]): Promise<ComparisonMatrix> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Clamp to max COMPARE_MAX_VENUES venues. Caller should trim + toast
  // upstream so the user sees why — this is a defence-in-depth clamp.
  const ids = venueIds.slice(0, COMPARE_MAX_VENUES);

  // Verify all venues belong to project. Select the full Deep Extraction
  // surface so comparison-field-registry.ts can show rows like 駐車場 /
  // 送迎 / 提携宿泊 without a second round-trip.
  const venues = await prisma.venue.findMany({
    where: { id: { in: ids }, projectId },
    select: {
      id: true,
      name: true,
      location: true,
      accessInfo: true,
      photoUrls: true,
      costMin: true,
      costMax: true,
      capacityMin: true,
      capacityMax: true,
      ceremonyStyles: true,
      externalRatingValue: true,
      externalReviewCount: true,
      postalCode: true,
      streetAddress: true,
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
      scores: { select: { dimension: true, score: true, source: true } },
    },
  });

  // R2 — pull cross-venue review summaries in a single query and attach
  // per venue. We pass the *project-validated* ids (= venues.map(v.id))
  // rather than raw input ids so the helper can stay auth-free; the
  // upstream membership gate has already filtered the set.
  const reviewSummaries = await getReviewSummariesForVenues(
    venues.map((v) => v.id),
  );

  // Restore requested order and convert Decimal to number
  const orderedVenues: ComparisonVenue[] = ids
    .map((id) => venues.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => v != null)
    .map((v) => ({
      id: v.id,
      name: v.name,
      location: v.location,
      accessInfo: v.accessInfo,
      photoUrls: v.photoUrls,
      costMin: v.costMin,
      costMax: v.costMax,
      capacityMin: v.capacityMin,
      capacityMax: v.capacityMax,
      ceremonyStyles: v.ceremonyStyles,
      externalRatingValue: v.externalRatingValue,
      externalReviewCount: v.externalReviewCount,
      postalCode: v.postalCode,
      streetAddress: v.streetAddress,
      hasParking: v.hasParking,
      parkingCapacity: v.parkingCapacity,
      hasShuttle: v.hasShuttle,
      hasAccommodation: v.hasAccommodation,
      acceptsSecondParty: v.acceptsSecondParty,
      barrierFree: v.barrierFree,
      ceremonyFeeExact: v.ceremonyFeeExact,
      productionFeeMin: v.productionFeeMin,
      productionFeeMax: v.productionFeeMax,
      serviceFeeRate: v.serviceFeeRate === null ? null : Number(v.serviceFeeRate),
      operatingHours: v.operatingHours,
      closedDays: v.closedDays,
      cuisineTypes: v.cuisineTypes,
      chefCredentials: v.chefCredentials,
      scores: v.scores.map((s) => ({
        dimension: s.dimension as string,
        source: s.source as string,
        score: Number(s.score),
      })),
      reviewSummary: reviewSummaries.get(v.id),
    }));

  // Active items for this project
  const activeRows = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { id: true, itemId: true },
    orderBy: { createdAt: "asc" },
  });

  const activeItems = activeRows
    .map((r) => {
      const preset = CHECKLIST_PRESETS.find((p) => p.id === r.itemId);
      return preset ? { ...preset, checklistRowId: r.id } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Answers for those venues
  const answerRows = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId: { in: ids },
      projectChecklistId: { in: activeRows.map((r) => r.id) },
    },
    include: { projectChecklist: { select: { itemId: true } } },
  });

  const answers: Record<string, Record<string, ComparisonAnswer>> = {};
  // PR #5: per-venue child score map. Populated alongside `answers` so
  // the v3 plan C3 aggregator (mean of rated children → parent dim) can
  // read it directly off ComparisonVenue without a second query.
  const childScoresByVenue = new Map<string, Record<string, number | null>>();
  for (const ans of answerRows) {
    const itemId = ans.projectChecklist.itemId;
    const numericScore =
      ans.numericScore !== null && ans.numericScore !== undefined
        ? Number(ans.numericScore)
        : null;
    if (!answers[itemId]) answers[itemId] = {};
    answers[itemId][ans.venueId] = {
      status: ans.status,
      memo: ans.memo,
      numberValue: ans.numberValue ? Number(ans.numberValue) : null,
      numericScore,
      photoUrls: ans.photoUrls,
    };
    if (numericScore !== null) {
      const existing = childScoresByVenue.get(ans.venueId) ?? {};
      existing[itemId] = numericScore;
      childScoresByVenue.set(ans.venueId, existing);
    }
  }

  // Attach childScores to each venue so accessUserScoreForDim can
  // call aggregateChildScoresToDimensions without an extra round-trip.
  for (const venue of orderedVenues) {
    const map = childScoresByVenue.get(venue.id);
    if (map && Object.keys(map).length > 0) {
      venue.childScores = map;
    }
  }

  return {
    venues: orderedVenues,
    items: activeItems.map(({ id, category, subcategory, question, type }) => ({
      id,
      category,
      subcategory,
      question,
      type,
    })),
    answers,
  };
}

// ── Get favorites venue ids for compare default ────────────────────────────────

export async function getFavoriteVenueIds(): Promise<string[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const favorites = await prisma.venueFavorite.findMany({
    where: { userId: user.id, venue: { projectId, deletedAt: null } },
    select: { venueId: true },
    orderBy: { createdAt: "desc" },
    take: COMPARE_MAX_VENUES,
  });

  return favorites.map((f) => f.venueId);
}

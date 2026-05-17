"use server";

/**
 * Checklist rating server actions — write side for the v3 plan §1.2 C3 model
 * shift (child checklist items carry 0.5–5.0 scores, parent dimension =
 * mean of children).
 *
 * # Auth contract (= critic blocker #6 from v3 plan §3.1)
 *
 * Every write here MUST run `requireUser()` followed by either
 * `requireVenueAccess(user.id, venueId)` or `requireProjectMembership(user.id)`
 * BEFORE touching Prisma. The helpers throw on mismatch so an attacker
 * passing a foreign venueId / projectChecklistId gets a clean rejection.
 *
 * Reviewer-grep contract: every exported async function in this file must
 * start with `requireUser(` so a future contributor adding a new endpoint
 * cannot accidentally omit the check — the PR template includes a checklist
 * item for this.
 */

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidateTag } from "next/cache";
import {
  requireUser,
  requireProjectMembership,
  requireVenueAccess,
} from "@/server/auth";

// ─── shared validators ───────────────────────────────────────────────────

/** 0.5–5.0 in 0.5 increments — matches the DB CHECK constraint added in
 *  migration `20260515000000_*`. Mirrored here so client errors are
 *  pretty messages instead of a raw PostgreSQL violation. */
const scoreSchema = z
  .number()
  .min(0.5, "0.5 以上で入力してください")
  .max(5.0, "5.0 以下で入力してください")
  .refine(
    (n) => Number.isFinite(n) && Math.abs(Math.round(n * 2) - n * 2) < 1e-9,
    "0.5 刻みで入力してください",
  );

const cuidSchema = z
  .string()
  .min(1, "id が空です")
  .max(60, "id が長すぎます");

const uuidSchema = z.string().uuid("invalid venueId");

const saveChildRatingInputSchema = z.object({
  venueId: uuidSchema,
  itemId: cuidSchema,
  score: scoreSchema.nullable(),
});

const bulkSetDimensionInputSchema = z.object({
  venueId: uuidSchema,
  itemIds: z.array(cuidSchema).min(1, "対象項目が空です"),
  score: scoreSchema,
});

const addCustomItemInputSchema = z.object({
  category: z
    .string()
    .min(1, "カテゴリを選んでください")
    .max(40, "カテゴリ名が長すぎます"),
  subcategory: z.string().max(40).nullable().optional(),
  question: z
    .string()
    .min(2, "問いを 2 文字以上で書いてください")
    .max(140, "問いは 140 文字以内に収めてください"),
});

const deleteCustomItemInputSchema = z.object({
  customItemId: cuidSchema,
});

// ─── invalidation ────────────────────────────────────────────────────────

/** Fine-grained cache tags so a single child score update only re-renders
 *  the affected venue's comparison row, not the whole `/compare` page —
 *  addresses v3 plan critic blocker #14 (revalidatePath jank). */
function venueScoreTag(venueId: string) {
  return `venue-checklist-scores:${venueId}`;
}

function projectChecklistTag(projectId: string) {
  return `project-checklist:${projectId}`;
}

// ─── helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve (or create) the `ProjectChecklist` row that ties this item to the
 * couple's active checklist. A child rating cannot land unless the project
 * already has the item enabled — but the UI sometimes wants a "rate it and
 * also turn it on" one-shot flow, so we upsert here defensively.
 *
 * @throws when the itemId isn't a known preset and isn't a custom item the
 *         couple owns (= cross-project IDOR attempt).
 */
async function ensureProjectChecklist(
  projectId: string,
  itemId: string,
): Promise<{ id: string }> {
  const existing = await prisma.projectChecklist.findUnique({
    where: { projectId_itemId: { projectId, itemId } },
    select: { id: true },
  });
  if (existing) return existing;

  // Validate the itemId before creating — either it's a static preset
  // (we trust the in-code library) or it's a custom item we own.
  const { CHECKLIST_PRESETS } = await import("@/lib/checklist-presets");
  const isPreset = CHECKLIST_PRESETS.some((p) => p.id === itemId);
  if (!isPreset) {
    const custom = await prisma.customChecklistItem.findUnique({
      where: { id: itemId },
      select: { projectId: true, deletedAt: true },
    });
    if (!custom || custom.projectId !== projectId || custom.deletedAt) {
      throw new Error("評価項目が見つからないか、アクセス権がありません");
    }
  }

  return prisma.projectChecklist.create({
    data: { projectId, itemId },
    select: { id: true },
  });
}

// ─── server actions ──────────────────────────────────────────────────────

/**
 * Save (or clear) a single child item's 0.5–5.0 score for one venue.
 *
 * @param score — pass `null` to clear an existing score (= "untap").
 *                Validation: 0.5 ≤ score ≤ 5.0, 0.5-step grid.
 */
export async function saveChildRating(input: {
  venueId: string;
  itemId: string;
  score: number | null;
}) {
  const parsed = saveChildRatingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, parsed.data.venueId);

  const checklist = await ensureProjectChecklist(projectId, parsed.data.itemId);

  await prisma.venueChecklistAnswer.upsert({
    where: {
      projectChecklistId_venueId_userId: {
        projectChecklistId: checklist.id,
        venueId: parsed.data.venueId,
        userId: user.id,
      },
    },
    create: {
      projectChecklistId: checklist.id,
      venueId: parsed.data.venueId,
      userId: user.id,
      numericScore: parsed.data.score,
    },
    update: {
      numericScore: parsed.data.score,
    },
  });

  revalidateTag(venueScoreTag(parsed.data.venueId), { expire: 0 });
  revalidateTag(projectChecklistTag(projectId), { expire: 0 });

  return { success: true as const };
}

/**
 * Shortcut: stamp the same score onto every supplied child item for a venue
 * — used by the "rate the parent dimension and propagate down" UI flow.
 *
 * Wrapped in a transaction so partial failures don't leave one item rated
 * and the next unrated.
 */
export async function bulkSetDimensionRating(input: {
  venueId: string;
  itemIds: string[];
  score: number;
}) {
  const parsed = bulkSetDimensionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, parsed.data.venueId);

  await prisma.$transaction(async (tx) => {
    for (const itemId of parsed.data.itemIds) {
      const existing = await tx.projectChecklist.findUnique({
        where: { projectId_itemId: { projectId, itemId } },
        select: { id: true },
      });
      const checklist =
        existing ??
        (await tx.projectChecklist.create({
          data: { projectId, itemId },
          select: { id: true },
        }));

      await tx.venueChecklistAnswer.upsert({
        where: {
          projectChecklistId_venueId_userId: {
            projectChecklistId: checklist.id,
            venueId: parsed.data.venueId,
            userId: user.id,
          },
        },
        create: {
          projectChecklistId: checklist.id,
          venueId: parsed.data.venueId,
          userId: user.id,
          numericScore: parsed.data.score,
        },
        update: { numericScore: parsed.data.score },
      });
    }
  });

  revalidateTag(venueScoreTag(parsed.data.venueId), { expire: 0 });
  revalidateTag(projectChecklistTag(projectId), { expire: 0 });

  return { success: true as const };
}

/**
 * Create a custom checklist question for the current project. Returns the
 * new item id so the UI can immediately route the user to scoring it.
 */
export async function addCustomChecklistItem(input: {
  category: string;
  subcategory?: string | null;
  question: string;
}) {
  const parsed = addCustomItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Soft cap: 50 active custom items per project. Beyond this, the
  // comparison drawer's child list becomes unscannable and the
  // aggregator divisor grows large enough that single-item rating
  // changes barely move the parent average. The UI should already
  // surface a warning, but enforce DB-side too.
  const activeCount = await prisma.customChecklistItem.count({
    where: { projectId, deletedAt: null },
  });
  if (activeCount >= 50) {
    return {
      success: false as const,
      error: {
        formErrors: ["カスタム評価項目は 1 つのふたりにつき 50 件までです"],
        fieldErrors: {},
      },
    };
  }

  const created = await prisma.customChecklistItem.create({
    data: {
      projectId,
      category: parsed.data.category,
      subcategory: parsed.data.subcategory ?? null,
      question: parsed.data.question,
    },
    select: { id: true },
  });

  revalidateTag(projectChecklistTag(projectId), { expire: 0 });

  return { success: true as const, itemId: created.id };
}

/**
 * Get the viewer's and partner's child-item scores for a single venue.
 *
 * Mirrors `getCoupleRatings` (= parent dimension version in `ratings.ts`):
 * returns `{ ownScoreByItemId, partnerScoreByItemId, partnerName }` so
 * `<ChildRatingPanel>` can render the partner's value as a quiet overlay
 * under each child chip without a second round trip.
 *
 * Returns null `partnerScoreByItemId` when the project has no accepted
 * partner yet (single-member project). Each map keys ProjectChecklist
 * `itemId` (preset id or CustomChecklistItem cuid) → 0.5–5 numericScore
 * or null if the user hasn't graded that item yet.
 */
export async function getCoupleChecklistAnswers(venueId: string): Promise<{
  ownScoreByItemId: Record<string, number | null>;
  partnerScoreByItemId: Record<string, number | null> | null;
  partnerName: string | null;
}> {
  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId);

  // Resolve project members (= same shape as getCoupleRatings)
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: {
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });
  const other = members.find((m) => m.userId !== user.id);

  // Single round-trip: pull every project member's answers for this venue
  // then split by userId in JS. Matches the pattern in `getCoupleRatings`
  // — one query is cheaper than two userId-filtered round trips.
  const answerRows = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId,
      projectChecklist: { projectId },
    },
    select: {
      userId: true,
      numericScore: true,
      projectChecklist: { select: { itemId: true } },
    },
  });

  function buildMap(userId: string): Record<string, number | null> {
    const map: Record<string, number | null> = {};
    for (const row of answerRows) {
      if (row.userId !== userId) continue;
      map[row.projectChecklist.itemId] =
        row.numericScore !== null && row.numericScore !== undefined
          ? Number(row.numericScore)
          : null;
    }
    return map;
  }

  return {
    ownScoreByItemId: buildMap(user.id),
    partnerScoreByItemId: other ? buildMap(other.userId) : null,
    partnerName: other ? other.user?.name ?? other.user?.email ?? null : null,
  };
}

/**
 * Soft-delete a custom item — keeps any historical VenueChecklistAnswer
 * rows recoverable so a couple who flips off a question and back on
 * doesn't lose their grades.
 */
export async function deleteCustomChecklistItem(input: {
  customItemId: string;
}) {
  const parsed = deleteCustomItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Authz: this user's project must own the item.
  const target = await prisma.customChecklistItem.findUnique({
    where: { id: parsed.data.customItemId },
    select: { projectId: true, deletedAt: true },
  });
  if (!target || target.projectId !== projectId) {
    return {
      success: false as const,
      error: {
        formErrors: ["削除する項目が見つかりませんでした"],
        fieldErrors: {},
      },
    };
  }
  if (target.deletedAt) {
    return { success: true as const };
  }

  await prisma.customChecklistItem.update({
    where: { id: parsed.data.customItemId },
    data: { deletedAt: new Date() },
  });

  revalidateTag(projectChecklistTag(projectId), { expire: 0 });

  return { success: true as const };
}

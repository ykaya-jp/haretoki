"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { TIER1_DIMENSIONS, type Tier1Dimension } from "@/lib/constants";
import {
  coerceWeights,
  computeCoupleWeights,
  defaultWeights,
  opinionAlignmentScore,
  WEIGHT_MIN,
  WEIGHT_MAX,
  type Weights,
} from "@/lib/weighted-score";

/**
 * W12-1: per-member dimension weights API.
 *
 * Each ProjectMember stores their own weights (see prisma/schema.prisma →
 * ProjectMember.weights) because the same user can hold different priorities
 * across different projects (the person rarely has two, but the shape also
 * keeps owner/partner distinct weights for the same project — central to
 * the "2人の好みは違って当たり前" product stance).
 *
 * API contract:
 * - getMyWeights(): always returns a fully-populated Record<Dim, number>.
 *   Never returns null. Unset DB rows fall back to `defaultWeights()` so
 *   the UI can render sliders at the neutral 3 without null-guards.
 * - updateMyWeights(): accepts a partial Record, coerces + validates,
 *   writes through. Invalidates the project cache tag so candidate /
 *   comparison views re-render with the new ranking.
 */

const weightValueSchema = z
  .number()
  .int()
  .min(WEIGHT_MIN, { message: `重みは ${WEIGHT_MIN} 以上にしてください` })
  .max(WEIGHT_MAX, { message: `重みは ${WEIGHT_MAX} 以下にしてください` });

// Per-dimension optional — absent keys fall back to the default (3).
const weightsInputSchema = z
  .object(
    Object.fromEntries(
      TIER1_DIMENSIONS.map((dim) => [dim, weightValueSchema.optional()]),
    ) as Record<Tier1Dimension, z.ZodOptional<typeof weightValueSchema>>,
  )
  .strict();

export type WeightsInput = z.infer<typeof weightsInputSchema>;

/**
 * Return the current user's weights for the given project. Missing row or
 * NULL json column both yield the neutral default (3 everywhere). Scoped to
 * the caller's membership — callers never pass their own userId so UI
 * components can't be tricked into reading a foreign member's row.
 */
export async function getMyWeights(): Promise<Weights> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { weights: true },
  });

  return coerceWeights(member?.weights ?? null);
}

/**
 * Persist the current user's weights. Returns the stored (coerced) record
 * so the UI can reconcile its state without a second round-trip.
 */
export async function updateMyWeights(
  input: unknown,
): Promise<
  | { success: true; weights: Weights }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const parsed = weightsInputSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      success: false,
      error: "重みの値に問題があります",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  // Coerce into a full record so the DB never holds a sparse object — this
  // matches what coerceWeights() returns on read, keeping write/read
  // symmetric and avoiding "silently drifted to 3" surprises when a new
  // dimension is added later.
  const full = { ...defaultWeights(), ...parsed.data };

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: user.id } },
    data: { weights: full as Prisma.InputJsonValue },
  });

  // Candidates tab + comparison view + VenueCards all read through the
  // `project:<id>` cache tag used by favorites.fetchFavorites. Busting it
  // is the same pattern toggleFavorite() uses when it changes ordering.
  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/candidates");
  revalidatePath("/mypage");

  return { success: true, weights: full };
}

/**
 * W13-1: fetch both members' weights and the synthesised couple mix.
 *
 * Contract:
 *  - `mine` is always the viewer's record (coerced → no nulls).
 *  - `partner` is null when no accepted partner exists on the project.
 *    When partner exists but their `weights` row is unset/null, we still
 *    return `coerceWeights(null)` (all 3s) and flag `partnerHasWeights: false`
 *    so the UI can show a "パートナーはまだ重みを設定していません" chip.
 *  - `couple` is always a safe, fully-populated Weights map — callers can
 *    pass it straight into computeWeighted() without null-guards.
 *  - `alignment` is a 0-100 integer when a partner exists, else null.
 *  - `hasPartner` is true only when an accepted ProjectMember other than
 *    the viewer exists. We check `acceptedAt != null` to match the
 *    CoupleGapSection gating rule — pending invitations don't count.
 *
 * Scoped by the caller's membership (same pattern as getMyWeights) so no
 * foreign-project leaks are possible from the client.
 */
export interface CoupleWeightsResult {
  mine: Weights;
  partner: Weights | null;
  couple: Weights;
  alignment: number | null;
  hasPartner: boolean;
  partnerHasWeights: boolean;
  partnerName: string | null;
}

export async function getCoupleWeights(): Promise<CoupleWeightsResult> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: {
      userId: true,
      weights: true,
      user: { select: { name: true } },
    },
  });

  const me = members.find((m) => m.userId === user.id);
  const partner = members.find((m) => m.userId !== user.id);

  const mine = coerceWeights(me?.weights ?? null);

  if (!partner) {
    // Solo project — no couple mode available. Returning mine as the
    // couple mix keeps downstream math valid in case a caller forgets
    // to gate on hasPartner, but alignment is null so UI can suppress
    // the badge cleanly.
    return {
      mine,
      partner: null,
      couple: mine,
      alignment: null,
      hasPartner: false,
      partnerHasWeights: false,
      partnerName: null,
    };
  }

  // partnerHasWeights: distinguish "unset NULL row" from "explicit all-3s"
  // so the UI chip can nudge the partner to express their preferences.
  // Prisma returns Prisma.JsonNull / DB NULL as `null`, and a saved {} or
  // full map as an object — checking `!= null && typeof === 'object'` is
  // the clean discriminator.
  const rawPartnerWeights = partner.weights;
  const partnerHasWeights =
    rawPartnerWeights !== null &&
    rawPartnerWeights !== undefined &&
    typeof rawPartnerWeights === "object";

  const partnerWeights = coerceWeights(rawPartnerWeights ?? null);
  const couple = computeCoupleWeights(mine, partnerWeights);
  const alignment = opinionAlignmentScore(mine, partnerWeights);

  return {
    mine,
    partner: partnerWeights,
    couple,
    alignment,
    hasPartner: true,
    partnerHasWeights,
    partnerName: partner.user?.name ?? null,
  };
}

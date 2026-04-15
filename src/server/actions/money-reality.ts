"use server";

import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireVenueAccess } from "@/server/auth";
import {
  detectMissingItems,
  detectUpgradeRisks,
  STATIC_NEGOTIATION_TIPS,
  type MissingRule,
  type UpgradeRiskRule,
  type NegotiationTip,
} from "@/lib/money-reality-rules";

export interface MoneyRealityReport {
  estimateId: string;
  total: number;
  missing: MissingRule[];
  upgradeRisks: UpgradeRiskRule[];
  reviewStats: {
    avgDeltaYen: number | null;
    avgDeltaPct: number | null;
    sampleCount: number | null;
  };
  negotiationTips: NegotiationTip[];
}

/**
 * E-6 Money Reality Check: pure static rules + venue review aggregate.
 * Claude is NOT called here — keeps the venue-detail page fast + free.
 */
export async function getMoneyReality(
  estimateId: string,
): Promise<MoneyRealityReport | null> {
  return fetchMoneyReality(estimateId);
}

async function fetchMoneyReality(
  estimateId: string,
): Promise<MoneyRealityReport | null> {
  "use cache";
  cacheTag(`estimate:${estimateId}:reality`);

  const user = await requireUser();

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      items: { select: { itemName: true, category: true, amount: true } },
      venue: {
        select: {
          id: true,
          projectId: true,
          reviewEstimateDeltaYen: true,
          reviewEstimateDeltaPct: true,
          reviewEstimateSampleCount: true,
        },
      },
    },
  });
  if (!estimate) return null;

  // IDOR guard: user must have access to this venue's project.
  await requireVenueAccess(user.id, estimate.venueId);

  const missing = detectMissingItems(estimate.items);
  const upgradeRisks = detectUpgradeRisks(estimate.items);

  return {
    estimateId,
    total: estimate.total,
    missing,
    upgradeRisks,
    reviewStats: {
      avgDeltaYen: estimate.venue.reviewEstimateDeltaYen,
      avgDeltaPct:
        estimate.venue.reviewEstimateDeltaPct !== null
          ? Number(estimate.venue.reviewEstimateDeltaPct)
          : null,
      sampleCount: estimate.venue.reviewEstimateSampleCount,
    },
    // Static tips always available. Claude-personalized tips can be layered
    // on later via a separate async action.
    negotiationTips: [...STATIC_NEGOTIATION_TIPS],
  };
}

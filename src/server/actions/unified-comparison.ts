"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { getChecklistItemsForDimension } from "@/lib/dimension-checklist-map";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";
import { getMatrixData } from "@/server/actions/matrix";
import type { MatrixVenue } from "@/server/actions/matrix";

export type { MatrixVenue };

export interface ChecklistItemAnswer {
  status: string | null;
  memo: string | null;
}

export interface ChecklistItemComparison {
  itemId: string;
  question: string;
  type: string;
  answers: Record<string, ChecklistItemAnswer>; // venueId → answer
  hasDifference: boolean;
}

export interface DimensionWithChecklist {
  id: string;
  label: string;
  scores: Record<string, number | null>; // venueId → score
  winnerId: string | null;
  checklistItems: ChecklistItemComparison[];
  totalItems: number;
  answeredItems: number;
}

export interface UnifiedComparisonData {
  venues: MatrixVenue[];
  dimensions: DimensionWithChecklist[];
  totalScore: Record<string, number | null>;
  costWinnerId: string | null;
  unmappedItems: ChecklistItemComparison[]; // dress_item etc.
}

/** Merges score matrix data with checklist answers into one unified response. */
export async function getUnifiedComparisonData(): Promise<UnifiedComparisonData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const matrixData = await getMatrixData();

  if (matrixData.venues.length === 0) {
    return {
      venues: [],
      dimensions: TIER1_DIMENSIONS.map((id) => ({
        id,
        label: DIMENSION_LABELS[id] ?? id,
        scores: {},
        winnerId: null,
        checklistItems: [],
        totalItems: 0,
        answeredItems: 0,
      })),
      totalScore: {},
      costWinnerId: null,
      unmappedItems: [],
    };
  }

  const venueIds = matrixData.venues.map((v) => v.id);

  // Fetch all checklist answers for these venues in one query
  const rawAnswers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId: { in: venueIds },
      projectChecklist: { projectId },
    },
    select: {
      venueId: true,
      status: true,
      memo: true,
      projectChecklist: { select: { itemId: true } },
    },
  });

  // Index: itemId → venueId → answer
  const answerIndex = new Map<string, Map<string, ChecklistItemAnswer>>();
  for (const row of rawAnswers) {
    const itemId = row.projectChecklist.itemId;
    if (!answerIndex.has(itemId)) {
      answerIndex.set(itemId, new Map());
    }
    answerIndex.get(itemId)!.set(row.venueId, {
      status: row.status ?? null,
      memo: row.memo ?? null,
    });
  }

  /** Build ChecklistItemComparison for a given preset itemId */
  function buildItemComparison(
    itemId: string,
    question: string,
    type: string,
  ): ChecklistItemComparison {
    const byVenue = answerIndex.get(itemId);
    const answers: Record<string, ChecklistItemAnswer> = {};
    const statuses: string[] = [];

    for (const venueId of venueIds) {
      const ans = byVenue?.get(venueId) ?? { status: null, memo: null };
      answers[venueId] = ans;
      if (ans.status !== null) statuses.push(ans.status);
    }

    const uniqueStatuses = new Set(statuses);
    const hasDifference = statuses.length >= 2 && uniqueStatuses.size > 1;

    return { itemId, question, type, answers, hasDifference };
  }

  const mappedItemIds = new Set<string>();

  // Build dimensions with checklist items
  const dimensions: DimensionWithChecklist[] = TIER1_DIMENSIONS.map((dimId) => {
    const label = DIMENSION_LABELS[dimId] ?? dimId;
    const scores: Record<string, number | null> = {};
    for (const v of matrixData.venues) {
      scores[v.id] = v.scoresByDimension[dimId] ?? null;
    }
    const winnerId = matrixData.winners[dimId] ?? null;

    const presets = getChecklistItemsForDimension(dimId);
    const checklistItems: ChecklistItemComparison[] = presets.map((preset) => {
      mappedItemIds.add(preset.id);
      return buildItemComparison(preset.id, preset.question, preset.type);
    });

    const answeredItems = checklistItems.filter((ci) =>
      venueIds.some((vid) => ci.answers[vid]?.status !== null),
    ).length;

    return {
      id: dimId,
      label,
      scores,
      winnerId,
      checklistItems,
      totalItems: checklistItems.length,
      answeredItems,
    };
  });

  // Collect unmapped preset items (e.g. dress_item category)
  const unmappedPresets = CHECKLIST_PRESETS.filter(
    (preset) => !mappedItemIds.has(preset.id),
  );
  const unmappedItems: ChecklistItemComparison[] = unmappedPresets.map((preset) =>
    buildItemComparison(preset.id, preset.question, preset.type),
  );

  // Build totalScore and costWinnerId maps from matrixData
  const totalScore: Record<string, number | null> = {};
  for (const v of matrixData.venues) {
    totalScore[v.id] = v.totalScore;
  }
  const costWinnerId = matrixData.winners.cost_value ?? null;

  return {
    venues: matrixData.venues,
    dimensions,
    totalScore,
    costWinnerId,
    unmappedItems,
  };
}

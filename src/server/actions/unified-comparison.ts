"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { TIER1_DIMENSIONS, DIMENSION_LABELS, LEGACY_DIMENSION_MAP } from "@/lib/constants";
import { getChecklistItemsForDimension } from "@/lib/dimension-checklist-map";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";
export interface ComparisonVenue {
  id: string;
  name: string;
  photoUrl: string | null;
  totalScore: number | null;
  scoresByDimension: Record<string, number | null>;
  costMin: number | null;
  costMax: number | null;
  latestEstimateTotal: number | null;
}

export interface ChecklistItemAnswer {
  status: string | null;
  memo: string | null;
  /** PR #5 (0.5–5) child grade — surfaced under each parent dim in the
   *  /candidates compare view so couples can see how each side scored
   *  each child item, not just the parent dimension mean. Null until
   *  they tap a chip on /venues/[id]/impression. */
  numericScore: number | null;
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

/** For each venue, which project members have favorited it. Lets the
 *  compare UI filter to "自分 / パートナー / おふたり / すべて" without
 *  an extra server round-trip. Values are "me" / "partner" from the
 *  caller's perspective. */
export type FavoritedByMap = Record<string, ("me" | "partner")[]>;

export interface UnifiedComparisonData {
  venues: ComparisonVenue[];
  dimensions: DimensionWithChecklist[];
  totalScore: Record<string, number | null>;
  costWinnerId: string | null;
  unmappedItems: ChecklistItemComparison[];
  favoritedBy: FavoritedByMap;
}

/** Merges score matrix data with checklist answers into one unified response.
 *  Fetches ALL project venues (not just favorites) so comparison works
 *  even when the user hasn't pressed ♡ yet. */
export async function getUnifiedComparisonData(): Promise<UnifiedComparisonData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [allVenues, favorites] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId },
      include: {
        scores: { where: { source: { in: ["user_rating", "ai_analysis", "checklist_derived"] } } },
        estimates: { orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.venueFavorite.findMany({
      where: { venue: { projectId } },
      select: { venueId: true, userId: true },
    }),
  ]);

  // Build venueId → ["me" | "partner"] map. "me" = current caller,
  // "partner" = any other member of the same project. Two-member model,
  // so a non-self userId is unambiguously the partner.
  const favoritedBy: FavoritedByMap = {};
  for (const f of favorites) {
    const tag: "me" | "partner" = f.userId === user.id ? "me" : "partner";
    const list = favoritedBy[f.venueId] ?? [];
    if (!list.includes(tag)) list.push(tag);
    favoritedBy[f.venueId] = list;
  }

  if (allVenues.length === 0) {
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
      favoritedBy,
    };
  }

  const venues: ComparisonVenue[] = allVenues.map((v) => {
    const scoresByDimension: Record<string, number | null> = {};
    // Build reverse map: new dimension → legacy keys that map to it
    const legacyKeys: Record<string, string[]> = {};
    for (const [oldKey, newKey] of Object.entries(LEGACY_DIMENSION_MAP)) {
      if (!legacyKeys[newKey]) legacyKeys[newKey] = [];
      legacyKeys[newKey].push(oldKey);
    }
    for (const dimId of TIER1_DIMENSIONS) {
      // Try new key first, then fall back to legacy keys
      const keysToTry = [dimId, ...(legacyKeys[dimId] ?? [])];
      let bestScore: number | null = null;
      for (const key of keysToTry) {
        const userScore = v.scores.find((s) => s.dimension === key && s.source === "user_rating");
        const aiScore = v.scores.find((s) => s.dimension === key && s.source === "ai_analysis");
        const checklistScore = v.scores.find((s) => s.dimension === key && s.source === "checklist_derived");
        const match = userScore ?? aiScore ?? checklistScore;
        if (match) { bestScore = Number(match.score); break; }
      }
      scoresByDimension[dimId] = bestScore;
    }
    const validScores = Object.values(scoresByDimension).filter((s): s is number => s !== null);
    const totalScore = validScores.length > 0
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : null;
    return {
      id: v.id,
      name: v.name,
      photoUrl: v.photoUrls[0] ?? null,
      totalScore,
      scoresByDimension,
      costMin: v.costMin,
      costMax: v.costMax,
      latestEstimateTotal: v.estimates[0]?.total ?? null,
    };
  });

  const venueIds = venues.map((v) => v.id);

  // Compute winners
  const winners: Record<string, string> = {};
  if (venues.length > 1) {
    const topTotal = venues.reduce<ComparisonVenue | null>((acc, v) => {
      if (v.totalScore === null) return acc;
      if (!acc || acc.totalScore === null) return v;
      return v.totalScore > acc.totalScore ? v : acc;
    }, null);
    if (topTotal) winners.total = topTotal.id;
    for (const dimId of TIER1_DIMENSIONS) {
      const top = venues.reduce<ComparisonVenue | null>((acc, v) => {
        const s = v.scoresByDimension[dimId];
        if (s === null) return acc;
        const accS = acc?.scoresByDimension[dimId];
        if (!acc || accS === null || accS === undefined) return v;
        return s > accS ? v : acc;
      }, null);
      if (top) winners[dimId] = top.id;
    }
    const topCost = venues.reduce<ComparisonVenue | null>((acc, v) => {
      const cost = v.latestEstimateTotal ?? v.costMax ?? v.costMin;
      if (cost === null) return acc;
      const accCost = acc ? (acc.latestEstimateTotal ?? acc.costMax ?? acc.costMin) : null;
      if (!acc || accCost === null) return v;
      return cost < accCost ? v : acc;
    }, null);
    if (topCost) winners.cost_value = topCost.id;
  }

  // Fetch active checklist items (items the user turned ON in /checklist settings)
  const activeChecklist = await prisma.projectChecklist.findMany({
    where: { projectId },
    select: { itemId: true },
  });
  const activeItemIds = new Set(activeChecklist.map((c) => c.itemId));

  // Viewer-aware: pull only this user's checklist answers. After the
  // per-user authorship migration, spouses each keep their own row per
  // checklist item — mixing them here would surface whichever side's
  // upsert landed last. The Release δ 4-perspective tab swaps this for
  // a couple-wide pull so each tab can render its own slice.
  const rawAnswers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId: { in: venueIds },
      userId: user.id,
      projectChecklist: { projectId },
    },
    select: {
      venueId: true,
      status: true,
      memo: true,
      numericScore: true,
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
    const venueAnswerMap = answerIndex.get(itemId);
    if (!venueAnswerMap) continue;
    venueAnswerMap.set(row.venueId, {
      status: row.status ?? null,
      memo: row.memo ?? null,
      numericScore:
        row.numericScore !== null && row.numericScore !== undefined
          ? Number(row.numericScore)
          : null,
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
      const ans = byVenue?.get(venueId) ?? {
        status: null,
        memo: null,
        numericScore: null,
      };
      answers[venueId] = ans;
      if (ans.status !== null) statuses.push(ans.status);
    }

    // hasDifference now considers BOTH status and numericScore so a
    // child item where every venue says "yes" but one is rated 4.5 and
    // another 2.0 correctly surfaces when the "差がある項目だけ" filter
    // is on. Combine the two signals into a tuple per venue.
    const tuples = venueIds.map((vid) => {
      const a = answers[vid];
      return `${a?.status ?? "—"}|${a?.numericScore ?? "—"}`;
    });
    const nonEmpty = tuples.filter((t) => t !== "—|—");
    const hasDifference = nonEmpty.length >= 2 && new Set(nonEmpty).size > 1;

    return { itemId, question, type, answers, hasDifference };
  }

  const mappedItemIds = new Set<string>();

  // Build dimensions with checklist items
  const dimensions: DimensionWithChecklist[] = TIER1_DIMENSIONS.map((dimId) => {
    const label = DIMENSION_LABELS[dimId] ?? dimId;
    const scores: Record<string, number | null> = {};
    for (const v of venues) {
      scores[v.id] = v.scoresByDimension[dimId] ?? null;
    }
    const winnerId = winners[dimId] ?? null;

    const allPresets = getChecklistItemsForDimension(dimId);
    const presets = activeItemIds.size > 0
      ? allPresets.filter((p) => activeItemIds.has(p.id))
      : allPresets;
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

  // Collect unmapped preset items (e.g. dress_item category), filtered by active
  const unmappedPresets = CHECKLIST_PRESETS.filter(
    (preset) => !mappedItemIds.has(preset.id) && (activeItemIds.size === 0 || activeItemIds.has(preset.id)),
  );
  const unmappedItems: ChecklistItemComparison[] = unmappedPresets.map((preset) =>
    buildItemComparison(preset.id, preset.question, preset.type),
  );

  const totalScore: Record<string, number | null> = {};
  for (const v of venues) {
    totalScore[v.id] = v.totalScore;
  }
  const costWinnerId = winners.cost_value ?? null;

  return {
    venues,
    dimensions,
    totalScore,
    costWinnerId,
    unmappedItems,
    favoritedBy,
  };
}

"use server";

import { cache } from "react";
import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

type InsightType = "estimate" | "partner" | "visit" | "comparison" | "reminder";

export interface AIInsight {
  id: string;
  type: InsightType;
  title: string;
  body: string;
  venueId?: string;
  venueName?: string;
  actions: Array<{ label: string; href: string }>;
  priority: number;
  /** R-4: days since generation — UI fades after 3, archives after 7. */
  ageDays?: number;
}

/**
 * Cached inner loader. Keyed on (projectId, userId).
 * "use cache" provides cross-request durable caching; revalidated via
 * revalidateTag("project:<id>") on mutations.
 */
async function fetchAIInsights(projectId: string, userId: string): Promise<AIInsight[]> {
  "use cache";
  cacheTag(`project:${projectId}`);

  const insights: AIInsight[] = [];

  // Get project data
  const [venues, favorites, estimates, decision] = await Promise.all([
    prisma.venue.findMany({
      where: { projectId },
      include: {
        scores: { where: { source: "user_rating" } },
        visits: { select: { id: true, status: true, scheduledAt: true } },
      },
    }),
    prisma.venueFavorite.count({ where: { userId, venue: { projectId } } }),
    prisma.estimate.findMany({
      where: { projectId },
      include: { items: true, venue: { select: { name: true } } },
    }),
    prisma.decision.findUnique({ where: { projectId } }),
  ]);

  // Skip if decision already made
  if (decision) {
    return [{
      id: "decision-made",
      type: "reminder",
      title: "おめでとうございます",
      body: "式場が決定しました！次のステップに進みましょう。",
      actions: [{ label: "決定を見る", href: "/candidates?tab=decision" }],
      priority: 1,
    }];
  }

  // 1. Estimate insights: check for upgrade risks
  for (const est of estimates) {
    const riskyItems = est.items.filter(
      (item) => item.tier === "minimum" && Number(item.upgradeProbability ?? 0) > 0.5
    );
    if (riskyItems.length > 0) {
      const itemNames = riskyItems.map((i) => i.itemName).join("、");
      insights.push({
        id: `estimate-${est.id}`,
        type: "estimate",
        title: "見積もりに注目ポイントがあります",
        body: `${est.venue.name}の${itemNames}は最低ランクです。一般的に上がりやすい項目です。`,
        venueId: est.venueId,
        venueName: est.venue.name,
        actions: [{ label: "詳しく見る", href: `/venues/${est.venueId}` }],
        priority: 1,
      });
    }
  }

  // 2. Comparison suggestion
  if (favorites >= 2 && venues.length >= 2) {
    insights.push({
      id: "comparison-suggest",
      type: "comparison",
      title: "比較してみましょう",
      body: `${favorites}件の候補があります。比較ボードで並べて見てみませんか？`,
      actions: [{ label: "比べる", href: "/candidates?tab=compare" }],
      priority: 3,
    });
  }

  // 3. Visit reminder: venues visited but not rated (generic)
  for (const venue of venues) {
    const hasVisit = venue.visits.some((v) => v.status === "completed");
    const hasRating = venue.scores.length > 0;
    if (hasVisit && !hasRating) {
      insights.push({
        id: `reminder-rate-${venue.id}`,
        type: "reminder",
        title: "見学の感想を記録しませんか？",
        body: `${venue.name}の見学お疲れさまでした。印象が新鮮なうちに評価を記録しましょう。`,
        venueId: venue.id,
        venueName: venue.name,
        actions: [{ label: "評価する", href: `/venues/${venue.id}` }],
        priority: 4,
      });
    }
  }

  // 3b. Visit reminder (visit_reminder): completed 3+ days ago, VisitRating empty for current user
  {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const venueIds = venues.map((v) => v.id);
    const staleVisits = venueIds.length > 0
      ? await prisma.visit.findMany({
          where: {
            venueId: { in: venueIds },
            status: "completed",
            completedAt: { lte: threeDaysAgo },
          },
          select: {
            id: true,
            venueId: true,
            completedAt: true,
            ratings: { where: { userId }, select: { id: true } },
          },
        })
      : [];

    for (const sv of staleVisits) {
      if (sv.ratings.length > 0) continue;
      const venueName = venues.find((v) => v.id === sv.venueId)?.name ?? sv.venueId;
      const daysDiff = Math.floor(
        (Date.now() - (sv.completedAt?.getTime() ?? 0)) / (24 * 60 * 60 * 1000),
      );
      insights.push({
        id: `visit-reminder-${sv.id}`,
        type: "reminder",
        title: "見学の印象を星で残しませんか？",
        body: `${venueName}を見学してから${daysDiff}日。印象が薄れる前に、星で残してみませんか？`,
        venueId: sv.venueId,
        venueName,
        actions: [{ label: "評価する", href: `/venues/${sv.venueId}#visit` }],
        priority: 3,
      });
    }
  }

  // 4. Getting started
  if (venues.length === 0) {
    insights.push({
      id: "getting-started",
      type: "visit",
      title: "式場探しを始めましょう",
      body: "気になる式場を追加して、比較を始めましょう。URLを貼るだけで情報を自動取得できます。",
      actions: [{ label: "式場を追加", href: "/explore" }],
      priority: 2,
    });
  }

  // 5. Gap Finder: insufficient candidates
  if (venues.length > 0 && venues.length < 3) {
    insights.push({
      id: "gap-venue-count",
      type: "comparison",
      title: "候補が少ないかも",
      body: `現在${venues.length}件の式場があります。比較の幅を広げるなら、3件以上がおすすめです。`,
      actions: [{ label: "もっと式場を探す", href: "/explore" }],
      priority: 3,
    });
  }

  // 6. Gap Finder: no cost data
  const venuesWithoutCost = venues.filter(
    (v) => !estimates.some((e) => e.venueId === v.id),
  );
  if (venues.length > 0 && venuesWithoutCost.length === venues.length) {
    insights.push({
      id: "gap-no-estimate",
      type: "estimate",
      title: "見積もり情報がありません",
      body: "見積もりを入力すると、予算感の比較ができるようになります。",
      actions: [
        { label: "式場を見る", href: "/explore" },
      ],
      priority: 2,
    });
  }

  // 7. Partner Gap Finder: dimensions where user & partner disagree
  const partnerGaps = await findPartnerGaps(userId, projectId, venues);
  for (const gap of partnerGaps.slice(0, 2)) {
    insights.push({
      id: `partner-gap-${gap.venueId}-${gap.dimension}`,
      type: "partner",
      title: "話し合ってみませんか？",
      body: `${gap.venueName}の${gap.dimensionLabel}で、おふたりの評価に${gap.diff}の差があります。お互いの感じ方を共有してみましょう。`,
      venueId: gap.venueId,
      venueName: gap.venueName,
      actions: [{ label: "式場を見る", href: `/venues/${gap.venueId}` }],
      priority: 2,
    });
  }

  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

/** Minimum interval (ms) between fresh insight generation rounds (3 days). */
const INSIGHT_THROTTLE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Rule-based AI insights. No Claude API in Release 1.
 * Returns up to 5 insights sorted by priority.
 * Throttled to generate at most once per 3 days per project.
 *
 * Per-request memoization via React.cache() dedupes calls from home + coach
 * layouts in one SSR pass. "use cache" on fetchAIInsights provides the
 * durable cross-request caching layer.
 */
async function getAIInsightsImpl(): Promise<AIInsight[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Respect notification frequency preference: off → no insights.
  const notifPref = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { frequency: true },
  });
  const frequency = notifPref?.frequency ?? "auto";
  if (frequency === "off") return [];

  // Throttle: skip generation if any AI analysis was recorded within 3 days.
  // Uses the most recent AiAnalysis row as a proxy for "last generated" time.
  const lastAnalysis = await prisma.aiAnalysis.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastAnalysis) {
    const elapsed = Date.now() - lastAnalysis.createdAt.getTime();
    if (elapsed < INSIGHT_THROTTLE_MS) {
      return [];
    }
  }

  const raw = await fetchAIInsights(projectId, user.id);

  // quiet mode: only surface high-priority insights (priority <= 2).
  if (frequency === "quiet") {
    return raw.filter((i) => i.priority <= 2);
  }

  return raw;
}

// Per-request memoization: dedupes calls from home + coach layouts in one SSR
// pass. `cache()` keys on the function identity + arg list, so a second call
// in the same request returns the already-resolved promise.
const cachedGetAIInsights = cache(getAIInsightsImpl);

export async function getAIInsights(): Promise<AIInsight[]> {
  return cachedGetAIInsights();
}

interface PartnerGap {
  venueId: string;
  venueName: string;
  dimension: string;
  dimensionLabel: string;
  diff: string;
}

async function findPartnerGaps(
  userId: string,
  projectId: string,
  venueStubs: Array<{ id: string; name: string }>,
): Promise<PartnerGap[]> {
  // Get members of this project
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: { userId: true },
  });
  const partnerId = members.find((m) => m.userId !== userId)?.userId;
  if (!partnerId) return [];

  const DIMENSION_LABELS: Record<string, string> = {
    atmosphere: "雰囲気",
    cuisine: "料理",
    hospitality: "サービス",
    cost: "コスパ",
    access: "設備",
    reviews: "総合印象",
  };

  if (venueStubs.length === 0) return [];

  // Fetch only visits+ratings for the already-known venues — avoids a full venue re-fetch
  const venueIds = venueStubs.map((v) => v.id);
  const visits = await prisma.visit.findMany({
    where: { venueId: { in: venueIds } },
    select: {
      venueId: true,
      ratings: {
        select: { userId: true, dimension: true, score: true },
      },
    },
  });

  // Build a map from venueId → { id, name } for lookup
  const venueMap = new Map(venueStubs.map((v) => [v.id, v.name]));

  // Group visits by venue
  const visitsByVenue = new Map<string, typeof visits>();
  for (const visit of visits) {
    const list = visitsByVenue.get(visit.venueId) ?? [];
    list.push(visit);
    visitsByVenue.set(visit.venueId, list);
  }

  const gaps: PartnerGap[] = [];

  for (const venueId of venueIds) {
    const venueName = venueMap.get(venueId) ?? venueId;
    const venueVisits = visitsByVenue.get(venueId) ?? [];

    // Aggregate ratings by user and dimension
    const userRatings: Record<string, number> = {};
    const partnerRatings: Record<string, number> = {};

    for (const visit of venueVisits) {
      for (const rating of visit.ratings) {
        if (rating.userId === userId) {
          userRatings[rating.dimension] = Number(rating.score);
        } else if (rating.userId === partnerId) {
          partnerRatings[rating.dimension] = Number(rating.score);
        }
      }
    }

    // Find dimensions with significant disagreement (>= 2 points diff)
    for (const dim of Object.keys(userRatings)) {
      const u = userRatings[dim];
      const p = partnerRatings[dim];
      if (u !== undefined && p !== undefined && Math.abs(u - p) >= 2) {
        gaps.push({
          venueId,
          venueName,
          dimension: dim,
          dimensionLabel: DIMENSION_LABELS[dim] ?? dim,
          diff: `${Math.abs(u - p)}点`,
        });
      }
    }
  }

  // Sort by largest gap first
  return gaps.sort((a, b) => {
    const da = parseInt(a.diff);
    const db = parseInt(b.diff);
    return db - da;
  });
}

"use server";

import { cache } from "react";
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
}

/**
 * Rule-based AI insights. No Claude API in Release 1.
 * Returns up to 5 insights sorted by priority.
 *
 * Wrapped in `React.cache()` so that when home → coach pages both call this
 * within the same SSR request (e.g. via a shared layout render path), the
 * expensive Prisma fan-out only runs once. Cross-request memoization is out
 * of scope for this bundle (it would require `unstable_cache`).
 */
async function getAIInsightsImpl(): Promise<AIInsight[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

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
    prisma.venueFavorite.count({ where: { userId: user.id, venue: { projectId } } }),
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
      actions: [{ label: "決定を見る", href: "/candidates" }],
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
      actions: [{ label: "比較する", href: "/candidates" }],
      priority: 3,
    });
  }

  // 3. Visit reminder: venues visited but not rated
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
  const partnerGaps = await findPartnerGaps(user.id, projectId);
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

  // Get all ratings for both users on venues in this project
  const venues = await prisma.venue.findMany({
    where: { projectId },
    include: {
      visits: {
        include: {
          ratings: true,
        },
      },
    },
  });

  const gaps: PartnerGap[] = [];

  for (const venue of venues) {
    // Aggregate ratings by user and dimension
    const userRatings: Record<string, number> = {};
    const partnerRatings: Record<string, number> = {};

    for (const visit of venue.visits) {
      for (const rating of visit.ratings) {
        if (rating.userId === userId) {
          userRatings[rating.dimension] = rating.score;
        } else if (rating.userId === partnerId) {
          partnerRatings[rating.dimension] = rating.score;
        }
      }
    }

    // Find dimensions with significant disagreement (>= 2 points diff)
    for (const dim of Object.keys(userRatings)) {
      const u = userRatings[dim];
      const p = partnerRatings[dim];
      if (u !== undefined && p !== undefined && Math.abs(u - p) >= 2) {
        gaps.push({
          venueId: venue.id,
          venueName: venue.name,
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

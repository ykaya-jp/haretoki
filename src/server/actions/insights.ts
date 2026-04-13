"use server";

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
 */
export async function getAIInsights(): Promise<AIInsight[]> {
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

  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

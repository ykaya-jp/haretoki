"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash } from "@/lib/anthropic";
import { DIMENSION_LABELS } from "@/lib/constants";

export async function generateRatingComparison(
  venueId: string
): Promise<{ comment: string; cached: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: { name: true },
  });
  if (!venue) return { comment: "", cached: false };

  // Get all member ratings for this venue
  const members = await prisma.projectMember.findMany({
    where: { projectId, acceptedAt: { not: null } },
    select: { userId: true, user: { select: { name: true } } },
  });

  if (members.length < 2) {
    return { comment: "パートナーが参加すると、二人の評価を比較できます。", cached: false };
  }

  // Get ratings from VenueScore (user_rating source) - these are per-venue, not per-visit
  // Actually, VenueScore doesn't have userId. We need VisitRating which has userId.
  const visitRatings = await prisma.visitRating.findMany({
    where: {
      visit: { venueId },
      userId: { in: members.map(m => m.userId) },
    },
    select: { userId: true, dimension: true, score: true },
  });

  if (visitRatings.length === 0) {
    return { comment: "評価を入力すると、二人の意見を比較できます。", cached: false };
  }

  // Group by user
  const ratingsByUser: Record<string, Record<string, number>> = {};
  for (const r of visitRatings) {
    if (!ratingsByUser[r.userId]) ratingsByUser[r.userId] = {};
    ratingsByUser[r.userId][r.dimension] = Number(r.score);
  }

  const userIds = Object.keys(ratingsByUser);
  if (userIds.length < 2) {
    return { comment: "パートナーの評価が入力されると、比較コメントが表示されます。", cached: false };
  }

  // Check cache
  const inputHash = computeInputHash(
    venueId + JSON.stringify(visitRatings.map(r => `${r.userId}:${r.dimension}:${r.score}`).sort())
  );

  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      type: "rating_comparison",
      inputHash,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (cached) {
    try {
      const parsed = JSON.parse(cached.output);
      return { comment: parsed.comment ?? cached.output, cached: true };
    } catch {
      return { comment: cached.output, cached: true };
    }
  }

  if (!isClaudeAvailable()) {
    // Template fallback
    const [userA, userB] = userIds;
    const ratingsA = ratingsByUser[userA];
    const ratingsB = ratingsByUser[userB];

    const agreements: string[] = [];
    const disagreements: string[] = [];

    for (const dim of Object.keys(ratingsA)) {
      if (ratingsB[dim] !== undefined) {
        const diff = Math.abs(ratingsA[dim] - ratingsB[dim]);
        const label = DIMENSION_LABELS[dim] ?? dim;
        if (diff <= 1) agreements.push(label);
        else disagreements.push(label);
      }
    }

    let comment = "";
    if (agreements.length > 0) comment += `${agreements.join("・")}では意見が一致しています。`;
    if (disagreements.length > 0) comment += `${disagreements.join("・")}で意見が分かれています。話し合ってみてはいかがですか？`;
    if (!comment) comment = "評価データが不足しています。";

    return { comment, cached: false };
  }

  // Claude API
  try {
    const ratingText = userIds.map((uid, idx) => {
      const name = members.find(m => m.userId === uid)?.user.name ?? `パートナー${idx + 1}`;
      const ratings = ratingsByUser[uid];
      return `${name}: ${Object.entries(ratings).map(([dim, score]) => `${DIMENSION_LABELS[dim] ?? dim}=${score}`).join(", ")}`;
    }).join("\n");

    const response = await withRetry(() =>
      askClaude({
        system: `あなたは結婚式場選びのアドバイザーです。二人の式場評価を比較し、温かく建設的なコメントを2-3文で日本語で書いてください。一致点を祝い、違いは話し合いの材料として前向きに伝えてください。JSONではなくプレーンテキストで返してください。`,
        userMessage: `式場「${venue.name}」の二人の評価:\n${ratingText}`,
        maxTokens: 512,
      })
    );

    await prisma.aiAnalysis.create({
      data: {
        projectId,
        venueId,
        type: "rating_comparison",
        inputHash,
        output: JSON.stringify({ comment: response }),
      },
    });

    return { comment: response, cached: false };
  } catch {
    return { comment: "比較コメントをうまく作れませんでした。", cached: false };
  }
}

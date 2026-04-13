"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { DIMENSION_LABELS } from "@/lib/constants";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash } from "@/lib/anthropic";
import { COMPARISON_PROMPT } from "@/lib/prompts/comparison";

interface ComparisonVenue {
  id: string;
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  photoUrls: string[];
  status: string;
  scores: Array<{ dimension: string; score: number; source: string }>;
  latestEstimate: { total: number; predictedFinal: number | null } | null;
  totalScore: number;
  topStrengths: string[];
}

interface ComparisonInsight {
  text: string;
  recommendations: string[];
}

interface ComparisonData {
  venues: ComparisonVenue[];
  insight: ComparisonInsight;
}

export async function getComparisonData(venueIds: string[]): Promise<ComparisonData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (venueIds.length < 2 || venueIds.length > 3) {
    throw new Error("比較は2-3件の式場を選択してください");
  }

  const [venues, project] = await Promise.all([
    prisma.venue.findMany({
      where: { id: { in: venueIds }, projectId },
      include: {
        scores: { where: { source: "user_rating" } },
        estimates: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
  ]);

  const comparisonVenues: ComparisonVenue[] = venues.map((venue) => {
    const scores = venue.scores.map((s) => ({
      dimension: s.dimension,
      score: Number(s.score),
      source: s.source,
    }));

    const avgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;
    const totalScore = Math.round(avgScore * 20); // 0-100 scale

    const topStrengths = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => DIMENSION_LABELS[s.dimension] ?? s.dimension);

    const latestEstimate = venue.estimates[0]
      ? { total: venue.estimates[0].total, predictedFinal: venue.estimates[0].predictedFinal }
      : null;

    return {
      id: venue.id,
      name: venue.name,
      location: venue.location,
      accessInfo: venue.accessInfo,
      capacityMin: venue.capacityMin,
      capacityMax: venue.capacityMax,
      ceremonyStyles: venue.ceremonyStyles,
      photoUrls: venue.photoUrls,
      status: venue.status,
      scores,
      latestEstimate,
      totalScore,
      topStrengths,
    };
  });

  const insight = await generateInsight(comparisonVenues, projectId, project?.conditions);

  return { venues: comparisonVenues, insight };
}

async function generateInsight(
  venues: ComparisonVenue[],
  projectId: string,
  conditions: unknown,
): Promise<ComparisonInsight> {
  if (!isClaudeAvailable() || venues.length < 2) {
    return generateTemplateInsight(venues);
  }

  try {
    const inputHash = computeInputHash(venues.map((v) => v.id).sort().join(","));

    // Check cache (24h TTL)
    const cached = await prisma.aiAnalysis.findFirst({
      where: {
        type: "comparison",
        inputHash,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (cached) {
      const parsed = JSON.parse(cached.output);
      return {
        text: parsed.summary ?? "",
        recommendations: parsed.recommendations ?? [],
      };
    }

    // Build venue descriptions
    const venueDescriptions = venues
      .map(
        (v) => `
【${v.name}】
- エリア: ${v.location ?? "不明"}
- 収容: ${v.capacityMin ?? "?"}〜${v.capacityMax ?? "?"}名
- スタイル: ${v.ceremonyStyles.join(", ") || "不明"}
- 見積もり: ${v.latestEstimate ? `¥${Math.round(v.latestEstimate.total / 10000)}万円` : "未入力"}
- スコア: ${v.scores.map((s) => `${s.dimension}=${s.score}`).join(", ") || "未評価"}
- 総合: ${v.totalScore}点`,
      )
      .join("\n");

    const conditionsDesc = conditions
      ? `\nカップルの希望: ${JSON.stringify(conditions)}`
      : "";

    const response = await withRetry(() =>
      askClaude({
        system: COMPARISON_PROMPT.system,
        userMessage: COMPARISON_PROMPT.buildUserMessage(venueDescriptions, conditionsDesc),
      }),
    );

    const result = JSON.parse(response);

    // Cache
    await prisma.aiAnalysis.create({
      data: {
        projectId,
        type: "comparison",
        inputHash,
        output: response,
      },
    });

    return {
      text: result.summary ?? "",
      recommendations: result.recommendations ?? [],
    };
  } catch {
    return generateTemplateInsight(venues);
  }
}

function generateTemplateInsight(venues: ComparisonVenue[]): ComparisonInsight {
  if (venues.length < 2) {
    return { text: "", recommendations: [] };
  }

  const [a, b] = venues;
  const parts: string[] = [];
  const recommendations: string[] = [];

  if (a.totalScore > b.totalScore) {
    parts.push(`${a.name}は総合スコアで${a.totalScore}点と、${b.name}(${b.totalScore}点)を上回っています。`);
  } else if (b.totalScore > a.totalScore) {
    parts.push(`${b.name}は総合スコアで${b.totalScore}点と、${a.name}(${a.totalScore}点)を上回っています。`);
  } else {
    parts.push(`両式場の総合スコアは${a.totalScore}点で同等です。`);
  }

  if (a.topStrengths.length > 0) {
    parts.push(`${a.name}の強みは${a.topStrengths.join("・")}です。`);
  }
  if (b.topStrengths.length > 0) {
    parts.push(`${b.name}の強みは${b.topStrengths.join("・")}です。`);
  }

  if (a.latestEstimate && b.latestEstimate) {
    const diff = Math.abs(a.latestEstimate.total - b.latestEstimate.total);
    if (diff > 500000) {
      const cheaper = a.latestEstimate.total < b.latestEstimate.total ? a : b;
      recommendations.push(`費用面では${cheaper.name}が${Math.round(diff / 10000)}万円ほどお手頃です。`);
    }
  }

  if (!a.latestEstimate || !b.latestEstimate) {
    recommendations.push("見積もりを入力すると、費用面の比較もできます。");
  }

  return {
    text: parts.join(" "),
    recommendations,
  };
}

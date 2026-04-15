"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { DIMENSION_LABELS } from "@/lib/constants";
import {
  isClaudeAvailable,
  askClaude,
  withRetry,
  computeInputHash,
} from "@/lib/anthropic";
import { MATRIX_INSIGHT_PROMPT, type MatrixInsightInput } from "@/lib/prompts/matrix-insight";
import { getMatrixData } from "@/server/actions/matrix";

export interface MatrixInsight {
  summary: string;
  nextActions: string[];
  /** true when rendered from the template fallback (Claude unavailable or failed). */
  fallback: boolean;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Natural-language "ひとこと分析" for the decision matrix.
 * Result is cached in AiAnalysis (type=comparison) keyed by input hash.
 * Falls back to a deterministic template when Claude is unavailable.
 */
export async function getMatrixInsight(): Promise<MatrixInsight | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const matrix = await getMatrixData();
  if (matrix.venues.length < 2) {
    return null; // nothing meaningful to say with <2 candidates
  }

  // Build winners map keyed by name (prompt consumes names, not ids)
  const winnerNameByKey: Record<string, string> = {};
  for (const [key, venueId] of Object.entries(matrix.winners)) {
    const v = matrix.venues.find((x) => x.id === venueId);
    if (v) winnerNameByKey[key] = v.name;
  }

  // Pull project conditions so the AI can tailor advice
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { conditions: true },
  });

  const input: MatrixInsightInput = {
    venues: matrix.venues.map((v) => ({
      name: v.name,
      totalScore: v.totalScore,
      dimensions: v.scoresByDimension,
      estimateTotal: v.latestEstimateTotal ?? v.costMax ?? v.costMin,
    })),
    dimensionLabels: DIMENSION_LABELS,
    winners: winnerNameByKey,
    conditions: (project?.conditions as Record<string, unknown> | null) ?? null,
  };

  if (!isClaudeAvailable()) {
    return templateInsight(input);
  }

  // Hash covers all inputs that would change the output
  const inputHash = computeInputHash(
    JSON.stringify({
      venues: input.venues,
      winners: input.winners,
      conditions: input.conditions,
    }),
  );

  // Check 24h cache
  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      projectId,
      type: "comparison",
      inputHash,
      createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (cached) {
    try {
      const parsed = JSON.parse(cached.output) as {
        summary?: string;
        nextActions?: unknown;
      };
      if (
        typeof parsed.summary === "string" &&
        Array.isArray(parsed.nextActions)
      ) {
        return {
          summary: parsed.summary,
          nextActions: parsed.nextActions.filter(
            (a): a is string => typeof a === "string",
          ),
          fallback: false,
        };
      }
    } catch {
      // fall through to regenerate
    }
  }

  try {
    const raw = await withRetry(() =>
      askClaude({
        system: MATRIX_INSIGHT_PROMPT.system,
        userMessage: MATRIX_INSIGHT_PROMPT.buildUserMessage(input),
        maxTokens: MATRIX_INSIGHT_PROMPT.maxTokens,
      }),
    );

    // Claude occasionally wraps JSON in ```json blocks — strip them.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      summary?: string;
      nextActions?: unknown;
    };

    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.nextActions)
    ) {
      return templateInsight(input);
    }

    const nextActions = parsed.nextActions
      .filter((a): a is string => typeof a === "string")
      .slice(0, 2);

    // Persist to cache
    await prisma.aiAnalysis
      .create({
        data: {
          projectId,
          type: "comparison",
          inputHash,
          output: JSON.stringify({ summary: parsed.summary, nextActions }),
        },
      })
      .catch(() => {
        // cache write failure is non-fatal
      });

    return { summary: parsed.summary, nextActions, fallback: false };
  } catch {
    return templateInsight(input);
  }
}

function templateInsight(input: MatrixInsightInput): MatrixInsight {
  const scored = input.venues.filter((v) => v.totalScore !== null);
  const bits: string[] = [];
  const nextActions: string[] = [];

  if (scored.length >= 2) {
    const sorted = [...scored].sort(
      (a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0),
    );
    const diff = (sorted[0].totalScore ?? 0) - (sorted[sorted.length - 1].totalScore ?? 0);
    if (diff < 0.3) {
      bits.push(
        `${sorted.length} 件のスコアはほぼ互角です。決め手を 1 つ仮置きすると差が見えてきます。`,
      );
    } else {
      bits.push(
        `総合では ${sorted[0].name} が頭ひとつ抜け、${sorted[sorted.length - 1].name} との差は ${diff.toFixed(1)} ポイントです。`,
      );
    }
  } else {
    bits.push("候補を評価すると、比較のヒントが増えます。");
  }

  const costs = input.venues
    .map((v) => ({ name: v.name, total: v.estimateTotal }))
    .filter((x): x is { name: string; total: number } => x.total !== null);
  if (costs.length >= 2) {
    const sorted = [...costs].sort((a, b) => a.total - b.total);
    const diff = sorted[sorted.length - 1].total - sorted[0].total;
    if (diff >= 500_000) {
      bits.push(
        `費用差は約 ${Math.round(diff / 10_000)} 万円（${sorted[0].name} が最安）。`,
      );
      nextActions.push(
        `費用差 ${Math.round(diff / 10_000)} 万円の内訳を見積もり比較で確認してみる`,
      );
    }
  } else if (costs.length < input.venues.length) {
    nextActions.push("見積もりを入力すると、費用面の判断材料が増えます");
  }

  if (nextActions.length === 0) {
    nextActions.push("外せない観点を 1 つだけ仮置きして、もう一度並べ替えてみる");
  }

  return { summary: bits.join(" "), nextActions, fallback: true };
}

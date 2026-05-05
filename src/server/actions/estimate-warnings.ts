"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireVenueAccess } from "@/server/auth";
import { isClaudeAvailable } from "@/lib/claude";
import { cachedAskClaude } from "@/lib/ai-cache";
import { parseConditions } from "@/lib/schemas";
import {
  ESTIMATE_WARNINGS_SYSTEM,
  buildEstimateWarningsUserMessage,
  type EstimateWarningItem,
} from "@/lib/prompts/estimate-warnings";

/**
 * Bump when the estimate-warnings prompt or output schema changes so
 * cached entries don't outlive the prompt revision they were generated
 * under. AiCache TTL is 30d (src/lib/ai-cache.ts:19), so without a
 * version tag a prompt change would silently serve stale wording for
 * up to a month post-deploy.
 */
const ESTIMATE_WARNINGS_PROMPT_VERSION = 1;

const SEVERITY = ["info", "warn", "alert"] as const;

const warningSchema = z.object({
  severity: z.enum(SEVERITY),
  title: z.string().min(1).max(60),
  message: z.string().min(1).max(280),
  relatedItem: z.string().max(120).optional(),
});

const responseSchema = z.object({
  warnings: z.array(warningSchema).max(8),
});

export type EstimateWarning = z.infer<typeof warningSchema>;

export interface EstimateWarningsResult {
  warnings: EstimateWarning[];
  /** True if the response came from AiCache (no fresh Claude round-trip). */
  cached: boolean;
}

function stripCodeFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

const EMPTY: EstimateWarningsResult = { warnings: [], cached: false };

/**
 * AI 警告生成。venue の最新 Estimate + budget 上限 + venue location を
 * Haiku に渡して severity 付き警告 (3-5 件) を生成する。
 *
 * Degrade ladder (どれもユーザーには空配列として届く):
 *   1. Claude 未設定 → empty (no Claude call)
 *   2. estimate / items 0 件 → empty (nothing to review)
 *   3. cachedAskClaude が null (timeout / 5xx) → empty
 *   4. JSON parse 失敗 / zod 弾き → empty
 *
 * 失敗時は throw せず空配列で返す。caller (estimate-xray) は AI セクションを
 * 描画しないだけで済む。
 */
export async function generateEstimateWarnings(
  venueId: string,
): Promise<EstimateWarningsResult> {
  const user = await requireUser();
  const { projectId } = await requireVenueAccess(user.id, venueId);

  if (!isClaudeAvailable()) return EMPTY;

  // Latest estimate + items + venue location + project budget — single
  // round-trip via parallel queries since none depends on the others.
  const [estimate, venue, project] = await Promise.all([
    prisma.estimate.findFirst({
      where: { venueId },
      orderBy: { version: "desc" },
      select: {
        total: true,
        items: {
          select: {
            category: true,
            itemName: true,
            amount: true,
            tier: true,
          },
        },
      },
    }),
    prisma.venue.findUnique({
      where: { id: venueId },
      select: { location: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
  ]);

  if (!estimate || estimate.items.length === 0) return EMPTY;

  const conditions = parseConditions(project?.conditions);
  const budgetMax = conditions?.budget?.max ?? null;

  const items: EstimateWarningItem[] = estimate.items.map((item) => ({
    category: item.category,
    itemName: item.itemName,
    amount: item.amount,
    tier: item.tier,
  }));

  const userMessage = buildEstimateWarningsUserMessage({
    items,
    totalEstimate: estimate.total,
    budgetMax,
    venueLocation: venue?.location ?? null,
  });

  // cachedAskClaude folds {system, userMessage, model, promptVersion,
  // maxTokens} into the cache key — so a different item set / budget /
  // location automatically misses cache without us hashing by hand.
  const raw = await cachedAskClaude({
    system: ESTIMATE_WARNINGS_SYSTEM,
    userMessage,
    promptVersion: ESTIMATE_WARNINGS_PROMPT_VERSION,
    maxTokens: 800,
  });
  if (!raw) return EMPTY;

  try {
    const json = JSON.parse(stripCodeFences(raw));
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) return EMPTY;
    return {
      warnings: parsed.data.warnings.slice(0, 5),
      // cachedAskClaude doesn't expose hit/miss — set to false here and
      // let the UI decide whether to show a "AI生成" badge later. Today
      // it's only consumed as `result.warnings.length > 0` so the field
      // is informational.
      cached: false,
    };
  } catch {
    return EMPTY;
  }
}

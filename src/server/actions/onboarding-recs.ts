"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, withRetry, computeInputHash } from "@/lib/anthropic";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";
import { MODEL } from "@/lib/models";

type VenueRow = {
  id: string;
  name: string;
  location: string | null;
  ceremonyStyles: string[];
  costMin: number | null;
  costMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  photoUrls: string[];
};

export interface DbVenueRecommendation {
  venueId: string;
  name: string;
  location: string | null;
  photoUrl: string | null;
  reason: string;
}

export interface RecommendVenuesResult {
  summary: string;
  recommendations: DbVenueRecommendation[];
}

/** Recommend top-3 venues from the project's existing DB venues using Claude. */
export async function recommendVenuesFromConditions(): Promise<RecommendVenuesResult | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) return null;

  const [project, venues] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    prisma.venue.findMany({
      where: { projectId },
      take: 50,
      select: {
        id: true,
        name: true,
        location: true,
        ceremonyStyles: true,
        costMin: true,
        costMax: true,
        capacityMin: true,
        capacityMax: true,
        photoUrls: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const conditions = (project?.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  // No conditions set — nothing meaningful to recommend against
  const hasConditions =
    (conditions.style?.length ?? 0) > 0 ||
    (conditions.area?.length ?? 0) > 0 ||
    typeof conditions.guestCount === "number" ||
    !!conditions.budget;
  if (!hasConditions) return null;

  // No venues in DB — nothing to recommend from
  if (venues.length === 0) return null;

  const conditionsSummary = [
    conditions.style?.length ? `スタイル: ${conditions.style.join("、")}` : null,
    conditions.area?.length ? `エリア: ${conditions.area.join("、")}` : null,
    conditions.guestCount ? `ゲスト人数: ${conditions.guestCount}名` : null,
    conditions.budget
      ? `予算: ${Math.round(conditions.budget.min / 10000)}〜${Math.round(conditions.budget.max / 10000)}万円`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const venueList = (venues as VenueRow[])
    .map((v) => {
      const cost =
        v.costMin !== null && v.costMax !== null
          ? `${Math.round(v.costMin / 10000)}〜${Math.round(v.costMax / 10000)}万円`
          : "不明";
      const capacity =
        v.capacityMin !== null && v.capacityMax !== null
          ? `${v.capacityMin}〜${v.capacityMax}名`
          : "不明";
      return `ID: ${v.id} | 名前: ${v.name} | 場所: ${v.location ?? "不明"} | スタイル: ${v.ceremonyStyles.join("、") || "不明"} | 費用: ${cost} | 収容: ${capacity}`;
    })
    .join("\n");

  const systemPrompt =
    "結婚式場選びを応援するコンシェルジュです。カップルの条件と候補リストから、最も相性が良さそうな3件を選び、各式場について60〜100字の日本語理由文をつけてください。" +
    "返答は必ずJSON形式で: {\"summary\": \"...\", \"recommendations\": [{\"venueId\": \"...\", \"reason\": \"...\"}]}";

  const userMessage =
    `【カップルの条件】\n${conditionsSummary}\n\n` +
    `【候補式場リスト】\n${venueList}\n\n` +
    "上記リストの中から最大3件を選び、JSON形式で返してください。summaryは60〜100字でふたりへのメッセージを書いてください。";

  const recCacheHash = computeInputHash(
    JSON.stringify({ system: systemPrompt, user: userMessage, model: MODEL.HAIKU }),
  );

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timed out")), 20_000),
    );

    const cachedRec = await getCachedResponse(recCacheHash);
    let response: string;
    if (cachedRec) {
      response = cachedRec;
    } else {
      try {
        response = await Promise.race([
          withRetry(() =>
            askClaude({
              system: systemPrompt,
              userMessage,
              model: MODEL.HAIKU,
              maxTokens: 1024,
            }),
          ),
          timeoutPromise,
        ]);
      } catch (err) {
        console.error("[recommendVenuesFromConditions] Claude error:", err instanceof Error ? err.message : err);
        return null;
      }
      await setCachedResponse(recCacheHash, response, MODEL.HAIKU);
    }

    // Strip markdown code fences
    const cleaned = response
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    let parsed: { summary?: string; recommendations?: Array<{ venueId: string; reason: string }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[recommendVenuesFromConditions] Failed to parse JSON response");
      return null;
    }

    if (!Array.isArray(parsed.recommendations)) return null;

    // Build venue lookup map
    const venueMap = new Map((venues as VenueRow[]).map((v) => [v.id, v]));

    const recommendations: DbVenueRecommendation[] = parsed.recommendations
      .slice(0, 3)
      .filter((r) => r.venueId && venueMap.has(r.venueId))
      .map((r) => {
        const v = venueMap.get(r.venueId)!;
        return {
          venueId: v.id,
          name: v.name,
          location: v.location,
          photoUrl: v.photoUrls[0] ?? null,
          reason: r.reason ?? "",
        };
      });

    return {
      summary: parsed.summary ?? "ふたりの条件に合いそうな式場を選びました。",
      recommendations,
    };
  } catch (err) {
    console.error("[recommendVenuesFromConditions] Unexpected error:", err);
    return null;
  }
}

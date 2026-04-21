"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { askClaude, withRetry, isClaudeAvailable, sanitizeForPrompt, computeInputHash } from "@/lib/anthropic";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";

export interface AIChecklistItem {
  item: string;
  reason: string;
}

/** Strip JSON fence and extract the object. Same pattern as reviews.ts. */
function stripJsonResponse(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return raw.trim();
}

/** Generate 5 venue-specific checklist items via Claude. Non-blocking on failure. */
export async function generateAIChecklistForVenue(
  venueId: string,
): Promise<{ items: AIChecklistItem[] } | { error: string }> {
  if (!isClaudeAvailable()) {
    return { error: "AI機能は現在利用できません" };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId },
    select: {
      name: true,
      ceremonyStyles: true,
      costMin: true,
      costMax: true,
      capacityMin: true,
      capacityMax: true,
      hasShuttle: true,
      hasParking: true,
      hasAccommodation: true,
      operatingHours: true,
      cuisineTypes: true,
      reviewClusters: true,
    },
  });

  if (!venue) {
    return { error: "式場が見つかりません" };
  }

  // Build structured venue info for the prompt
  const reviewClusters = venue.reviewClusters as {
    positive?: { theme: string; summary: string }[];
    negative?: { theme: string; summary: string }[];
  } | null;

  const venueInfo = [
    `式場名: ${sanitizeForPrompt(venue.name)}`,
    venue.ceremonyStyles.length > 0
      ? `挙式スタイル: ${venue.ceremonyStyles.join("、")}`
      : null,
    venue.costMin != null || venue.costMax != null
      ? `費用目安: ${venue.costMin != null ? `${(venue.costMin / 10000).toFixed(0)}万円` : "不明"}〜${venue.costMax != null ? `${(venue.costMax / 10000).toFixed(0)}万円` : "不明"}`
      : null,
    venue.capacityMin != null || venue.capacityMax != null
      ? `収容人数: ${venue.capacityMin ?? "?"}〜${venue.capacityMax ?? "?"}名`
      : null,
    venue.hasShuttle != null
      ? `送迎バス: ${venue.hasShuttle ? "あり" : "なし"}`
      : null,
    venue.hasParking != null
      ? `駐車場: ${venue.hasParking ? "あり" : "なし"}`
      : null,
    venue.hasAccommodation != null
      ? `宿泊施設: ${venue.hasAccommodation ? "あり" : "なし"}`
      : null,
    venue.operatingHours
      ? `営業時間: ${sanitizeForPrompt(venue.operatingHours)}`
      : null,
    venue.cuisineTypes.length > 0
      ? `料理ジャンル: ${venue.cuisineTypes.join("、")}`
      : null,
    reviewClusters?.positive && reviewClusters.positive.length > 0
      ? `口コミ好評点: ${reviewClusters.positive.map((c) => `${c.theme}（${sanitizeForPrompt(c.summary, 60)}）`).join(" / ")}`
      : null,
    reviewClusters?.negative && reviewClusters.negative.length > 0
      ? `口コミ懸念点: ${reviewClusters.negative.map((c) => `${c.theme}（${sanitizeForPrompt(c.summary, 60)}）`).join(" / ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "結婚式場の見学で何を確認すべきか、プロのウェディングプランナー視点で助言する。" +
    "次の venue 情報から、見学当日にその式場特有に確認すべきポイントを 5 項目生成してください。" +
    "一般的なチェックではなく、その venue 独自の疑問・リスク・魅力検証項目を。" +
    "日本語、各項目は 20-40 字の質問形、reason は 40-80 字でなぜそれを確認すべきかを書く。" +
    'JSON形式のみで返答: {"items": [{"item": "...", "reason": "..."}]}';

  const checklistCacheHash = computeInputHash(
    JSON.stringify({ system, user: venueInfo, model: "claude-haiku-4-5-20251001" }),
  );

  try {
    const cached = await getCachedResponse(checklistCacheHash);
    const raw = cached ?? await withRetry(() =>
      askClaude({
        system,
        userMessage: venueInfo,
        model: "claude-haiku-4-5-20251001",
        maxTokens: 1024,
      }),
    );
    if (!cached) {
      await setCachedResponse(checklistCacheHash, raw, "claude-haiku-4-5-20251001");
    }

    const parsed = JSON.parse(stripJsonResponse(raw)) as {
      items: AIChecklistItem[];
    };

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return { error: "AIからの応答を解析できませんでした" };
    }

    // Validate each item has required fields
    const items = parsed.items
      .filter(
        (i) =>
          typeof i.item === "string" &&
          i.item.length > 0 &&
          typeof i.reason === "string" &&
          i.reason.length > 0,
      )
      .slice(0, 5);

    if (items.length === 0) {
      return { error: "AIからの応答を解析できませんでした" };
    }

    return { items };
  } catch (err) {
    console.error("[generateAIChecklistForVenue] error:", err);
    return { error: "AI提案の生成中にエラーが発生しました" };
  }
}

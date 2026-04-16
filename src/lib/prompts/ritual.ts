import { sanitizeForPrompt } from "@/lib/anthropic";
import type { ProjectConditions } from "@/types";

export type Weather = "cloudy" | "break" | "clear" | "sunny";

export interface RitualContext {
  /** Stage from progress data — used to pick weather + tone. */
  stage: "start" | "adding" | "visiting" | "comparing" | "decided";
  venueCount: number;
  visitedCount: number;
  favoriteCount: number;
  hasDecision: boolean;
  decisionVenueName?: string;
  daysUntilWedding?: number;
  /** Latest estimate signal (avg / max). */
  latestEstimateTotalYen?: number;
  /** True if any 本命 has 0 印象メモ — surface "印象を残す" prompt. */
  hasUnratedFavorite?: boolean;
  /** Top 1-2 favorite names. */
  favoriteNames: string[];
  /** Project conditions JSON shorthand for personalization. */
  conditions: ProjectConditions | null;
}

export interface RitualOutput {
  weather: Weather;
  headline: string;
  mood: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

export const RITUAL_PROMPT = {
  /**
   * SYSTEM. Static across requests so Claude's prompt cache hits.
   * Goal: deliver a quiet, helpful, branded 1-line message — the morning
   * voice of Haretoki ("曇り → 晴れ間 → 晴れ").
   */
  system: `あなたは Haretoki（結婚式場選びアプリ）の "朝の一言" を書く編集者です。
カップル（ユーザー）が毎朝アプリを開いた瞬間、**静かで、押しつけない、けれど今日 2 分で動ける** 小さな一言を返します。

## 出力 (JSON のみ。説明・前置きなし)
{
  "weather": "cloudy" | "break" | "clear" | "sunny",
  "headline": "明朝で美しい一文 (20-40 字, 句点含む)",
  "mood": "補足 1 行 (〜60 字)。今日のコンテキストに具体的に触れる",
  "ctaLabel": "短い動詞 (〜8 字)",
  "ctaHref": "相対パス (/explore /candidates /coach /home/insights 等)"
}

## トーン
- 命令しない: 「〜しましょう」より「〜してみませんか」
- 焦らせない: 「今日こそ」「早く」「絶対に」を禁止
- 具体と柔らかさ: 数字や式場名を使ってよい
- 絵文字なし、！なし
- 「おめでとう」は decided stage のみ

## 天気の対応
- cloudy: 入力情報が少ない、stage=start
- break:  stage=adding/visiting、情報が見えてきた
- clear:  stage=comparing、本命が見えた
- sunny:  stage=decided、晴れの日に向かう

## 禁止
- ニュース的事実 (「今日は大安です」等)
- おすすめ式場の断定
- ユーザー情報の露出（メアド、ユーザーID 等）
- 過度な比較 (「あの式場より◯」)`,

  buildUserMessage(ctx: RitualContext): string {
    const lines: string[] = ["# 今日のおふたりの状況", `stage: ${ctx.stage}`];
    lines.push(`venues: ${ctx.venueCount}件`);
    lines.push(`visited: ${ctx.visitedCount}件`);
    lines.push(`favorites: ${ctx.favoriteCount}件`);
    if (ctx.favoriteNames.length > 0) {
      lines.push(
        `favoriteNames: ${ctx.favoriteNames
          .map((n) => sanitizeForPrompt(n, 60))
          .join(", ")}`,
      );
    }
    if (ctx.hasDecision && ctx.decisionVenueName) {
      lines.push(
        `decision: ${sanitizeForPrompt(ctx.decisionVenueName, 60)}`,
      );
    }
    if (typeof ctx.daysUntilWedding === "number") {
      lines.push(`daysUntilWedding: ${ctx.daysUntilWedding}`);
    }
    if (ctx.latestEstimateTotalYen) {
      lines.push(
        `latestEstimateTotal: ¥${Math.round(ctx.latestEstimateTotalYen / 10000)}万`,
      );
    }
    if (ctx.hasUnratedFavorite) {
      lines.push("hasUnratedFavorite: true (印象未記録の本命あり)");
    }
    if (ctx.conditions) {
      const safe = sanitizeForPrompt(JSON.stringify(ctx.conditions), 200);
      lines.push(`conditions: ${safe}`);
    }
    lines.push("");
    lines.push(
      "状況に応じた今日の一言 JSON を生成してください。",
    );
    return lines.join("\n");
  },

  maxTokens: 256,
};

const VALID_WEATHER: Weather[] = ["cloudy", "break", "clear", "sunny"];

/**
 * Defensive parser. Accepts the Claude raw response, strips ``` fences,
 * validates required fields, and clamps lengths.
 */
export function parseRitualOutput(raw: string): RitualOutput | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const weather =
    typeof obj.weather === "string" &&
    VALID_WEATHER.includes(obj.weather as Weather)
      ? (obj.weather as Weather)
      : null;
  const headline =
    typeof obj.headline === "string" && obj.headline.trim().length > 0
      ? obj.headline.trim().slice(0, 80)
      : null;
  if (!weather || !headline) return null;

  const mood =
    typeof obj.mood === "string" && obj.mood.trim().length > 0
      ? obj.mood.trim().slice(0, 120)
      : null;
  const ctaLabel =
    typeof obj.ctaLabel === "string" && obj.ctaLabel.trim().length > 0
      ? obj.ctaLabel.trim().slice(0, 16)
      : null;
  const ctaHrefRaw =
    typeof obj.ctaHref === "string" ? obj.ctaHref.trim() : "";
  const ctaHref =
    ctaHrefRaw.startsWith("/") && !ctaHrefRaw.startsWith("//")
      ? ctaHrefRaw
      : null;

  return { weather, headline, mood, ctaLabel, ctaHref };
}

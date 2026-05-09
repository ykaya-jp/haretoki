import { sanitizeForPrompt } from "@/lib/anthropic";
import type { ProjectConditions } from "@/types";

export interface FitReasonVenueSummary {
  name: string;
  location: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  features?: string[] | null;
  accessInfo: string | null;
}

export const FIT_REASON_PROMPT = {
  system: `あなたは Haretoki (結婚式場選びツール) の編集者です。
式場 1 件とカップルの希望条件を受け取り、30〜50 字の
**中立で温かい** 一言を返します。

## 出力
そのままテキスト 1 行のみ。JSON や説明は不要。
例: "天井 12m と緑の中庭 — ふたりの「光と緑」に合います"

## ルール
- 30〜50 字、句点は不要
- 式場の特徴 1 つ + 条件との合致を「— ふたりの◯◯に合います」で締める
- **必ず features / location / capacity / ceremonyStyles のいずれかから具体的な要素を 1 つ拾って使う** (vibeTag 名・料理長名・総額目安・客席数・特定の挙式スタイル等)
- 数字や固有名詞を使える場合は使う
- features が空の場合のみ、location や ceremonyStyles を象徴的に述べる

## 禁止 (= 文言そのものを使わない)
- 「最高」「絶対」「間違いない」等の誇張
- 「おすすめ」「ここにしましょう」等の推薦表現
- 絵文字・感嘆符
- 複数文（句点 2 つ以上）
- **「バランスのいい式場」「総合的に良い」「使い勝手が良い」等の generic な総評**: features を 1 つも引用せず汎用語で済ます書き方は不可。venue の固有要素が必ず文中に出てくること。`,

  buildUserMessage(venue: FitReasonVenueSummary, conditions: ProjectConditions | null): string {
    const feat = [
      venue.location ? `location: ${sanitizeForPrompt(venue.location, 60)}` : null,
      venue.accessInfo ? `access: ${sanitizeForPrompt(venue.accessInfo, 100)}` : null,
      venue.capacityMin || venue.capacityMax
        ? `capacity: ${venue.capacityMin ?? "?"}-${venue.capacityMax ?? "?"}名`
        : null,
      venue.ceremonyStyles.length > 0
        ? `styles: ${venue.ceremonyStyles.map((s) => sanitizeForPrompt(s, 30)).join(", ")}`
        : null,
      venue.features && venue.features.length > 0
        ? `features: ${venue.features.map((f) => sanitizeForPrompt(f, 40)).join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return `venue: ${sanitizeForPrompt(venue.name, 80)}
${feat}

conditions: ${conditions ? sanitizeForPrompt(JSON.stringify(conditions), 400) : "(未設定)"}

この式場の一言を作ってください。`;
  },

  maxTokens: 80,
};

export function cleanOneLineFit(raw: string): string {
  const cleaned = raw
    .replace(/^```.*?$\s*/gim, "")
    .replace(/\s*```\s*$/, "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)[0] ?? "";
  // Strip surrounding quotes Claude sometimes adds
  return cleaned.replace(/^["「『]|["」』]$/g, "").trim().slice(0, 80);
}

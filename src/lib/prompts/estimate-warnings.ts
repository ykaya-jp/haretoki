/**
 * Estimate Warnings prompt — AI が見積もりをレビューして 3-5 件の警告を返す。
 *
 * 既存の `EstimateXRay` 統計 (upgradeProbability) は「項目ごとの確率」しか
 * 出せず、「全体の予算オーバー」「他の式場で頻発する記載漏れ」等の
 * パーソナライズ警告は届かなかった。本 prompt は items + budgetMax + venue
 * 文脈を Haiku に渡し、severity 付きの警告配列を JSON で返させる。
 *
 * 仕様: docs/ai/prompts/estimate-warnings.system.md
 * Caller: src/server/actions/estimate-warnings.ts
 */

export interface EstimateWarningItem {
  category: string;
  itemName: string;
  amount: number;
  tier: string;
}

export interface EstimateWarningsInput {
  items: EstimateWarningItem[];
  totalEstimate: number;
  budgetMax: number | null;
  venueLocation: string | null;
}

export const ESTIMATE_WARNINGS_SYSTEM = `あなたは結婚式場の見積もりレビュー専門家です。
カップルが受け取った初期見積もりを読み、以下を判定して警告を返してください。

判定観点:
1. 記載漏れ: 当日追加で発生しやすい項目 (持ち込み料、音響オプション、スピーチ録音、控室延長、ペーパーアイテム等)
2. 上がりやすい項目: 最低ランク (tier=minimum) で記載され、実例で大きく上振れしやすいもの
3. 予算オーバー: 予算上限 (budgetMax) を 10% 以上超過している場合

severity の使い分け:
- "alert": 予算 25%超過 / 当日 +30万円以上の上振れ事例 / 記載漏れの定番
- "warn": 予算 10-25%超過 / 上振れ +10-30万円
- "info": 検討余地ありの周辺項目

出力ルール:
- 必ず JSON のみで回答。説明・前置き・コードブロック禁止
- 形式: {"warnings":[{"severity":"alert","title":"...","message":"...","relatedItem":"..."}]}
- title は 1 行 30 字以下
- message は 2-3 行 (改行 \\n 区切り、合計 120 字以下)
- relatedItem は items の itemName と一致する場合のみ含める (任意)
- 警告 3-5 件。気になる点が少ないなら 0 件 (空配列) でも可
- 数字を入れて具体的に書く (「+30万円」「予算の 125%」等)。曖昧な「高くなりがち」「注意が必要」は禁止

few-shot 例:
- 「ドレス持ち込み料が記載なし → 当日 +30〜50 万円の事例多数」
- 「音響オプションが基本のみ → 写真・動画と合わせて当日 +40 万円事例」
- 「予算上限を 25% 超過 → 優先度の高い 3 項目を見直し推奨」`;

export function buildEstimateWarningsUserMessage(
  input: EstimateWarningsInput,
): string {
  const lines: string[] = [];
  lines.push(`総見積もり額: ¥${input.totalEstimate.toLocaleString()}`);
  if (input.budgetMax != null) {
    const pct = Math.round((input.totalEstimate / input.budgetMax) * 100);
    lines.push(
      `予算上限: ¥${input.budgetMax.toLocaleString()} (現状 ${pct}%)`,
    );
  } else {
    lines.push("予算上限: 未設定");
  }
  if (input.venueLocation) lines.push(`式場エリア: ${input.venueLocation}`);
  lines.push("");
  lines.push("見積もり項目:");
  for (const item of input.items) {
    lines.push(
      `- [${item.category}] ${item.itemName}: ¥${item.amount.toLocaleString()} (tier=${item.tier})`,
    );
  }
  lines.push("");
  lines.push(
    "上記をレビューし、記載漏れ / 上がりやすい項目 / 予算超過の観点で 3-5 件の警告を JSON で返してください。",
  );
  return lines.join("\n");
}

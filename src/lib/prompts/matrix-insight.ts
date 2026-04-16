import { sanitizeForPrompt } from "@/lib/anthropic";
import type { ProjectConditions } from "@/types";

interface MatrixInsightInput {
  venues: Array<{
    name: string;
    totalScore: number | null;
    dimensions: Record<string, number | null>;
    estimateTotal: number | null;
  }>;
  dimensionLabels: Record<string, string>;
  winners: Record<string, string>; // dim or "total" or "cost_value" → venueName
  conditions: ProjectConditions | null;
}

function renderMatrixForPrompt(input: MatrixInsightInput): string {
  const lines: string[] = [];

  lines.push("## 候補式場");
  for (const v of input.venues) {
    const name = sanitizeForPrompt(v.name, 60);
    const dims = Object.entries(v.dimensions)
      .map(([k, s]) => {
        const label = input.dimensionLabels[k] ?? k;
        return s === null ? `${label}=未評価` : `${label}=${s.toFixed(1)}`;
      })
      .join(", ");
    const cost =
      v.estimateTotal !== null
        ? `¥${Math.round(v.estimateTotal / 10000)}万円`
        : "見積もり未入力";
    const total = v.totalScore === null ? "未評価" : v.totalScore.toFixed(1);
    lines.push(`- ${name}: 総合=${total}, ${dims}, 費用=${cost}`);
  }

  lines.push("");
  lines.push("## 各観点の 1 位");
  for (const [key, venueName] of Object.entries(input.winners)) {
    if (key === "total" || key === "cost_value") continue;
    const label = input.dimensionLabels[key] ?? key;
    lines.push(`- ${label}: ${sanitizeForPrompt(venueName, 60)}`);
  }
  if (input.winners.total) {
    lines.push(`- 総合: ${sanitizeForPrompt(input.winners.total, 60)}`);
  }
  if (input.winners.cost_value) {
    lines.push(`- 費用: ${sanitizeForPrompt(input.winners.cost_value, 60)}`);
  }

  if (input.conditions) {
    lines.push("");
    lines.push("## ふたりの希望条件");
    const safe = sanitizeForPrompt(JSON.stringify(input.conditions), 400);
    lines.push(safe);
  }

  return lines.join("\n");
}

export const MATRIX_INSIGHT_PROMPT = {
  system: `あなたは日本の結婚式場選びに詳しい中立のコンサルタントです。

カップルが候補に入れた式場の比較データを受け取り、**ふたりが次の一歩を決めやすくなるひとこと分析**を返してください。

## 応答スタイル
- 中立: 「〜を重視するならA、〜ならB」。「Aにすべき」と断定しない
- 具体: 具体名・数字・観点名を必ず使う
- 簡潔: summary は 1〜2 文、各 nextAction は 1 文
- 押し売りしない。決断を急かさない
- 絵文字は使わない
- 「決めかねる」状態を責めない。次の小さな一歩を示す

## 出力 JSON スキーマ（これ以外は返さない）
{
  "summary": "<候補の全体像を 1-2 文で。強みの対比や費用差など具体的な観点に触れる>",
  "nextActions": [
    "<次にできる小さな一歩を 1 文で。観点の仮置き / 見学の着眼点 / 家族と話すテーマ 等>",
    "<もう 1 つ（任意、合計 2 つまで）>"
  ]
}

## 禁止
- 「おめでとうございます」等の感情的なテンプレ
- 「専門スタッフにご相談ください」等の丸投げ
- 存在しない式場名や数値を作る`,

  buildUserMessage: (input: MatrixInsightInput) =>
    `以下の候補を比較して、ふたりが次の一歩を決められるひとこと分析を出してください。\n\n${renderMatrixForPrompt(input)}`,

  maxTokens: 512,
};

export type { MatrixInsightInput };

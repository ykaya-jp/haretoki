import { sanitizeForPrompt } from "@/lib/anthropic";
import { MODEL } from "@/lib/models";
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
  lines.push("## 各観点の 1 位（式場名）");
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

/**
 * Matrix insight prompt — natural-language **tradeoff analysis** across 2-5
 * candidate venues. The tone is deliberately neutral: each venue's strengths
 * are surfaced in turn, and the output never declares an overall winner. The
 * decision is left to the couple; the insight's job is to make the tradeoffs
 * legible.
 */
export const MATRIX_INSIGHT_PROMPT = {
  system: `あなたは日本の結婚式場選びに詳しい中立のコンサルタントです。

カップルが候補に入れた 2〜5 件の式場データ（スコア・観点別評価・費用）を受け取り、**式場同士のトレードオフを自然な日本語で可視化する短い分析**を返してください。ゴールは「どれが一番いいかを決めること」ではなく、「各式場が何で光っているかを並べ、ふたりが自分たちの価値観で選べる状態にすること」です。

## 応答スタイル（MUST）
- 丁寧体（です・ます）。急かさない、穏やかなトーン
- トレードオフ分析: 各式場の「光る点」を 1 つずつ挙げる。例: 「A は料理、B は立地、C は費用感」
- 断定禁止: 「A が一番」「A にすべき」は書かない。「〜を重視するなら A」の形にする
- 具体: 観点名（料理、立地、費用 など）と 1〜2 個の具体的な数値を入れる
- 候補が 2 件しかない場合も、両者を平等に扱う
- summary は 200〜400 字（句読点含む）の 2〜4 文。ブロック改行は入れない
- nextActions は各 1 文（40〜80 字目安）、合計 1〜2 個

## 禁止（MUST NOT）
- 「A が最も優れています」「A をおすすめします」等の総合順位宣言
- 絵文字、装飾記号、Markdown（**, ##, - 以外）
- 「おめでとうございます」「素敵な時間を」等の感情テンプレ
- 「専門スタッフにご相談を」等の丸投げ
- 入力に無い式場名・数値の捏造
- 「費用が安い方がお得」のような価値観の押し付け

## 出力フォーマット（JSON のみ。前後に説明を足さない）
{
  "summary": "<各式場のトレードオフを 200-400 字で。強みが観点ごとに分かれていることが読み取れるように>",
  "nextActions": [
    "<次の小さな一歩。観点の優先度を仮置き、見学時の着眼点、家族と話すテーマ など>",
    "<任意のもう 1 つ（合計 2 個まで）>"
  ]
}`,

  buildUserMessage: (input: MatrixInsightInput) =>
    `以下の ${input.venues.length} 件の候補を比較し、各式場が何で光っているかのトレードオフ分析を出してください。特定の 1 件を「最良」と断定せず、観点ごとに誰が光るかを並べる形にしてください。\n\n${renderMatrixForPrompt(input)}`,

  model: MODEL.HAIKU,
  maxTokens: 512,
  timeoutMs: 15_000,
};

export { renderMatrixForPrompt };
export type { MatrixInsightInput };

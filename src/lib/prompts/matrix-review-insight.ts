import { sanitizeForPrompt } from "@/lib/anthropic";
import { MODEL } from "@/lib/models";

/**
 * Per-venue review aggregate fed into the cross-venue insight prompt.
 *
 * Shape mirrors the existing `ReviewSummary` interface in
 * `src/server/actions/reviews.ts` (line ~42) so the R2 helper
 * `getReviewSummariesForVenues` can produce values that drop in here
 * directly. Only the fields that survive PII sanitisation are
 * exposed — review **bodies** are never threaded into this prompt;
 * we only pass the AI-derived summary + the canonical strengths /
 * concerns lists, all of which are already-redacted text.
 */
export interface MatrixReviewVenueAggregate {
  /** Venue display name. Sanitised before being emitted to the prompt. */
  name: string;
  /** Short editorial summary (already AI-redacted, no review bodies). */
  summary: string;
  /** Top strength bullets (max 5 — anything longer is truncated). */
  strengths: string[];
  /** Top concern bullets (max 5 — anything longer is truncated). */
  concerns: string[];
  /** Number of distinct reviews aggregated. Drives the prompt's
   *  hedging — a 1-review venue gets framed less confidently than a
   *  10-review venue. */
  reviewCount: number;
}

export interface MatrixReviewInsightInput {
  venues: MatrixReviewVenueAggregate[];
}

export interface MatrixReviewInsightOutput {
  /** Concerns that recur across ≥ 2 venues. Reads as "ふたりが見て
   *  おくべき共通の注意点". 0-3 entries; empty when nothing recurs. */
  commonConcerns: string[];
  /** Points where venues genuinely diverge — "A は X が強み、B は Y
   *  が強み" framing. 0-3 entries; empty when all venues read the
   *  same. */
  divergence: string[];
  /** One concrete next-step the couple should confirm at their next
   *  visit. ~40-80 chars. */
  decisionHint: string;
  /** True when rendered from the deterministic template fallback
   *  (Claude unavailable, request failed, JSON malformed). */
  fallback: boolean;
}

/** Cap each strength / concern list at 5 items — beyond that the
 *  prompt becomes noise and the cache hash starts churning on
 *  re-orderings of long tails. */
const BULLET_CAP = 5;

function renderForPrompt(input: MatrixReviewInsightInput): string {
  const lines: string[] = [];

  lines.push("## 候補式場の口コミまとめ");
  for (const v of input.venues) {
    const name = sanitizeForPrompt(v.name, 60);
    const summary = sanitizeForPrompt(v.summary, 280);
    const strengths = v.strengths
      .slice(0, BULLET_CAP)
      .map((s) => sanitizeForPrompt(s, 80));
    const concerns = v.concerns
      .slice(0, BULLET_CAP)
      .map((c) => sanitizeForPrompt(c, 80));

    lines.push("");
    lines.push(`### ${name} (口コミ ${v.reviewCount} 件)`);
    lines.push(`まとめ: ${summary}`);
    if (strengths.length > 0) {
      lines.push(`強み: ${strengths.join(" / ")}`);
    }
    if (concerns.length > 0) {
      lines.push(`気になる点: ${concerns.join(" / ")}`);
    }
  }

  return lines.join("\n");
}

/**
 * Cross-venue review-aggregation prompt — natural-language insight
 * across 2-5 candidate venues' aggregated reviews. The output is
 * deliberately structured into three lanes:
 *
 *   - `commonConcerns`: concerns that show up across 2+ venues. The
 *     couple uses this to set "things to verify at every visit".
 *   - `divergence`: where the venues genuinely differ — surfaces
 *     the value-axis the venue choice actually turns on.
 *   - `decisionHint`: one specific next action the couple can take
 *     at the next visit (e.g. "A の駐車場と B の控室の音漏れを当日
 *     確認しましょう").
 *
 * Tone matches `MATRIX_INSIGHT_PROMPT` (W18-7) — neutral, no
 * winners declared, no urgency, no marketing language. See
 * `docs/brand-voice.md` for the canonical voice rules and
 * `docs/ai/prompts/matrix-review-insight.system.md` for the spec.
 */
export const MATRIX_REVIEW_INSIGHT_PROMPT = {
  system: `あなたは日本の結婚式場選びに詳しい中立のコンサルタントです。

カップルが候補に入れた 2〜5 件の式場について、すでに集計された口コミ要約・強み・気になる点を受け取り、**式場を横断して見えてくる共通の懸念と、式場ごとに分かれる点**を可視化してください。ゴールは「どこが一番いいかを決める」ことではなく、「次の見学・打ち合わせでどこを確認すべきか、ふたりが共通言語で話せる状態にすること」です。

## 応答スタイル（MUST）
- 丁寧体（です・ます）。急かさない、穏やかなトーン
- 「式場名 は X が強み、Y が気になる」のような具体名を必ず入れる（観点だけの抽象論にしない）
- 共通懸念: 2 件以上の口コミで似た方向の不安が出ている場合に列挙。完全一致でなくてもよい（例: 「アクセスの分かりにくさ」「最寄駅からの距離」を「アクセス面の確認」にまとめる）
- 分岐: 各式場の **強み** が明確に違う点に絞る。「料理は A、立地は B」のような形
- decisionHint: 見学・打ち合わせで確認できる **具体的な行動** を 1 つだけ。「外せない条件を整理する」のような抽象指示は禁止
- 口コミ件数が 1-2 件と少ない式場は、断定を避け「口コミが少なめなため見学で要確認」と添える

## 禁止（MUST NOT）
- 「A が最も評判が良い」「A をおすすめします」等の総合順位宣言
- 絵文字、装飾記号、Markdown（**, ##, - 以外）
- 「お客様」「素敵な時間を」等の感情テンプレ
- 「専門スタッフにご相談を」等の丸投げ
- 入力に無い式場名・口コミ内容の捏造
- 1 件しか口コミが無い venue を 5 件と同等に扱う断定

## 出力フォーマット（JSON のみ。前後に説明を足さない）
{
  "commonConcerns": [
    "<2 件以上で共通する懸念。0-3 個。なければ空配列>"
  ],
  "divergence": [
    "<式場名同士の強みの違いを 1 文で。0-3 個>"
  ],
  "decisionHint": "<次の見学で確認するべき具体的な 1 アクション。40-80 字目安>"
}`,

  buildUserMessage: (input: MatrixReviewInsightInput) =>
    `以下の ${input.venues.length} 件の候補式場の集計済み口コミを横断して、共通の懸念と式場ごとの分岐点を分析してください。特定の 1 件を「最良」と断定せず、観点ごとの違いを並べる形にしてください。\n\n${renderForPrompt(input)}`,

  model: MODEL.HAIKU,
  maxTokens: 768,
  timeoutMs: 15_000,
  /** Bump when prompt semantics change so old cached entries (this
   *  field is part of the cache `inputHash`) don't surface stale
   *  outputs after a deploy. */
  promptVersion: 1,
} as const;

export { renderForPrompt };

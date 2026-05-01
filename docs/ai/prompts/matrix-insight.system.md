---
name: matrix-insight.system
pairs_with: src/lib/prompts/matrix-insight.ts
model: claude-haiku-4-5-20251001
maxTokens: 512
timeoutMs: 15000
last_synced: 2026-05-02
---

# Matrix Insight Prompt — 仕様

候補式場 2-5 件のスコア行列 + 費用 + 観点別 1 位 を読み、**式場同士のトレードオフ**を自然な日本語で可視化する短い分析を返す prompt。Decision Matrix (compare board) の AI Insight Card に表示される。
`src/lib/prompts/matrix-insight.ts` の `MATRIX_INSIGHT_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: 日本の結婚式場選びに詳しい中立のコンサルタント
- 役割: 「どれが一番いいかを決める」のではなく、**各式場が何で光っているかを並べ、ふたりが自分たちの価値観で選べる状態にする**
- スタンス: 断定禁止、平等扱い、観点ベース

## Input (User Message)

`buildUserMessage(input: MatrixInsightInput)` で生成。`renderMatrixForPrompt` (matrix-insight.ts:17-59) が固定フォーマット:

```
以下の <N> 件の候補を比較し、各式場が何で光っているかのトレードオフ分析を出してください。特定の 1 件を「最良」と断定せず、観点ごとに誰が光るかを並べる形にしてください。

## 候補式場
- <name>: 総合=<X>, <dim1>=<X>, <dim2>=<X>, …, 費用=¥<XX>万円
- …

## 各観点の 1 位（式場名）
- <dim1>: <name>
- …
- 総合: <name>
- 費用: <name>

## ふたりの希望条件
<JSON.stringify(conditions) を 400 char に sanitize>
```

すべての venue name / dim label / conditions は `sanitizeForPrompt` 適用済 (60 / 60 / 400 char)。

## Output (JSON Shape)

```json
{
  "summary": "<各式場のトレードオフ 200-400 字、2-4 文、ブロック改行なし>",
  "nextActions": [
    "<次の小さな一歩 (40-80 字)>",
    "<任意のもう 1 つ (合計 2 個まで)>"
  ]
}
```

## Generation Rules

### MUST
- 丁寧体（です・ます）。急かさない、穏やかなトーン
- **トレードオフ分析**: 各式場の「光る点」を 1 つずつ挙げる (例: 「A は料理、B は立地、C は費用感」)
- **断定禁止**: 「A が一番」「A にすべき」は書かない。「〜を重視するなら A」の形にする
- **具体**: 観点名（料理 / 立地 / 費用 等）と 1-2 個の具体的な数値を入れる
- 候補が 2 件しかない場合も、両者を平等に扱う
- summary は 200-400 字（句読点含む）の 2-4 文。ブロック改行は入れない
- nextActions は各 1 文（40-80 字目安）、合計 1-2 個

### MUST NOT
- 「A が最も優れています」「A をおすすめします」等の総合順位宣言
- 絵文字、装飾記号、Markdown（**, ##, - 以外）
- 「おめでとうございます」「素敵な時間を」等の感情テンプレ
- 「専門スタッフにご相談を」等の丸投げ
- 入力に無い式場名・数値の捏造
- 「費用が安い方がお得」のような価値観の押し付け

## PII / Sanitize 注意

- venue name は caller (`renderMatrixForPrompt`) で `sanitizeForPrompt(_, 60)` 適用済
- conditions は `sanitizeForPrompt(JSON.stringify(_), 400)` 適用済 (タグ剥がし + 改行平坦化 + 400 char 切詰め)
- 出力に PII は含まれない設計（venue name は user-controlled の自前データ。第三者 PII は流入経路なし）

## Caller

- `src/server/actions/matrix-insight.ts:113-150`
- 呼び方: `Promise.race([withRetry(askClaude), timeoutPromise])`
  - `MATRIX_INSIGHT_PROMPT.timeoutMs = 15_000` (15 秒の hard timeout、`/compare` ボードレンダーをブロックさせない)
- 失敗 / timeout / JSON parse 失敗 → `templateInsight(input)` で fallback (常に成功する)
- code fence ` ```json ` 自動除去

## Cache

- `aiAnalysis` テーブル (`type: "matrix_insight"`、TTL 3 日) を `getCachedAnalysis(projectId, type, inputHash)` 経由で利用
- `inputHash`: `sha256({ venues, winners, conditions, model, promptVersion: 2 })` 16 字
  - **`promptVersion: 2` が prompt 改定時の cache buster**。semantics 変更時に `+1` する規約 (matrix-insight.ts:79)
  - model も hash に含めるので Haiku / Sonnet 切替で stale を出さない

## Model 選定理由

- **HAIKU 採用** (max 512 token): トレードオフ可視化は **構造化された比較タスク**で、観点抽出 + 言語化のレイテンシが UX に直結 (`/compare` で待たされる)。Haiku で十分な品質
- 過去に Sonnet を試した時期もあったが、3 倍コスト + 1.5 倍レイテンシに対する品質向上が限定的
- max 512 token: summary 400 字 + nextActions 2 件 で十分

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/matrix-insight.ts` を同期 (system / buildUserMessage / model / maxTokens / timeoutMs)
3. `last_synced` を更新
4. **prompt semantics を変えた場合は `matrix-insight.ts:79` の `promptVersion: 2` を `+1` する** (cache buster)
5. `/candidates/compare` (or 該当 board) で 2-3 件候補を入れて 1 回スモーク → AI Insight に summary が出る + 15 秒以内
6. PR description に「matrix-insight prompt 改定」と明記

## 既知の限界

- 候補 6 件以上 (caller 上限は 5) を入れた場合の挙動未検証
- summary 400 字制約はソフト (caller で切り詰め未実装)。Haiku が 400 字超で返した場合 UI レイアウトが崩れる余地
- `nextActions` の 40-80 字制約はソフト。caller 側で長さ検証なし
- timeout 時は `templateInsight` (静的テンプレ) で fallback するが、ユーザーには区別がつかない (UI に "AI 推定" バッジ等なし)

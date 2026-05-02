---
name: matrix-review-insight.system
pairs_with: src/lib/prompts/matrix-review-insight.ts
model: claude-haiku-4-5-20251001
maxTokens: 768
timeoutMs: 15000
promptVersion: 1
last_synced: 2026-05-03
---

# Matrix Review Insight Prompt — 仕様

候補式場 2-5 件の **集計済み口コミデータ** (review summary + strengths + concerns) を読み、

- 横断で見える **共通の懸念**
- 式場ごとの **強みの分岐**
- 次の見学・打ち合わせで確認すべき **具体的な 1 アクション**

を JSON で返す prompt。Decision Matrix (compare board) で `MatrixInsightCard` (W18-7、定量比較側) の隣に並べる定性版 insight を生成する。`src/lib/prompts/matrix-review-insight.ts` の `MATRIX_REVIEW_INSIGHT_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: 日本の結婚式場選びに詳しい中立のコンサルタント (W18-7 と同じ役名で、口調・トーンを揃える)
- 役割: 「どこが一番いいかを決める」のではなく、**ふたりが見学・打ち合わせで何を確認すべきかを共通言語化する**
- スタンス: 断定禁止 / 平等扱い / 観点ベース / **件数の少ない venue は断定しない**

## Input (User Message)

`buildUserMessage(input: MatrixReviewInsightInput)` で生成。`renderForPrompt`
(`src/lib/prompts/matrix-review-insight.ts`) が固定フォーマット:

```
以下の <N> 件の候補式場の集計済み口コミを横断して、共通の懸念と式場ごとの分岐点を分析してください。特定の 1 件を「最良」と断定せず、観点ごとの違いを並べる形にしてください。

## 候補式場の口コミまとめ

### <name> (口コミ <count> 件)
まとめ: <summary>
強み: <s1> / <s2> / …
気になる点: <c1> / <c2> / …

### <next venue> …
```

各文字列フィールドは `sanitizeForPrompt` 経由で長さ上限 + PII redaction 済み。`strengths` / `concerns` は `BULLET_CAP=5` で truncate。

### MatrixReviewVenueAggregate

```ts
interface MatrixReviewVenueAggregate {
  name: string;          // 式場名 (sanitised, ≤60 chars)
  summary: string;       // AI-derived summary (≤280 chars)
  strengths: string[];   // 強みの bullet (上位 5)
  concerns: string[];    // 気になる点 bullet (上位 5)
  reviewCount: number;   // 集計元の口コミ件数
}
```

R2 worker の `getReviewSummariesForVenues(venueIds)` が
`Promise<Map<string, ReviewAggregate>>` を返し、`getMatrixReviewInsight`
がその Map を `MatrixReviewVenueAggregate[]` に変換する。

### Pre-flight ガード (server action 側)

| 条件 | 挙動 |
|---|---|
| `venueIds.length < 2` | `null` を返す (matrix-insight と同 pattern) |
| 全 venue で `reviewCount === 0` | `null` を返す (口コミゼロでは insight を作らない) |
| Claude unavailable | `templateInsight()` フォールバック (fallback: true) |
| Cache hit | キャッシュ済 JSON を即返す (TTL 3 日) |
| Cache miss + Claude OK | 生成 → cache 書込 |
| Claude timeout / JSON malformed | `templateInsight()` フォールバック |

## Output (Strict JSON)

```jsonc
{
  "commonConcerns": [
    // 2 件以上の venue で似た方向の懸念が出ている場合に列挙。
    // 完全一致でなくても括る (例: 「アクセスの分かりにくさ」+
    // 「最寄駅からの距離」→「アクセス面の確認」)。
    // 0-3 entries; 何もなければ空配列。
  ],
  "divergence": [
    // venue 同士で強みが分かれる点を「式場名 は X、別 は Y」の
    // 形で。0-3 entries。
  ],
  "decisionHint": "<見学・打ち合わせで確認できる具体的な 1 アクション>"
}
```

`fallback: boolean` は server action 側で付与する (prompt の出力には含めない)。

## Tone & Lexicon

`docs/brand-voice.md` 準拠:
- 丁寧体 (です・ます)
- 急かさない / 売らない / 中立
- 「お客様」禁止、「ふたり / おふたり」を使う
- 絵文字 / 「専門スタッフにご相談を」 / 感情テンプレ禁止

## 禁止事項

- 「A が最も評判が良い」「A をおすすめします」等の総合順位宣言
- 入力に無い venue 名・口コミ内容の捏造
- 1 件しか口コミが無い venue を 5 件と同等に断定して扱うこと
- decisionHint に「外せない条件を整理する」のような抽象指示
- markdown 装飾 (`**`, `##`, `-`)、絵文字

## Cache 設計

- **AiAnalysisType**: `matrix_review_insight` (本ラウンドで enum 追加 + additive migration)
- **TTL**: 3 日 (`src/server/ai/cache.ts` の `TTL_DAYS`)
- **inputHash**: `JSON.stringify({ venueIds.sort(), aggregates: venues.map(v => ({id, summary, strengths, concerns, reviewCount})), model, promptVersion })` を `computeInputHash` で SHA256
- **Invalidation**: prompt version bump (`promptVersion` フィールド) + `invalidateAiCache(venueId, ['matrix_review_insight'])` で venue 編集時の purge

## 動的スモーク

3 venue 選んで /compare → AI 集約 card (commonConcerns / divergence / decisionHint の 3 セクション) が表示。
2 回目 reload で cache hit → 体感即時。
venue を 1 件入れ替え → cache miss → 新 insight 生成 (~5-10s)。

## 関連ドキュメント

- `docs/ai/prompts/matrix-insight.system.md` — 定量側の姉妹プロンプト
- `docs/ai/prompts/review-summary.system.md` — 入力元の単一 venue 口コミ集約
- `docs/brand-voice.md` — 文体・呼称ルール
- `docs/ai/guardrails.md` — PII / コスト上限

---
name: review-summary.system
pairs_with: src/lib/prompts/review-summary.ts
model: claude-sonnet-4-6
maxTokens: 2048
last_synced: 2026-05-02
---

# Review Summary Prompt — 仕様

式場ごとの口コミ集合を要約し、感情スコア・推奨評価・見積もり上昇シグナルを抽出する prompt。
`src/lib/prompts/review-summary.ts` の `REVIEW_SUMMARY_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: 日本のウェディング会場レビュー分析エキスパート
- 役割: ある式場の口コミテキスト群を読み、**全体傾向を要約 + 6 軸 sentiment + 推奨スコア + 見積もり乖離指標**を返す
- スタンス: 個別の口コミを引用せず**パターンとして要約する**。批判もコンストラクティブに

## Input (User Message)

`buildUserMessage(reviews: string[], venueName: string)` で生成:

```
以下は「<venueName>」の口コミ内容です（<reviews.length>件）。分析してください:

<review1>
---
<review2>
---
...
```

`reviews.join("\n---\n").slice(0, 50000)` で **50,000 char に切り詰め**。

## Output (JSON Shape)

```json
{
  "summary": "<overall summary in Japanese, 150-200 chars>",
  "sentiment": {
    "atmosphere": <-1.0 to 1.0>, "hospitality": <-1.0 to 1.0>,
    "cuisine": <-1.0 to 1.0>, "cost": <-1.0 to 1.0>,
    "access": <-1.0 to 1.0>, "overall": <-1.0 to 1.0>
  },
  "strengths": ["<top 3 positives in Japanese>"],
  "concerns": ["<top 3 concerns in Japanese>"],
  "reviewCount": <number>,
  "suggestedScores": {
    "atmosphere": <1-5>, "hospitality": <1-5>, "cuisine": <1-5>,
    "cost": <1-5>, "access": <1-5>, "reviews": <1-5>
  },
  "estimateIncrease": {
    "initial": <初期見積もり円, integer, optional>,
    "final": <最終金額円, integer, optional>,
    "deltaYen": <上昇額円, integer, optional>,
    "deltaPct": <上昇率%, number, optional>,
    "confidence": "high" | "medium" | "low",
    "note": "<短い補足, Japanese, optional>"
  }
}
```

`estimateIncrease` は **見積もり / 金額に関する言及があるときだけ** 埋める（無いときは object ごと省略可）。

## Generation Rules

### 全体方針
1. **Concerns はコンストラクティブに**フレームする（攻撃的にしない）
2. **原文丸写し禁止**。パターンとしてまとめる（個人発言の引用に陥らない）
3. summary は 150-200 文字、Japanese
4. strengths / concerns は **top 3** に絞る

### estimateIncrease 抽出ルール
- 「見積もり」「最終金額」「追加費用」「+◯◯万円」等のキーワードがある時のみ埋める
- "初期見積もり" / "最初の見積もり" → `initial`
- "最終金額" / "実際の金額" → `final`
- delta だけ言及されている場合 ("+80 万円上がった" / "20% アップ") は `deltaYen` / `deltaPct` を直接埋める
- **万円単位の換算**: 1 万 = 10000 yen。"+80 万円" → `deltaYen: 800000`
- `confidence`:
  - `high`: 具体数字が引用されている
  - `medium`: 概算
  - `low`: 定性的記述のみ ("高くなった")
- 価格言及が全く無いときは `estimateIncrease` object ごと省略 (or 全フィールド undefined)

## PII / Sanitize 注意

- caller (`src/server/actions/reviews.ts:294`) で `stripPII(textContent)` を **呼び出し前に必ず実行**
  - email / 電話番号 / 郵便番号 / 「〇〇様/さん/くん/ちゃん」を `[REDACTED]` に置換
- 「原文丸写し禁止」を prompt 側でも明記しているが、**最終防衛は stripPII**
- 出力に PII は含まれない設計（要約のみ）

## Caller

- `src/server/actions/reviews.ts:300-308` — 口コミ要約フロー
- 呼び方: `withRetry(() => askClaude({ system, userMessage }))`（cache miss 時のみ）
- code fence + 余分な前置き除去 (`stripJsonResponse`) → JSON.parse → schema check

## Cache

- `aiCache` テーブル (`computeInputHash` ベース) で永続キャッシュ
- `inputHash`: `JSON.stringify({ system, user })` の sha256 16 字
- ヒット時は API call スキップ。miss 時は AI 応答を `setCachedResponse(hash, response, "claude-haiku-4-5-20251001")` で保存
  - **注**: model id が `"claude-haiku-4-5-20251001"` でハードコードされているが**実際のモデルは Sonnet**。cache 列の model 名は監査メタデータのみで再呼び出しに影響しない (整合性は要レビュー、P3)

## Model 選定理由

- **SONNET 採用**: 6 軸 sentiment + 価格 delta 抽出は精度が直接ユーザーの判断材料になるため
- HAIKU は estimateIncrease の数字抽出 (特に "+80万" → 800000) のミスが目立ち不採用
- max 2048 token: 上記 JSON 形状が収まる範囲

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/review-summary.ts` を同期 (system / buildUserMessage / model / maxTokens)
3. `last_synced` を更新
4. 式場詳細から「口コミを取り込む」フローを 1 回スモーク → JSON 全フィールドが埋まる or 想定通り省略されることを確認
5. estimateIncrease を含むレビューと含まないレビューの両方で確認
6. PR description に「review-summary prompt 改定」と明記

## 既知の限界

- 50,000 char で truncate しているため、**多レビューの式場では末尾が落ちる**（現状は単純切り取り、重要度ソート未実装）
- caller 側のキャッシュ書き込み時の model id 文字列が実際のモデル ID と一致していない (`"claude-haiku-4-5-20251001"` 固定) — メタデータの整合性は P3 で修正
- `suggestedScores` の妥当性検証は caller 未実装 (1-5 範囲は信頼)

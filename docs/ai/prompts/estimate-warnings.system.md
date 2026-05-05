---
name: estimate-warnings.system
pairs_with: src/lib/prompts/estimate-warnings.ts
model: claude-haiku-4-5-20251001
maxTokens: 800
last_synced: 2026-05-05
---

# Estimate Warnings Prompt — 仕様

初期見積もりを読み、**記載漏れ / 上がりやすい項目 / 予算超過** の観点で 3-5 件の警告を JSON 配列で返す prompt。`EstimateXRay` の統計ベース表示 (`upgradeProbability` で sort) の **下** に AI 警告セクションを描画する。

`src/lib/prompts/estimate-warnings.ts` の `ESTIMATE_WARNINGS_SYSTEM` と必ず同期する。

## Persona / Role

- 役名: 結婚式場の見積もりレビュー専門家
- 役割: items + totalEstimate + budgetMax + venueLocation を読み、severity 付きの警告 3-5 件を生成
- スタンス: 数字で具体的に (「+30万円」「予算の 125%」)。曖昧な「注意が必要」「高くなりがち」は禁止

## Input (User Message)

`buildEstimateWarningsUserMessage(input: EstimateWarningsInput)` で生成:

```
総見積もり額: ¥<totalEstimate>
予算上限: ¥<budgetMax> (現状 <pct>%)   ← budgetMax があれば
式場エリア: <location>                  ← location があれば

見積もり項目:
- [<category>] <itemName>: ¥<amount> (tier=<tier>)
- ...

上記をレビューし、記載漏れ / 上がりやすい項目 / 予算超過の観点で 3-5 件の警告を JSON で返してください。
```

`budgetMax` が null のときは「未設定」と表示し、予算観点の警告は出ない想定。

## Output (JSON Shape)

```json
{
  "warnings": [
    {
      "severity": "alert" | "warn" | "info",
      "title": "ドレス持ち込み料が未記載",
      "message": "当日に +30〜50 万円の追加が起きやすい項目です。\n持ち込み可否と料金を事前に確認してください。",
      "relatedItem": "ドレス"
    }
  ]
}
```

- `severity`: alert (赤系) / warn (gold) / info (muted)
- `title`: 1 行 30 字以下
- `message`: 2-3 行 (改行 `\n` 区切り、120 字以下)
- `relatedItem`: 該当する items の `itemName` と完全一致する場合のみ含める (任意)
- 件数: 3-5 件。気になる点が少ないなら 0 件 (空配列) でも可

## Severity 基準

| severity | 例 |
|---|---|
| alert | 予算 25% 超過 / 当日 +30 万円以上の上振れ事例 / 記載漏れの定番 |
| warn  | 予算 10-25% 超過 / 上振れ +10-30 万円 |
| info  | 検討余地ありの周辺項目 |

## few-shot 例 (system prompt 内に内蔵)

- 「ドレス持ち込み料が記載なし → 当日 +30〜50 万円の事例多数」
- 「音響オプションが基本のみ → 写真・動画と合わせて当日 +40 万円事例」
- 「予算上限を 25% 超過 → 優先度の高い 3 項目を見直し推奨」

## PII / Sanitize 注意

- 入力は item の **金額 / category / itemName / tier** と venue の **location** のみ
- ユーザー由来の自由記述は流入しない (item.itemName は extract 由来 / 候補 enum 中心)
- PII 流入経路なし。出力もカテゴリ enum + 金額数字 + 説明文のみ

## Caller

- `src/server/actions/estimate-warnings.ts` — `generateEstimateWarnings(venueId)`
- `requireVenueAccess` で project member だけが呼べる
- Claude 未設定時は **`{warnings: [], cached: false}` で degrade**
- 失敗時 (raw == null / parse 失敗) も同様 (throw しない)

## Cache

- `cachedAskClaude` 経由 (`src/lib/ai-cache.ts`) で **AiCache 永続キャッシュ**
- `promptVersion: ESTIMATE_WARNINGS_PROMPT_VERSION = 1` を hash key に含める
- hash recipe (実体は `cachedAskClaude` が `{system, user, model, version, maxTokens}` を内包):
  - `system` / `userMessage` / `model` / `promptVersion` / `maxTokens`
  - **estimate item 集合 + budget が変われば userMessage が変わるので自動で cache miss**
  - **estimate.updatedAt** は userMessage に含めず、items / budget / location の hash で十分 (estimate 編集 → items 差分が出る → cache miss)
- TTL: AiCache の標準 30 日 (`src/lib/ai-cache.ts:19`)。**prompt 改定時は `ESTIMATE_WARNINGS_PROMPT_VERSION` を `+1`** して buster

## Model 選定理由

- **HAIKU 採用** (default, via `cachedAskClaude`): 構造化された短い JSON 出力 / 30 字 title × 3-5 件 / 2 観点判定 (予算 / 上振れ)。Sonnet 不要
- maxTokens 800 (default 1024 より少し絞る)。3-5 件 × ~120 字 + 構造化キーで 600 token 程度

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/estimate-warnings.ts` を同期 (system / buildUserMessage)
3. `last_synced` を更新
4. **prompt semantics を変えた場合は `src/server/actions/estimate-warnings.ts` の `ESTIMATE_WARNINGS_PROMPT_VERSION` を `+1` する** (cache buster)
5. 任意の式場 (見積もり済) で 1 回スモーク → 警告 0-5 件が UI に出る (severity 別の色分けまで確認)
6. PR description に「estimate-warnings prompt 改定」と明記

## 既知の限界

- few-shot 例は system prompt 内 (3 件のみ)。venue 種別 (邸宅 / ホテル / 専門式場) ごとの差は反映されない
- `items` の数が多い場合 (15 件以上) は user message が長くなる → maxTokens 不足の可能性あり (現状は問題出ていない)
- "上振れの実例" は LLM の常識依存 (内部に「他カップルの見積もり diff DB」を持つ仕組みではない)。R2 で actuals を集めたら別系統 (RAG) に発展させる余地
- LLM が `{warnings: [...]}` 以外の shape (例: `{result: [...]}`) で返すと caller の zod で fail → 空配列で degrade

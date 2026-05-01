---
name: estimate-extract.system
pairs_with: src/lib/prompts/estimate-extract.ts
model: claude-sonnet-4-6
maxTokens: 4096
last_synced: 2026-05-02
---

# Estimate Extract Prompt — 仕様

見積書 PDF (Japanese 結婚式場 見積書) を Claude の **document-block API** に投げ、行明細 + 想定最終金額を抽出する prompt。

> 2026-05-02 — Phase 2.A round 2 で **`src/lib/prompts/estimate-extract.ts` に切り出し済**。caller (`src/server/actions/estimate-ai.ts`) は import 経由で参照。
> PENDING.md では便宜上 "estimate-analysis" と呼ぶが、実装上の prompt 名は `ESTIMATE_EXTRACT_SYSTEM_PROMPT`。

## Persona / Role

- 役名: 日本のウェディング会場 見積書 構造化抽出エキスパート
- 役割: PDF 見積書から **総額・項目分類・予測最終金額** を valid JSON で返す
- スタンス: 確証が無い行は **omit する**（推測で埋めない）

## Input (User Message)

`src/server/actions/estimate-ai.ts:113-138` で `messages.create` の content として組み立て:

```js
content: [
  { type: "document", source: { type: "url", url: <signed PDF URL> } },
  { type: "text", text: "このPDFから構造化データを抽出してJSONで返してください。" }
]
```

- PDF は `createEstimateSignedUrl(pdfUrl)` で **時限付き署名 URL** に変換してから渡す（private bucket を維持）
- text 部は固定の 1 文のみ（バリエーションなし）

### 旧パイプラインからの変更点
- 旧: `pdf-parse` → text dump → `askClaude` 経路。**columnar layout (項目 / 単価 / 数量 / 小計) が壊れる**問題、スキャン PDF (image-only) で空文字を返す問題があった
- 現: Claude native PDF (vision + structure) を直接利用。スマホ写真 → PDF も動く

## Output (JSON Shape)

```json
{
  "total": <number, total estimate amount in yen, integer>,
  "items": [
    {
      "category": "attire" | "cuisine" | "photo_video" | "flowers" | "performance" | "av_equipment" | "venue_fee" | "other",
      "itemName": "<item name in Japanese, concise>",
      "amount": <number, line subtotal in yen, integer>,
      "unit": "<optional unit like 名/卓/式/着 — omit if not stated>",
      "quantity": <optional number of units — omit if not stated>,
      "tier": "minimum" | "standard" | "premium" | "unknown"
    }
  ],
  "predictedFinal": <number, predicted final cost after typical upgrades, integer>,
  "analysisNote": "<brief Japanese note about prediction reasoning, 1-2 sentences>"
}
```

`tier` のデフォルトは `"unknown"`。`unit` / `quantity` は不明なら省略（**空文字 / 0 で埋めない**）。

## Extraction Rules

### 行金額抽出
- **小計 (line subtotal) を最優先**で `amount` に入れる
- 単価 × 数量しか書かれていない時は **`amount = unitPrice × quantity` を計算**

### Tier 判定
- `tier` は **明記された場合のみ** (スタンダード / プレミアム / 最低プラン 等)
- 不明時は `"unknown"`（推測しない）

### Category マッピング
| 見積書記載 | category |
|---|---|
| 会場使用料 / 挙式料 / サービス料 | `venue_fee` |
| 料理 / 飲物 | `cuisine` |
| 新婦衣裳 / タキシード | `attire` |
| 写真 / 映像 / エンドロール | `photo_video` |
| 装花 / ブーケ | `flowers` |
| 演出 / エフェクト / 司会 | `performance` |
| 音響 / 照明 / AV | `av_equipment` |
| その他 | `other` |

### Total
- 見積書に total が明示されていれば採用
- **無ければ items.amount の合計**を入れる

### predictedFinal の根拠（プロンプト内に明記）
日本のウェディング業界の典型 upgrade パターン:

| カテゴリ | upgrade 率 | 典型 +¥ |
|---|---|---|
| 衣装 (Attire) | 62% | +¥200,000-400,000 |
| 料理 (Cuisine) | 65% | +¥150,000-300,000 |
| 写真/映像 (Photo/Video/Endroll) | 50% | +¥200,000-350,000 |
| 装花 (Flowers) | 45% | +¥100,000-250,000 |
| 演出 (Performances) | 40% | +¥50,000-150,000 |
| AV/音響 (AV/Sound) | 30% | +¥30,000-80,000 |

### トーン
- "hidden costs" のような **不安を煽る表現は避ける**
- "typical adjustments other couples make" のように **ポジティブにフレーム**

### 自信無い場合
- 確実に抽出できない行は **omit**（推測で行を作らない）

## PII / Sanitize 注意

- 入力は **PDF document-block** であり、自由テキストの prompt injection 経路は固定文 1 行のみ
- ただし PDF 内には **新郎新婦氏名 / 連絡先**が含まれる可能性あり
  - 出力 schema に氏名・連絡先フィールドが無いため**通常は流出しない**
  - `analysisNote` 等の自由文に紛れる余地はあるため、`parseEstimateExtraction` 側で監査ログを残しつつ UI 表示前にレビュー推奨 (P3 課題)
- PDF 自体は private bucket。Anthropic への露出は **55 秒以内** (`PDF_EXTRACT_TIMEOUT_MS = 55_000`) のみ

## Caller

- `src/server/actions/estimate-ai.ts:80-183` — `extractEstimateItems(pdfUrl)`
- 呼び方: `getAnthropicClient().messages.create({ model: MODEL.SONNET, max_tokens: 4096, system: ESTIMATE_EXTRACT_SYSTEM_PROMPT, ... }, { signal })`
- **55 秒 hard timeout** (Vercel function 60s 上限の手前)
  - timeout / `AbortError` → ユーザー向けトースト「AI分析が時間内に完了しませんでした」
- billing / credit エラー → 「AI利用枠が一時的に上限に達しました」
- それ以外のエラー → 「AI分析に失敗しました: <message>」
- 戻り値は `{ ok: true, data, modelId }` または `{ ok: false, error }`（**throw しない**）

## Cache

- caller 側で AI cache **未使用**。同一 PDF の再抽出は毎回 Claude を呼ぶ
  - 理由: 一度抽出して `Estimate` レコード化したらユーザーは編集モードに移る前提。再呼び出しの想定が薄い

## Model 選定理由

- **SONNET 採用**: 一度の操作の精度が直接 `Estimate.items` の信頼性になるため
- 初期に HAIKU を試したが、**「料理単価 × 人数」を flat 金額と誤分類するケースが約 20%** に達したため不採用
- 5,000 万件のレイテンシではなく 1 件の正確性が支配的なユースケース → SONNET が適合
- max 4096 token: 30-50 行の長い見積書を 2048 token で出すと **JSON 配列の途中で truncate → parse 失敗** が再現したため 4096 に拡大

## Update Protocol

1. 本 md を編集（特に Output schema / category マッピング / upgrade rate 表）
2. 同 PR で `src/server/actions/estimate-ai.ts` の `ESTIMATE_EXTRACT_SYSTEM_PROMPT` を同期
3. `last_synced` を更新
4. 実 PDF (テキスト型 / 画像型 / 縦書き型 / 列構造型) の **少なくとも 1 つ**で 1 回スモーク → JSON 全フィールドが parse 成功 + items が妥当な行数
5. timeout 経路 (大ページ PDF) で「AI分析が時間内に〜」トーストが出ることも 1 回確認
6. PR description に「estimate extract prompt 改定」と明記

## 既知の限界 / 今後の課題

- **inline 配置**: モジュール化されていない (`src/server/actions/estimate-ai.ts` 内に直書き)。`src/lib/prompts/estimate-extract.ts` への切り出しは Phase 2 D 残
- AI cache 未実装 (同一 PDF を再 upload した時の二重課金リスクあり)
- predictedFinal の upgrade rate 表は **2024 年時点の業界 anecdotal 値**。年次更新が必要
- `analysisNote` の自由文に PII 混入の余地（PDF 内の氏名 / 連絡先）— UI 表示前にスクリーニング機構未整備
- timeout は 55 秒固定。長期的に Vercel function plan が変わったら再調整

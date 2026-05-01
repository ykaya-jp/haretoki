---
name: estimate-extract.system
pairs_with: src/lib/prompts/estimate-extract.ts
model: claude-sonnet-4-6
maxTokens: 4096
last_synced: 2026-05-02
---

# Estimate Extract Prompt — 仕様

見積書 PDF (Japanese 結婚式場 見積書) を Claude の **document-block API** に投げ、行明細 + 想定最終金額を抽出する prompt。

> 2026-05-02 round 2 — `src/lib/prompts/estimate-extract.ts` に切り出し済 (caller は `src/server/actions/estimate-ai.ts`、import 経由)。
> PENDING.md では便宜上 "estimate-analysis" と呼ぶが、実装上の prompt 名は `ESTIMATE_EXTRACT_SYSTEM_PROMPT`。

## 改訂履歴

- **2026-05-02 round 12** — PDF 大容量化 + UI 信頼性可視化:
  - **Anthropic Files API 移行** (`src/server/actions/estimate-ai.ts`): 既存の signed URL 経路に加えて、`client.beta.files.upload` 経由で PDF を Anthropic にアップロードし、`messages.create` の document block で `{ type: 'file', file_id }` 参照する経路を **新 default** として追加。caller (`analyzeEstimatePdf`) は file buffer を直接渡すため signed URL の発行 + Anthropic 側 fetch がスキップされる。Beta header `files-api-2025-04-14` を upload と (実装上は) 削除に付与。upload 後、ベストエフォートで `client.beta.files.delete` を fire-and-forget で実行 (Anthropic 側 file TTL によるクリーンアップにも頼る)
  - **PDF サイズ上限**: 10MB → **32MB** に拡大 (`PDF_MAX_SIZE` in `src/server/actions/estimates.ts` + `BUCKET_OPTIONS.estimates.fileSizeLimit` in `src/lib/supabase/storage.ts` + `PDF_MAX_BYTES` in `src/components/venues/estimate-pdf-upload.tsx` を同期)
  - **シグネチャ拡張**: `extractEstimateItems(input: string | { buffer: Buffer; filename: string })`。string 経路 (signed URL) はそのまま残し、object 経路 (Files API) を新たに受け付ける。既存 caller (test 含む) は影響なし
  - **「要確認」UI バッジ**: estimate-pdf-upload.tsx で `result.warnings` を state に保持し、AI 分析結果フォーム冒頭に **AlertTriangle + warnings リスト**を tone-warning カラーで surface。round 7 で server side に追加済の sanity-check (sum-vs-total drift > 10% 等) を初めて画面で見せる経路
- **2026-05-02 round 3** — Phase 2.A 見積もり PDF 解析の精度強化:
  - **A. Coverage rules**: multi-page 跨ぎ / merged cells / フッター項目 / ※注釈 / 合計欄区別 を明文化
  - **B. Numeric / tax / unit normalization**: 千円・万円単位の検出と yen 正規化、税抜/税込混在の税込ベース統一、消費税単独行の按分、軽減税率 8% 判定
  - **C. Category mapping 拡張**: ESTIMATE_PRESETS 55 件 (W18-5 拡張済) と整合する 8 カテゴリの正規写像表 (preset 由来の典型項目をキーワードベースで網羅)
  - **D. Hallucination guard 強化**: 不鮮明行の omit ルール明文化、tier=unknown のデフォルト強制、items 合計 vs total の 10% 超乖離を analysisNote に明示要求
  - **Schema 同期** (parser side): `category` / `tier` を z.enum で厳密化、`amount` の nonnegative() 制約を解除 (値引き行 amount: -50000 を許可)、`parseEstimateExtraction` の戻り値に `warnings` を追加 (sum-vs-total 乖離 > 10% で「N% 乖離」を hint)
  - **Caller 同期** (estimate-ai.ts / estimates.ts): `extractEstimateItems` 戻り値に `warnings: string[]` を追加 + console.warn で監査ログ、`analyzeEstimatePdf` 戻り値にも `warnings` を伝搬
- 2026-05-02 round 2 — `src/lib/prompts/estimate-extract.ts` に切り出し (no semantic change)
- 2026-05-02 round 1 — md 化 (初回正本化)

## Persona / Role

- 役名: 日本のウェディング会場 見積書 構造化抽出エキスパート
- 役割: PDF 見積書から **総額・項目分類・予測最終金額** を valid JSON で返す
- スタンス: **precision over coverage**。確証が無い行は **omit する**（推測で埋めない）

## Input (User Message)

`src/server/actions/estimate-ai.ts:84-107` で `messages.create` の content として組み立て:

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
  "total": <number, **税込 grand total** in yen, integer>,
  "items": [
    {
      "category": "attire" | "cuisine" | "photo_video" | "flowers" | "performance" | "av_equipment" | "venue_fee" | "other",
      "itemName": "<item name in Japanese, concise>",
      "amount": <number, line subtotal in yen, integer, **税込換算済**, 値引き行は負値可>,
      "unit": "<optional unit like 名/卓/式/着 — omit if not stated>",
      "quantity": <optional number of units — omit if not stated>,
      "tier": "minimum" | "standard" | "premium" | "unknown"
    }
  ],
  "predictedFinal": <number, predicted final cost after typical upgrades, integer>,
  "analysisNote": "<brief Japanese note: 予測根拠 + extraction caveats (税込/税抜きの扱い、抽出から除外した行、合計乖離 など), 1-3 sentences>"
}
```

`tier` のデフォルトは `"unknown"`。`unit` / `quantity` は不明なら省略（**空文字 / 0 で埋めない**）。
**round 3**: `category` / `tier` は parser 側で z.enum strict 化。enum 外の値は schema rejection。`amount` は parser で **負値も許可** (値引き行)。

## Coverage Rules（A、抽出漏れ防止）

| 状況 | 扱い |
|---|---|
| **複数ページに跨る項目** | 同一の「項目」セルが page break で分断されていたら 1 行に統合 |
| **セル merge / 親子関係** | 下位細目を items として拾う、上位カテゴリ行 (例: 「飲食」「衣装」) は除外。金額が上位行のみなら親項目を採用 |
| **フッター・脚注項目** | 「諸経費」「事務手数料」「※持ち込み料」「値引き / 割引」も拾う。値引きは **負の amount** で表現 (例: `-50000`) |
| **※印・注釈** | 注釈で金額が示されているものは items に拾い、`unit` / `analysisNote` に注釈の意味を 1 句残す |
| **合計欄** | 「小計 / 中計 / 合計 / 総額 / 税込合計」は **items から除外**、最も信頼できる**税込合計値**を `total` フィールドに 1 つだけ採用 |

## Numeric / Tax / Unit Normalization（B、数値精度）

### 桁・単位
- **3 桁区切りカンマ**: "3,500,000" → 3500000
- **千円単位** (「単位: 千円」「(千円)」表記): その表内の amount / total を **× 1000** して yen 正規化、analysisNote に明記
- **万円単位**: **× 10000** で正規化、同上で明記

### 税込 / 税別 統一 (税込ベースに揃える)
- 「税抜」「(税抜)」「(本体)」表記の行 → サービス料 (10%) + 消費税 (10% / 軽減 8%) を順に乗じて税込換算
- 「税込」「(税込)」表記の行 → そのまま採用
- **「消費税」単独行** (税抜 items の合計に対する 1 行) → **items に入れず**、税込換算で各行に分配
- **サービス料** が単独行で計上されている場合 → items 各行に按分するか `venue_fee` の 1 行として残す (どちらでも可、analysisNote にどちらにしたか明記)

### 税率の判定
- 食事 / 飲料 / 引出物の食品系 → **軽減税率 8%**
- それ以外 → **10%**
- 判定不能なら 10% を採用

### 単価 × 数量
- 「単価 × 数量 = 小計」の行は **小計を amount に採用**
- 小計が表記されていない場合のみ単価 × 数量を計算

### 金額が読めない行
- フォントかすれ / スキャン不鮮明 / OCR 不能 → **items に入れない**
- analysisNote に「N 行は金額不鮮明で抽出から除外」と数だけ残す

## Category Mapping（C、ESTIMATE_PRESETS 55 件と整合）

caller 側 `src/lib/estimate-presets.ts` の 55 件 preset と category が揃うよう、以下を正規写像として使う。**preset に無い項目名でも下記キーワードに当たれば該当 category に寄せる**。

| category | 含まれる典型項目 |
|---|---|
| `cuisine` | 料理 / 飲物 / コース / 牛 / 魚 / 和洋折衷 / ウェディングケーキ / ウェルカムドリンク / デザートビュッフェ / ドリンク / 乾杯酒 |
| `attire` | 新郎衣装 / 新婦衣装 / ドレス / タキシード / 和装 / 色打掛 / 白無垢 / 紋付 / 小物 / 親族衣装 / **ヘアメイク / リハーサルメイク / エステ / 着付け** (ビューティーは attire に寄せる) |
| `flowers` | ブーケ / ブートニア / 装花 / メイン装花 / ゲスト卓装花 / 高砂装花 / ヘッドドレス / リングピロー / 花束贈呈 |
| `photo_video` | 写真 / 映像 / スナップ / 前撮り / 当日撮影 / エンドロール / DVD 編集 / アルバム / 記念写真 |
| `performance` | 司会 / 生演奏 / 弦楽 / ドラ演出 / キャンドルサービス / バルーンリリース / ライスシャワー / ファーストバイト / フラワーシャワー / 入場演出 |
| `av_equipment` | 音響 / 音響設備 / 照明 / 照明演出 / プロジェクター / スクリーン / BGM 選曲 / マイク / モニター |
| `venue_fee` | 会場使用料 / 挙式料 / サービス料 / 控室料 / 介添料 / 親族控室料 |
| `other` | **ペーパー類** (招待状 / 席次表 / 席札 / メニュー / プロフィールブック / サンキューカード) / **引物** (引出物 / 引菓子 / プチギフト / 縁起物) / 宿泊費 / 送迎バス / 諸経費 / 事務手数料 |

### 判定ルール
- 行の itemName を上表のキーワードと部分一致 (substring match) で照合
- 複数 category に当てはまる場合は **より上位** (`cuisine > attire > flowers > photo_video > performance > av_equipment > venue_fee > other`) を優先
- どのキーワードにも該当しない場合は **`other`** + itemName をそのまま保存。**近いカテゴリへ勝手に寄せない** (hallucination 防止)

## Hallucination Guard（D、確証ない → omit / unknown）

### 行の omit
- 金額が読めない / 0 / null しか取れない行 → items に入れない (推測で 100,000 などを埋めない)
- itemName が読み取れない (空 / 不明) 行 → items に入れない
- 何行 omit したかを analysisNote に「N 行は不鮮明で抽出から除外」で明示

### tier
- 「スタンダード」「プレミアム」「最低プラン」のような明示がある場合のみ `standard` / `premium` / `minimum`
- 推測で tier を埋めない。明示なしなら **必ず `"unknown"`**

### quantity / unit
- 推測しない。明示されていない場合は省略 (空文字 / 0 で埋めない)

### predictedFinal の根拠（プロンプト内に明記）

| カテゴリ | upgrade 率 | 典型 +¥ |
|---|---|---|
| 衣装 (Attire) | 62% | +¥200,000-400,000 |
| 料理 (Cuisine) | 65% | +¥150,000-300,000 |
| 写真/映像 (Photo/Video/Endroll) | 50% | +¥200,000-350,000 |
| 装花 (Flowers) | 45% | +¥100,000-250,000 |
| 演出 (Performances) | 40% | +¥50,000-150,000 |
| AV/音響 (AV/Sound) | 30% | +¥30,000-80,000 |

→ analysisNote に「typical upgrade pattern を加味」と 1 句残す

### 合計値整合 (round 3 追加)
- `items` 配列の amount 合計と `total` を比較
- **乖離が 10% を超える場合** は analysisNote に「items 合計と総額に N% 乖離 (税抜/税込ズレ or 抽出漏れ可能性)」と明示
- total は **書面の最も信頼できる税込総額**を採用 (合計の整合性より書面の数字を優先)
- parser が同じ閾値 (10%) で `warnings` 配列に「items 合計 (¥X 万) と total (¥Y 万) で N% の乖離 (items が 超過|不足)」を入れて caller に伝える

### トーン
- 「hidden costs」のような不安を煽る表現は避ける
- 「typical adjustments other couples make」のように **ポジティブにフレーム**

## PII / Sanitize 注意

- 入力は **PDF document-block** であり、自由テキストの prompt injection 経路は固定文 1 行のみ
- ただし PDF 内には **新郎新婦氏名 / 連絡先**が含まれる可能性あり
  - 出力 schema に氏名・連絡先フィールドが無いため**通常は流出しない**
  - `analysisNote` 等の自由文に紛れる余地はあるため、`parseEstimateExtraction` 側で監査ログを残しつつ UI 表示前にレビュー推奨 (P3 課題)
- PDF 自体は private bucket。Anthropic への露出は **55 秒以内** (`PDF_EXTRACT_TIMEOUT_MS = 55_000`) のみ

## Caller

- `src/server/actions/estimate-ai.ts:51-170` — `extractEstimateItems(pdfUrl)`
  - 戻り値 `{ ok: true, data, modelId, warnings: string[] } | { ok: false, error }`
- `src/server/actions/estimates.ts:99-160` — `analyzeEstimatePdf(venueId, formData)` がさらに wrap して UI に返す
  - 戻り値の `warnings` フィールドを通じて UI が「要確認」バッジを出せる (UI 実装は別タスク)
- 呼び方: `getAnthropicClient().messages.create({ model: MODEL.SONNET, max_tokens: 4096, system: ESTIMATE_EXTRACT_SYSTEM_PROMPT, ... }, { signal })`
- **55 秒 hard timeout** (Vercel function 60s 上限の手前)
  - timeout / `AbortError` → ユーザー向けトースト「AI分析が時間内に完了しませんでした」
- billing / credit エラー → 「AI利用枠が一時的に上限に達しました」
- それ以外のエラー → 「AI分析に失敗しました: <message>」
- 戻り値は `{ ok: true, data, modelId, warnings } | { ok: false, error }`（**throw しない**）

## Cache

- caller 側で AI cache **未使用**。同一 PDF の再抽出は毎回 Claude を呼ぶ
  - 理由: 一度抽出して `Estimate` レコード化したらユーザーは編集モードに移る前提。再呼び出しの想定が薄い

## Model 選定理由

- **SONNET 採用**: 一度の操作の精度が直接 `Estimate.items` の信頼性になるため
- 初期に HAIKU を試したが、**「料理単価 × 人数」を flat 金額と誤分類するケースが約 20%** に達したため不採用
- 5,000 万件のレイテンシではなく 1 件の正確性が支配的なユースケース → SONNET が適合
- max 4096 token: 30-50 行の長い見積書を 2048 token で出すと **JSON 配列の途中で truncate → parse 失敗** が再現したため 4096 に拡大

## Update Protocol

1. 本 md を編集（特に Output schema / category マッピング / Coverage / Numeric Rules / upgrade rate 表）
2. 同 PR で `src/lib/prompts/estimate-extract.ts` を同期
3. **schema 変更が必要なら** `src/lib/estimate-ai-parser.ts` の zod schema も同 PR で更新
4. **caller 戻り値の shape を変えるなら** `src/server/actions/estimate-ai.ts` + `src/server/actions/estimates.ts` も同期
5. `last_synced` を更新 + 改訂履歴追記
6. 実 PDF (テキスト型 / 画像型 / 縦書き型 / 列構造型 / 千円単位型 / 税抜混在型) の **少なくとも 2 種**で 1 回スモーク → JSON 全フィールドが parse 成功 + items が妥当な行数 + warnings がふさわしい状況で出る
7. timeout 経路 (大ページ PDF) で「AI分析が時間内に〜」トーストが出ることも 1 回確認
8. PR description に「estimate extract prompt 改定」と明記

## 既知の限界 / 今後の課題

- AI cache 未実装 (同一 PDF を再 upload した時の二重課金リスクあり)
- predictedFinal の upgrade rate 表は **2024 年時点の業界 anecdotal 値**。年次更新が必要
- `analysisNote` の自由文に PII 混入の余地（PDF 内の氏名 / 連絡先）— UI 表示前にスクリーニング機構未整備
- timeout は 55 秒固定。長期的に Vercel function plan が変わったら再調整
- **round 3 後の残課題**:
  - `warnings` を UI 上で「要確認」バッジとして surface する実装 (UI 担当のタスクへ繰越)
  - 税率判定 (8% / 10%) の prompt 指示はソフト制約。caller で「料理 / 飲料行は 1.08、その他は 1.10」を post-process で再計算する仕組みは未実装
  - PDF サンプル fixture (税抜混在 / 千円単位 / 値引き行付き / multi-page 跨ぎ) の追加は未実施 (実 PDF が test repo に置けない事情あり、合成 fixture で代替検討)

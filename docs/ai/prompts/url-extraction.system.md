---
name: url-extraction.system
pairs_with: src/lib/prompts/url-extraction.ts
model: claude-haiku-4-5-20251001
maxTokens: 4096
last_synced: 2026-05-02
---

# URL Extraction Prompt — 仕様

「URL を貼って式場登録」のメイン抽出 prompt。複数の関連サブページ (DETAIL / PHOTOS / REVIEWS / PLANS) を横断して **構造化フィールド + 口コミ + テーマクラスタ**を抽出する。

> 2026-05-02 — Phase 2.A round 2 で **`src/lib/prompts/url-extraction.ts` に切り出し済**。caller (`src/server/actions/venues.ts`) は import 経由で参照。inline 配置時代の md (round 1) はそのまま正本として継続使用。

## Persona / Role

- 役名: 日本のウェディング会場 web ページからの構造化抽出エキスパート
- 役割: 複数サブページの **HTML テキスト + JSON-LD + OGP** を読み、定義済みスキーマに沿って **valid JSON のみ**を返す
- スタンス: 推測しない。null / 空配列 / "low" confidence で**素直に欠損を伝える**

## Input (User Message)

caller `src/server/actions/venues.ts:1300-1302`:

```
以下は同じ結婚式場の複数ページを連結した内容です。重複はまとめ、可能な限り情報を抽出してください。

=== DETAIL (<url>) ===
<text>

=== PHOTOS (<url>) ===
<text>

=== REVIEWS (<url>, merged <N> pages) ===
<merged review text, max 12,000 char>

=== PLANS (<url>) ===
<text>
```

各セクションは caller 側で **長さ別に独立切り詰め**。REVIEWS は最大 12,000 字。

## Output (JSON Shape)

中核フィールド + Extra deep-extraction フィールドを含む。**`prisma/schema.prisma` の Venue / VenueReview / VenueReviewCluster と直接対応**。

主要中核:

```json
{
  "name": "<venue name in Japanese>",
  "location": "<area/address>",
  "accessInfo": "<nearest station and walking time>",
  "capacityMin": <number | null>,
  "capacityMax": <number | null>,
  "ceremonyStyles": ["チャペル"|"神前"|"人前"|"ガーデン"],
  "estimatedPrice": <yen | null>,
  "features": ["<short label>", ...],
  "photoUrls": ["<url1>", ... up to 20],
  "confidence": "high"|"medium"|"low",
  "costMin": <yen | null>,
  "costMax": <yen | null>,
  "paymentMethodEnums": ["credit_card"|"cash"|"bank_transfer"|"installment"],
  "dressBringIn": "allowed"|"not_allowed"|"negotiable"|null,
  "dressBringInFee": <yen | null>,
  "maxInstallments": <number | null>,
  "vibeTags": ["natural_light"|"garden"|"glass"|"private_floor"|"historic"|"rooftop"|"chapel"|"riverside"|"modern"|"classical"],
  "reviews": [
    { "title": "<headline | null>", "body": "<200-500 字要約>", "rating": <1-5 | null>, "author": "<handle | null>", "visitedAt": "<e.g. 2024年5月 | null>" }
  ],
  "reviewClusters": {
    "positive": [{ "theme": "<≤20字>", "summary": "<60-120字>", "count": <int> }],
    "negative": [{ "theme": "<≤20字>", "summary": "<60-120字>", "count": <int> }]
  }
}
```

Extra (optional, null / [] 許容):

```
hasParking, parkingCapacity, hasShuttle, hasAccommodation,
acceptsSecondParty, barrierFree, ceremonyFeeExact,
productionFeeMin / Max, serviceFeeRate, operatingHours,
closedDays[], cuisineTypes[], chefCredentials
```

詳細セマンティクスは `URL_EXTRACTION_SYSTEM_PROMPT` 本体の Guidelines セクション参照（venues.ts:922-948）。

## Extraction Rules（要点）

### 数値変換
- 「300 万円」→ 3000000 (yen 整数)
- 「サービス料 10%」→ `serviceFeeRate: 0.1`
- 「+80 万円」(レビュー側はこのファイルでは扱わない / review-summary 側)
- 単一数値しかなければ `costMin = costMax`

### 日本語 → enum マッピング
- ceremonyStyles: チャペル / 神前 / 人前 / ガーデン (4 値)
- paymentMethodEnums: クレカ→credit_card / 現金→cash / 銀振→bank_transfer / 分割・ローン→installment
- dressBringIn: 持ち込み可→allowed / 不可→not_allowed / 要相談・応相談→negotiable
- closedDays: monday..sunday + irregular。"火・水定休" → ["tuesday","wednesday"]
- cuisineTypes: フレンチ/和食(=懐石/日本料理)/イタリアン/中華/フュージョン(=折衷)/ビュッフェ(=ブッフェ)
- vibeTags: 写真説明 + 本文から **明確に当てはまるものだけ** 最大 5 個

### 写真
- ヒーロー級 (会場・チャペル・披露宴) を優先
- サムネ / アイコン / アバター / マーケティングバナー除外
- **絶対 URL のみ**

### Reviews（口コミ抽出）
- ページ上の口コミを **最大 20 件まで** 拾う（少ないより多い方がよい）
- 必ず Japanese で **200-500 字に要約**。原文長文コピペ禁止
- 出典 URL は caller 側で付与するため不要
- 重複は 1 件にまとめる
- author は **ハンドル名のみ**。本名 / 電話など PII を含めない

### Review Clusters
- REVIEWS セクション全体（複数ページ生テキスト）を読み、positive / negative テーマを **5-12 個ずつ**にクラスタ
- 同じ話 (例: 「チャペルの光が綺麗」) は 1 テーマに集約
- 各 summary は 60-120 字 plain text、theme は **20 字以内・具体的に**（「良い」「悪い」のような粗い粒度は禁止）
- count は該当しそうな件数の概算（0 にしない）
- レビュー ≤5 件 / 見つからない場合は positive / negative どちらも空配列でよい

### JSON-LD 重複回避
- aggregateRating value/count、GeoCoordinates lat/lng、PostalAddress postalCode/streetAddress、telephone は **別の structured parser が拾う**
- これらフィールドは **本 prompt から出力しない**（推測も書き換えも禁止）

### SPA / OGP / JSON-LD の優先
- ゼクシィ等の SPA は body が空でも OGP / JSON-LD に主要フィールドが入る
- name / address / image / telephone / geo / review / aggregateRating は OGP / JSON-LD を **primary source** として扱う

## PII / Sanitize 注意

- 入力テキストは **外部 web ページの生 HTML テキスト** → prompt injection の主要経路
- caller 側で `<script>` / `<style>` / タグ全部除去 + 連続空白圧縮 (`reviews.ts` 同様)
- `stripPII` は **未実行**（venues.ts には適用なし）。外部ページに含まれる電話番号等はそのまま流入
  - prompt 側で「author はハンドル名のみ・本名や電話番号など PII を含めるな」と明記して防御
- 出力 `reviews[].body` は要約された日本語のため、原文 PII は構造的に紛れにくいが**完全保証はない**

## Caller

- `src/server/actions/venues.ts:1316-1329` — `addVenueFromUrl` 内
- 呼び方: `askClaude(URL_EXTRACTION_SYSTEM_PROMPT, prompt, { maxTokens: 4096 })`
  - **legacy `src/lib/claude.ts` 経由**（new `src/lib/anthropic.ts` の object 引数版とは別）
  - default model = `MODEL.HAIKU`
- Claude が null / parse 失敗した場合は **JSON-LD + OGP fallback** (`buildFallbackExtracted`) を試行

## Cache

- `aiCache` (`computeInputHash`) で永続キャッシュ
- `inputHash`: `JSON.stringify({ system, user })` の sha256 16 字
- ヒット時はキャッシュ済み応答を再利用。miss 時のみ Claude を呼び保存
- 保存時 model id を `"claude-haiku-4-5-20251001"` で記録

## Model 選定理由

- **HAIKU 採用**: フィールド数 30+ の構造化抽出だが、ルール (enum / 数値変換 / null 判定) が明示的なため Haiku で十分達成
- SONNET 検討した時期もあったが、コスト 3 倍に対する精度向上は限定的（cache の hit 率も高い）
- max 4096 token: reviews 最大 20 件 + reviewClusters (positive / negative 最大 12 個) + 中核フィールドで 2048 では truncate していた

## Update Protocol

1. 本 md を編集（特に Output schema / enum 一覧）
2. 同 PR で `src/server/actions/venues.ts` の `URL_EXTRACTION_SYSTEM_PROMPT` を同期
3. `last_synced` を更新
4. ゼクシィ・みんなのウェディング等の **実在公開 URL** で 1 回スモーク → Venue 登録成功 + reviews / clusters 充填
5. SPA (body 空) ページでも JSON-LD fallback or AI 抽出で minimum 情報が取れることを確認
6. PR description に「URL extraction prompt 改定」と明記

## 既知の限界 / 今後の課題

- **inline 配置**: モジュール化されていない (`src/server/actions/venues.ts` 内に直書き)。`src/lib/prompts/url-extraction.ts` への切り出しは Phase 2 D 残
- 入力テキストに `stripPII` 未適用（外部 web 由来 PII が prompt / cache に乗りうる）
- Output schema が **大きすぎる**（中核 + Extra で 30+ フィールド）。zod 検証の網羅性は caller 側 (`venues.ts` schema) の保守次第
- reviewClusters の count は概算。**集計値としての厳密性なし**（UI 側は表示のみ、計算根拠にしない）

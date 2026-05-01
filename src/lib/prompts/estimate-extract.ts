/**
 * Estimate extract prompt — Claude document-block API target for parsing
 * Japanese wedding-venue 見積書 PDFs into structured EstimateItems.
 *
 * Spec / pairs_with: docs/ai/prompts/estimate-extract.system.md
 *
 * History:
 *  - until 2026-05-02: lived inline inside estimate-ai.ts
 *  - 2026-05-02 round 2: extracted to this file (no semantic change)
 *  - 2026-05-02 round 3 (this revision): precision tuning — coverage rules
 *    for multi-page / merged cells / footer items, numeric rules for
 *    税込/税別 + 千円単位 normalization, category mapping expanded to cover
 *    the 55-entry ESTIMATE_PRESETS surface, hallucination guard tightened
 *    so uncertain rows must be omitted (not guessed) and item-sum vs total
 *    discrepancies must be reported in analysisNote.
 *
 * The caller (`extractEstimateItems` in src/server/actions/estimate-ai.ts)
 * supplies a signed PDF URL via document-block; this system string is the
 * one that converts the columnar 項目/単価/数量/小計 layout into JSON.
 */
export const ESTIMATE_EXTRACT_SYSTEM_PROMPT = `You extract structured data from Japanese wedding venue estimates (見積書) in PDF form. Output discipline: precision over coverage, omit when uncertain rather than guess.

Return ONLY valid JSON (no markdown, no code fences, no preamble). Shape:
{
  "total": <number, **税込 grand total** in yen, integer>,
  "items": [
    {
      "category": "attire" | "cuisine" | "photo_video" | "flowers" | "performance" | "av_equipment" | "venue_fee" | "other",
      "itemName": "<item name in Japanese, concise, the document's own wording>",
      "amount": <number, line subtotal in yen, integer, **already 税込 normalized** when possible>,
      "unit": "<optional unit like 名/卓/式/着 — omit or use empty string if not stated>",
      "quantity": <optional number of units — omit if not stated>,
      "tier": "minimum" | "standard" | "premium" | "unknown"
    }
  ],
  "predictedFinal": <number, predicted final cost after typical upgrades, integer>,
  "analysisNote": "<brief Japanese note: prediction reasoning + any extraction caveats (税込/税抜きの扱い、抽出から除外した行、合計乖離 など), 1-3 sentences>"
}

================================================================
## A. Coverage rules (read EVERY row, don't miss the layout edges)
================================================================

- **複数ページに跨る項目**: 同一の「項目」セルが page break で分断されていたら **1 行に統合**して扱う。同じ itemName が連続した場合は合算ではなく出現順で取り扱い、quantity 列が継続している場合のみ合算。
- **セル merge / 親子関係**: 表セルが merge されている (上位カテゴリ行 + 下位細目行) 場合、**下位細目を items として拾う**。上位カテゴリ行 (例: 「飲食」「衣装」) 自体は items に入れない。金額が上位行にしか書かれていない場合のみ親項目を採用。
- **フッター・脚注項目**: ページ末尾の「諸経費」「事務手数料」「※持ち込み料」「値引き」「割引」も拾う。値引きは **負の amount で表現** (例: amount に -50000 を入れる)。
- **※印・注釈**: 「※○○名分含む」「※○月以降は別料金」のような注釈で金額が示されているものは items に拾い、unit か analysisNote に注釈の意味を 1 句で残す。
- **合計欄は items に入れない**: 「小計」「中計」「合計」「総額」「税込合計」は **items から除外** し、最も信頼できる税込合計値を **\`total\` フィールドに 1 つだけ採用**。複数の合計表記がある場合 (税抜小計 / 消費税 / 税込合計) は **税込合計を選ぶ**。

================================================================
## B. Numeric / tax / unit normalization (precision)
================================================================

- **3 桁区切りカンマ**: "3,500,000" → 3500000。カンマは桁区切りで小数点ではない (日本式)。
- **「千円単位」表記**: 表のヘッダや注記に「単位: 千円」「(千円)」とある場合、その表内の amount / total を **× 1000 して yen に正規化**。analysisNote に「千円単位列を yen に正規化」と 1 句残す。
- **「万円単位」表記**: 「単位: 万円」「(万円)」とある場合は **× 10000 で正規化**。同上で analysisNote に明記。
- **税込 / 税別 混在**: 行ごとに 税込 / 税別 の表記が混在することがある。**全行を税込ベースに揃える**:
  - 「税抜」「(税抜)」「(本体)」表記の行は、サービス料 (10%) + 消費税 (10% / 軽減 8%) を順に乗じて税込換算 (見積書の規定に従う、不明なら 10% 消費税のみ)
  - 「税込」「(税込)」表記の行はそのまま採用
  - 「消費税」単独行 (税抜 items の合計に対する 1 行) は **items に入れず**、税込換算で各行に分配
  - サービス料も同様: 「サービス料 10%」が単独行で計上されている場合 → items 各行に按分するか、venue_fee カテゴリの 1 行として残す (どちらでも可、analysisNote にどちらにしたか明記)
- **税率の判定**: 食事 / 飲料 / 引出物の食品系は軽減税率 8%、それ以外は 10%。判定不能なら 10% を採用。
- **単価 × 数量**: 「単価 × 数量 = 小計」の行は、**小計を amount に採用**。小計が表記されていない場合のみ単価 × 数量を計算 (amount = unitPrice * quantity)。
- **金額が読めない行**: フォントかすれ / スキャン不鮮明 / OCR 不能 で金額が読めない行は **items に入れない**。代わりに analysisNote に「N 行は金額不鮮明で抽出から除外」と数だけ残す。

================================================================
## C. Category mapping (ESTIMATE_PRESETS と整合)
================================================================

caller 側 \`src/lib/estimate-presets.ts\` の 55 件 preset と category が揃うように、以下を正規写像として使う。**preset に無い項目名でも下記キーワードに当たれば該当 category に寄せる**。

| category | 含まれる典型項目 |
|---|---|
| **cuisine** | 料理 / 飲物 / コース / 牛 / 魚 / 和洋折衷 / ウェディングケーキ / ウェルカムドリンク / デザートビュッフェ / ドリンク / 乾杯酒 |
| **attire** | 新郎衣装 / 新婦衣装 / ドレス / タキシード / 和装 / 色打掛 / 白無垢 / 紋付 / 小物 / 親族衣装 / **ヘアメイク / リハーサルメイク / エステ / 着付け** (ビューティーは attire に寄せる) |
| **flowers** | ブーケ / ブートニア / 装花 / メイン装花 / ゲスト卓装花 / 高砂装花 / ヘッドドレス / リングピロー / 花束贈呈 |
| **photo_video** | 写真 / 映像 / スナップ / 前撮り / 当日撮影 / エンドロール / DVD 編集 / アルバム / 記念写真 |
| **performance** | 司会 / 生演奏 / 弦楽 / ドラ演出 / キャンドルサービス / バルーンリリース / ライスシャワー / ファーストバイト / フラワーシャワー / 入場演出 |
| **av_equipment** | 音響 / 音響設備 / 照明 / 照明演出 / プロジェクター / スクリーン / BGM 選曲 / マイク / モニター |
| **venue_fee** | 会場使用料 / 挙式料 / サービス料 / 控室料 / 介添料 / 親族控室料 |
| **other** | **ペーパー類** (招待状 / 席次表 / 席札 / メニュー / プロフィールブック / サンキューカード) / **引物** (引出物 / 引菓子 / プチギフト / 縁起物) / 宿泊費 / 送迎バス / 諸経費 / 事務手数料 |

**判定ルール**:
- 行の itemName を上表のキーワードと部分一致 (substring match) で照合
- 複数 category に当てはまる場合は **より上位 (cuisine > attire > flowers > photo_video > performance > av_equipment > venue_fee > other) を優先**
- どのキーワードにも該当しない場合は **\`other\` を選び、itemName をそのまま保存**。**近いカテゴリへ勝手に寄せない** (hallucination 防止)

================================================================
## D. Hallucination guard (確証ない → omit / unknown)
================================================================

- **行の omit**:
  - 金額が読めない、または 0 / null しか取れない行は items に入れない (推測で 100,000 などを埋めない)
  - itemName が読み取れない (空 / 不明) 行も入れない
  - 何行 omit したかを analysisNote に「N 行は不鮮明で抽出から除外」で明示
- **tier**:
  - 「スタンダード」「プレミアム」「最低プラン」のような明示がある場合のみ \`standard\` / \`premium\` / \`minimum\`
  - 推測で tier を埋めない。明示なしなら **必ず \`"unknown"\`**
- **quantity / unit**:
  - 推測しない。明示されていない場合は省略 (空文字 / 0 で埋めない)
- **predictedFinal の根拠** (Japanese wedding estimate upgrade patterns):
  - Attire (dress, tuxedo): 62% upgrade rate, typical +¥200,000-400,000
  - Cuisine (course upgrade): 65% upgrade rate, typical +¥150,000-300,000
  - Photo/Video/Endroll: 50% upgrade rate, typical +¥200,000-350,000
  - Flowers/Table decor: 45% upgrade rate, typical +¥100,000-250,000
  - Performances/Effects: 40% upgrade rate, typical +¥50,000-150,000
  - AV/Sound equipment: 30% upgrade rate, typical +¥30,000-80,000
  - これらは **書面情報ではなく統計的予測**。analysisNote に「typical upgrade pattern を加味」と 1 句残す。
- **合計値整合**:
  - \`items\` 配列の amount 合計と \`total\` を比較
  - **乖離が 10% を超える場合** は analysisNote に「items 合計と総額に N% 乖離 (税抜/税込ズレ or 抽出漏れ可能性)」と明示。total は **書面の最も信頼できる税込総額**を採用 (合計の整合性より書面の数字を優先)
- **トーン**: 「hidden costs」のような不安を煽る表現は避け、「typical adjustments other couples make」のように **ポジティブにフレーム**

================================================================
## E. Examples
================================================================

### 例 1: 千円単位列 + 税抜混在
入力: 表ヘッダ「(単位: 千円, 税抜)」、料理 12,000 / 80 名 = 960、装花 250、サービス料 121、消費税 133

→ 出力 items (yen, 税込換算):
- cuisine 「料理」 amount=1,160,000 (960 × 1000 = 960,000 × 1.10 = 1,056,000... 但し料理は軽減税率 8% なら 1,036,800、判定不能なら 10% で 1,056,000) — analysisNote に「千円単位列を yen + 税込換算」記載
- flowers 「装花」 amount=275,000 (250 × 1000 × 1.10)
- venue_fee 「サービス料」 amount=133,100 (121 × 1000 × 1.10)
- 「消費税」単独行は **items に入れない** (各行に分配済)
- total = 税込総額 1,568,100 (見積書の税込総額表記をそのまま)

### 例 2: 値引き行
入力: 「ご祝儀値引き -50,000」

→ items に 1 行: \`{ category: "other", itemName: "ご祝儀値引き", amount: -50000, tier: "unknown" }\`

### 例 3: 不鮮明行
入力: 「[読めない] [読めない] [読めない]」が 2 行

→ items に入れない。analysisNote に「2 行は不鮮明で抽出から除外」追記。`;

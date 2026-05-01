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

## 改訂履歴

- 2026-05-02 — Phase 2.A 口コミ要約品質改善。**Source filtering (広告コピー / モニター / astroturfing / 個人攻撃の検出と除外)** / **Bride・Groom perspective coverage (体験・装い軸 と 実務・予算軸 の両方を strengths/concerns に最低 1 件ずつ)** / **Concerns の actionable 化 (`懸念 → 見学・契約時の確認アクション` 形式)** / **PII guardrail (個人名・スタッフ名は役職表現に置換)** / summary 上限を 200→220 字 に拡大 (3 段構成収納のため)
- 2026-04-17 — 初版 (md 化、初回正本化)

## Persona / Role

- 役名: 日本のウェディング会場レビュー分析エキスパート
- 役割: ある式場の口コミテキスト群を読み、**バランスの取れたバイアスフリーで行動に繋がる要約 + 6 軸 sentiment + 推奨スコア + 見積もり乖離指標**を返す
- スタンス: 個別の口コミを引用せず**パターンとして要約する**。批判もコンストラクティブに。**マーケコピーではなく意思決定支援**。

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
  "summary": "<overall summary in Japanese, 150-220 chars>",
  "sentiment": {
    "atmosphere": <-1.0 to 1.0>, "hospitality": <-1.0 to 1.0>,
    "cuisine": <-1.0 to 1.0>, "cost": <-1.0 to 1.0>,
    "access": <-1.0 to 1.0>, "overall": <-1.0 to 1.0>
  },
  "strengths": ["<top 3 positives in Japanese>"],
  "concerns": ["<top 3 concerns in Japanese, '懸念 → 確認アクション' 形式>"],
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
schema は **2026-04-17 版から不変**。caller `src/server/actions/reviews.ts` の `ReviewSummary` 型と同期。`summary` 上限のみ 200→220 字に拡大した（3 段構成のスペース確保）。

## Source Filtering（要約前のバイアス除外・2026-05-02 追加・最重要）

入力コーパスは noisy で混在前提。strengths / concerns 抽出 **前に** 以下を除外 / 重み下げする。

| パターン | 検出シグナル | 扱い |
|---|---|---|
| **公式コピー / 広告ブラブ** | 「至福のひととき」「最高のホスピタリティ」「夢のような一日」など 具体性ゼロの絶賛フレーズ | **strengths に採用しない**。具体物 (光・料理品名・スタッフ動作・進行モーメント) が伴わない絶賛は site copy / canned PR の可能性 |
| **モニター / PR 案件** | 「モニター招待で〜」「特別ご招待で〜」、5 ★ 一色で欠点ゼロ、近似ワーディングの複数件 | **重み下げ**。strengths として採用するなら他に独立した裏付けがあるときのみ |
| **Astroturfing** | 「絶対」「最高」「神」「圧倒的」連発で具体観察 0 件、複数レビューで同じレア表現が逐語一致 | **low-trust** 扱い。concerns 側でも同様にチェック (組織的中傷の可能性) |
| **個人攻撃** | 特定スタッフ名・担当プランナー名を名指しした罵り文 (「○○プランナーは最悪」) | **そのまま concerns に出さない**。複数の独立した声で同種パターンが見えるなら、venue-level の一般化に翻訳 (例:「担当プランナーの引継ぎが弱いと感じた声がある」) |

## Bride / Groom Perspective Coverage（2026-05-02 追加）

カップルが意思決定で気にする観点は典型的に 2 クラスタに分かれる。**summary / strengths / concerns は両クラスタをカバーしなければならない**。

| クラスタ | 典型的な観察対象 |
|---|---|
| **体験・装い軸** (一般に新婦側が重視しがち) | ドレス・衣装、ヘアメイク、装花、料理の見た目・品数、写真映像、雰囲気・装飾、スタッフのきめ細かさ |
| **実務・予算軸** (一般に新郎側が重視しがち) | 総額・自己負担、見積もり追加 / 追加費用パターン、進行管理、引出物、設備（音響/照明/控室）、アクセス、契約条件・キャンセル規定 |

### ルール

- **strengths 上位 3 件には両クラスタの観点をそれぞれ最低 1 件**含める。3 件全てが同じクラスタに偏ったら作り直す
- **concerns 上位 3 件も同様に両クラスタを最低 1 件ずつ**。両軸とも目立った懸念がない場合のみ片寄ってよい（理由を summary に明示）
- **観点ラベル (「体験」「実務」等) は出力文字列に含めない**。判定基準として内部で使うのみ（UI 文字列を汚さない）

### この設計判断について

「妻 / 夫」というジェンダー固定分類ではなく、**典型的に分かれがちな関心軸**としての 2 クラスタ分類。同性カップル / 役割が逆 / 一人で見ている場合もカバーするための中立化。タスク要件の「妻と夫それぞれの観点」は本質的に **カップルが分担しがちな関心軸の両方カバー** と解釈した。

## Output Style

| 観点 | ルール |
|---|---|
| concerns の form | 全件「<懸念> → <見学・契約時の確認アクション>」型。動詞で終わるアクション必須 |
| strengths の form | 「素敵」「最高」のような誇大表現を避け、**具体物**（自然光・料理品名・スタッフの動きの具体例）を含める |
| 引用 | 原文丸写し禁止。**パターン要約**のみ |
| 件数依存 | 1 件しか出てこない強い意見は採用しない（件数 N に依存させる） |
| 個人名 | スタッフ名・シェフ名・プランナー名は伏せて役職表現に置換（「担当プランナー」「シェフ」） |
| 冒頭句 | 「会場を実際に見学された方の評価」のように一般化（個人レビューを引用しない） |

### concerns の例（before / after）

| ❌ 避ける | ✅ 推奨 |
|---|---|
| 「料理が冷めていた」 | 「料理が冷めて出てくることがあったとの声 → 試食会で配膳タイミングを確認」 |
| 「装花がイメージと違った」 | 「装花が当初イメージから +30 万円に膨らんだ声 → 装花パッケージの含有量と差額表を契約前に確認」 |
| 「○○プランナーが最悪」 | 「担当プランナーの引継ぎが弱いと感じた声がある → 担当変更の有無と最終確定担当を契約前に確認」 |

## summary の構成（150-220 字、緩く 3 段）

1. **総評 1 文** (口コミ全体の傾向)
2. **体験・装い軸 と 実務・予算軸 のそれぞれ目立つ観点** を 1-2 個ずつ
3. **判断のヒント 1 文** (「見学時に〜を確認すると判断しやすい」型のアクション/pivot)

## estimateIncrease 抽出ルール

- 「見積もり」「最終金額」「追加費用」「+◯◯万円」等のキーワードがある時のみ埋める
- "初期見積もり" / "最初の見積もり" → `initial`、"最終金額" / "実際の金額" → `final`
- delta だけ言及されている場合 ("+80 万円上がった" / "20% アップ") は `deltaYen` / `deltaPct` を直接埋める
- **万円単位の換算**: 1 万 = 10000 yen。"+80 万円" → `deltaYen: 800000`
- `confidence`:
  - `high`: 具体数字が引用されている
  - `medium`: 概算
  - `low`: 定性的記述のみ ("高くなった") / 単発の極端値 (1 件だけの "+200 万")
- 価格言及が全く無いときは `estimateIncrease` object ごと省略 (or 全フィールド undefined)
- **単発の極端値は note にその旨明記** + `confidence: "low"` に下げる（2026-05-02 追加）

## 不確実性の扱い（2026-05-02 追加）

- 母数 ≤5 件程度なら summary に「○件の声に基づく傾向で、母数は限定的です」を 1 句添える
- 賛否が分かれる軸は **どちらかに倒さない**: 「料理は『品数が多い』とする声がある一方、『テンプレ的でこの式場ならでは感が薄い』とする声もある」のように両論を残す

## PII / Sanitize 注意

- caller (`src/server/actions/reviews.ts:294`) で `stripPII(textContent)` を **呼び出し前に必ず実行**
  - email / 電話番号 / 郵便番号 / 「〇〇様/さん/くん/ちゃん」を `[REDACTED]` に置換
- 「原文丸写し禁止」を prompt 側でも明記しているが、**最終防衛は stripPII**
- **2026-05-02 追加**: prompt 側で「個人名・スタッフ名・シェフ名・プランナー名は伏せて役職表現に置換」を明示
- 出力に PII は含まれない設計（要約のみ）

## Caller

- `src/server/actions/reviews.ts:300-308` — 口コミ要約フロー
- 呼び方: `withRetry(() => askClaude({ system, userMessage }))`（cache miss 時のみ）
- code fence + 余分な前置き除去 (`stripJsonResponse`) → JSON.parse → schema check
- 結果は `categorySummary.positiveHighlights = result.strengths`、`negativeHighlights = result.concerns`、`overall = result.summary` として DB に保存

## Cache

- `aiCache` テーブル (`computeInputHash` ベース) で永続キャッシュ
- `inputHash`: `JSON.stringify({ system, user })` の sha256 16 字
- ヒット時は API call スキップ。miss 時は AI 応答を `setCachedResponse(hash, response, "claude-haiku-4-5-20251001")` で保存
  - **2026-05-02 改訂で system 文字列が変わったので、既存 cache hash は自動的に miss → 新 prompt 経路に切り替わる**
  - cache 列の model 名は監査メタデータのみで再呼び出しに影響しない (整合性は要レビュー、P3)

## Model 選定理由

- **SONNET 採用**: 6 軸 sentiment + 価格 delta 抽出 + バイアスフリー判定 + 両クラスタカバレッジは精度が直接ユーザーの判断材料になるため
- HAIKU は estimateIncrease の数字抽出 (特に "+80万" → 800000) のミスが目立ち、加えて広告コピー検出 / 個人攻撃の中立化のような **判断系タスク**でも品質が落ちるため不採用
- max 2048 token: summary 220 字 + strengths/concerns 6 件 + 6 軸 sentiment + 6 軸 score + estimateIncrease で収まる範囲（実測 1700-1900 字程度）

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/review-summary.ts` を同期 (system / buildUserMessage / model / maxTokens)
3. `last_synced` を更新 + **改訂履歴** に追記
4. 式場詳細から「口コミを取り込む」フローを 1 回スモーク → JSON 全フィールドが埋まる or 想定通り省略されることを確認
5. **strengths / concerns に体験・装い軸 と 実務・予算軸 が両方含まれているか** を目視確認
6. **concerns 全件が「懸念 → 確認アクション」形式** になっているか目視確認
7. estimateIncrease を含むレビューと含まないレビューの両方で確認
8. PR description に「review-summary prompt 改定」と明記

## 既知の限界

- 50,000 char で truncate しているため、**多レビューの式場では末尾が落ちる**（現状は単純切り取り、重要度ソート未実装）
- caller 側のキャッシュ書き込み時の model id 文字列が実際のモデル ID と一致していない (`"claude-haiku-4-5-20251001"` 固定) — メタデータの整合性は P3 で修正
- `suggestedScores` の妥当性検証は caller 未実装 (1-5 範囲は信頼)
- **2026-05-02**: 両クラスタカバレッジ / actionable concerns は prompt 指示によるソフト制約。caller 側で「両クラスタ含有チェック」「動詞で終わるアクション句チェック」は未実装。違反時の retry / fallback もなし
- **2026-05-02**: 既存 DB に保存済みの `aiSummary` / `categorySummary.negativeHighlights` は **古い prompt の出力**のまま。再分析を促す UI ボタン (`analyzeVenueReviews` 再実行) は別途必要

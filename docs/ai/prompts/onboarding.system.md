---
name: onboarding.system
pairs_with: src/lib/prompts/onboarding.ts
model: claude-sonnet-4-6
maxTokens: 2048
last_synced: 2026-05-02
---

# Onboarding Recommendation Prompt — 仕様

オンボーディング初回フローで「3 件の式場を提案する」生成 prompt の正本。
新規ユーザーが最初に目にする AI 出力 = **第一印象を決める**ため、提案精度と「なぜこの 3 件か」の説明力が最重要。
`src/lib/prompts/onboarding.ts` の `ONBOARDING_RECOMMENDATION_PROMPT.system` と必ず同期する。

## 改訂履歴

- **2026-05-02 round 2** — Phase 2.A 終盤 / Phase 2.B 入口。新規ユーザー第一印象の精度向上:
  - **A. Decision-driver inference**: 4 つの input (style + guestCount + area + budget) の組合せから「親族中心 / ふたり中心 / デザイン感性 / 大規模ハイクオリティ / typical」の 5 分類を internal で推測し、各 reason 冒頭に 1 句で示す
  - **B. Budget-aligned diversity**: 旧「ラグジュアリー/ミドル/バリュー」固定 3 段 → **カップルの予算範囲内で 3 段に散らす** (上限を超えない strict matching)
  - **C. Area inference**: area 未入力時に guestCount + budget + style から地域候補を honest 推論。判定不能なら「首都圏代表 + advice に明示」
  - **D. Diversity**: 「3 件すべて同タイプ (同系列ホテル / 徒歩 5 分以内) は避ける」を明示
  - **E. Honest uncertainty**: 条件 3 つ以上未入力時の advice 文言、decision-driver 判定不能時の reason 冒頭句、訓練データの cutoff 限界 (閉店/移転/新規開業) の取扱
  - **F. rationale.note**: VenueRationale に optional `note: string` を追加 (1 行 30-60 字、「なぜこの 1 件を 3 件目に選んだか」を書く)
  - **Schema 同期**: `VenueRationale.note?: string` (optional, backwards-compatible) を `onboarding-types.ts` に追加
  - **Cache buster**: `ONBOARDING_REC_PROMPT_VERSION` を 1 → 2 に bump (旧 prompt 生成の cache row を miss させる)
- 2026-05-02 round 1 — md 化 (初回正本化)

## Persona / Role

- 役名: 日本のウェディング会場アドバイザー (knowledgeable Japanese wedding venue advisor)
- 役割: ユーザー入力 4 条件から、ふたりに最も合う **実在の式場 3 件** を提案。AI 第一印象の品質責任者
- スタンス: 「売る」のではなく「ふたりに合う候補を並べる」。**条件と無関係に 3 段散らさない、予算内で散らす**

## Input (User Message)

`buildUserMessage(conditions)` で生成。形式は固定:

```
以下の条件で結婚式場を3件おすすめしてください:
- 希望スタイル: <style[].join(", ") | "特になし">
- ゲスト人数: <guestCount | "未定">名
- エリア: <area[].join(", ") | "特になし">
- 予算: <"min〜max万円" | "特になし">
```

`exclusionNote` (caller 側で生成) が末尾に追加されることがある:

```
注意: 以下の式場は既に登録済みなので、それ以外をおすすめしてください: <name1>、<name2>...
```

## Output (JSON Shape)

```json
{
  "recommendations": [
    {
      "name": "<venue name>",
      "location": "<area>",
      "reason": "<2-3 sentence reason in Japanese — must reference inputs>",
      "estimatedPrice": <number | null, in yen>,
      "ceremonyStyles": ["<style>"],
      "strengths": ["<2-3 strengths, concrete>"],
      "rationale": {
        "area_match": <true|false>,
        "budget_match": <true|false>,
        "style_match": <true|false>,
        "note": "<one-line: なぜこの 1 件を 3 件目に選んだか>"
      }
    }
  ],
  "advice": "<1-2 sentence general advice in Japanese — honest about uncertainty>"
}
```

`recommendations` は厳密に 3 件。**round 2** で reason は 1-2 sentence → 2-3 sentence に拡大、rationale に `note` 追加、advice は 1 sentence → 1-2 sentence に拡大 (uncertainty 表現のため)。

## A. Decision-Driver Inference（個別化深化、round 2 追加）

| 入力パターン | 推測される decision-driver |
|---|---|
| guestCount ≥ 80 + 神前 / 和装含む / budget ≥ 350 万 | **親族中心の格式重視**: ホテル和洋室 / 神社併設 / 親族控室の充実を強調 |
| guestCount ≤ 50 + ガーデン / レストラン / budget ≤ 300 万 | **ふたり中心の親密度**: 一棟貸し / 邸宅型 / 料理重視レストラン |
| guestCount 60-100 + チャペル / 表参道・青山・恵比寿 / budget 350-500 万 | **デザイン感性 + 友人中心**: 建築美 / 自然光 / 写真映え |
| guestCount ≥ 100 + ホテル / budget ≥ 450 万 | **大規模 + ハイクオリティ**: ホテル系列 / 設備充実 / 親族宿泊提携 |
| 上記いずれにも当てはまらない (条件少 / 中庸) | **typical な提案**: 各価格帯代表会場、reason に明示 |

判定はソフト。複数パターン該当時は specific style 指定 > 数値 > area > budget の順で優先。reason 冒頭で **どの decision-driver を見ているか 1 句**示す。

## B. Budget-Aligned Diversity（予算範囲内で 3 段散らす）

| 入力 budget | 3 件の estimatedPrice 配置 |
|---|---|
| 200 万以下 | 150-200 / 180-200 / 200 万付近 (全件 budget 上限以内) |
| 200-300 万 | 230 / 270 / 290 万付近 |
| 300-400 万 | 320 / 370 / 400 万付近 |
| 400-500 万 | 420 / 460 / 490 万付近 |
| 500 万以上 | 500 / 600 / 700 万 + (上限なし) |
| budget 未入力 | 250 / 350 / 450 万 (典型 3 段) |

**1 件たりとも budget 上限を超えない** (`rationale.budget_match=true` を維持)。500 万以上だけ upper-bound なし。

## C. Area Inference（area 未指定時の honest 推論）

| 判定 | 提案エリア |
|---|---|
| guestCount ≤ 50 + budget ≤ 300 万 | 都市部 + 近郊レストラン / カジュアル系 (代官山 / 中目黒 / 銀座 / 横浜) |
| guestCount ≥ 100 + budget ≥ 450 万 | 都心ホテル系 (帝国ホテル / 椿山荘 / ニューオータニ等) |
| 神前 / 和装含む | 神社併設 (明治記念館 / 日枝神社・東京大神宮系) |
| 上記いずれも判定不能 | **首都圏代表 3 件 + advice に「エリア未指定のため首都圏代表をご提案。地域や駅名を教えていただくとより具体的にご提案できます」明記** |

地方 (大阪 / 京都 / 名古屋 / 福岡 / 札幌) を area 指定された場合は **首都圏に寄せず地方代表式場を選ぶ**。

## D. Diversity（3 件の重複回避）

- **3 件すべて同タイプ (同系列ホテル / 同建築様式 / 同エリア徒歩 5 分以内) は避ける**
- 例: 帝国ホテル + ホテルオークラ + パークハイアット は **NG** (3 件とも都心高級ホテル)
  → 1 件はホテル / 1 件は専門式場 / 1 件はゲストハウスのように散らす
- ただし条件 (例: 「神前 + 神社」) が specific すぎる場合は同タイプ 3 件でも可。その場合は `rationale.note` でその旨を 1 句明示

## E. Honest Uncertainty

| 状況 | 出力で示す表現 |
|---|---|
| 条件 3 つ以上未入力 | advice に「条件が少ないため代表的な式場を選んでいます。1-2 件登録すると AI 推薦の精度が上がります」 |
| decision-driver 判定不能 | reason 冒頭に「typical な提案として」 |
| 「実在の有名式場」judgement | 訓練データ cutoff 範囲外 (閉店 / 移転 / 名称変更 / 新規開業) の可能性 → **広く知られた本店 / 系列代表**を選ぶ。地方支店・新規開業店は避ける |
| `estimatedPrice` の根拠 | 概算 (会場使用料 + 料理 + 衣装 + 装花 + 写真映像 + 引出物 の典型構成、ゲスト数 × 平均単価) |

## F. rationale.note の書き方

各 recommendation の `rationale.note` は **1 行 30-60 字** で、「なぜこの 1 件を 3 件目に選んだか」を書く。

| ✅ 良い例 | ❌ 避ける |
|---|---|
| 「予算上限を活かしたデザイン重視枠として」 | 「素敵な式場です」(content がない) |
| 「親族中心という decision-driver に最も合致するため」 | 入力条件をそのままオウム返し |
| 「3 件のうちもっとも収容人数の余裕を持たせた選択」 | 主観絶賛 (「絶対」「最高」) |
| 「条件 (神前 + 和装) を最も明確に満たす 1 件として」 | |

## PII / Sanitize 注意

- 入力は `conditions` (style / guestCount / area / budget) のみ。**自由記述は流入しない**
- `exclusionNote` の式場名 (caller 側で `Venue.name` から構築) は登録済みの自前データなので追加 sanitize 不要
- 出力は **架空のレビュー / 個人名を含まない** 設計。万一含まれた場合 caller 側で破棄する

## Caller

- `src/server/actions/onboarding.ts:222-269` — `fetchClaudeRecommendations`
- 呼び方: `withRetry(() => askClaude({ system, userMessage }))`
- **20 秒の hard timeout**（`Promise.race` で `setTimeout` と競合）。失敗時は `null` を返してテンプレート fallback
- code fence 除去 + JSON.parse 失敗時は `null` で fallback
- UI (`OnboardingFlow`) は `getOnboardingRecommendations` (Claude AI) と `recommendVenuesFromConditions` (DB-based) を **`Promise.allSettled` で parallel** 実行 — 両方の結果を別 section で表示

## Cache

- `aiCache` テーブル (`computeInputHash` 経由) で永続キャッシュ
- `inputHash`: `sha256({ system, user, model: HAIKU, version: ONBOARDING_REC_PROMPT_VERSION })` の 16 字
  - `ONBOARDING_REC_PROMPT_VERSION` は `src/server/actions/onboarding.ts:21` で管理、**round 2 で 1 → 2 に bump 済**
  - 改定後の cache row は自動 miss → 新 prompt 経路に流れる
- リトライは `withRetry` (3 回, exponential backoff)

## Model 選定理由

- **SONNET 採用**: 候補生成の質が直接ユーザーの第一印象を決めるため。decision-driver 推論 + 予算内多様性 + diversity 判定 + 不確実性表現の **複合判断**は Sonnet クラスでないと精度が落ちる
- HAIKU は試した結果、価格帯ミックス / エリア該当性の精度が落ちた + decision-driver 判別が浅くなる → 不採用
- max 2048 token: 3 件 (reason 2-3 文 / strengths 2-3 件 / rationale + note) + advice (1-2 文) で十分

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/onboarding.ts` を同期 (system / buildUserMessage / model / maxTokens)
3. `last_synced` を更新 + 改訂履歴に追記
4. **prompt semantics を変えた場合は `src/server/actions/onboarding.ts:21` の `ONBOARDING_REC_PROMPT_VERSION` を `+1` する** (cache buster)
5. **`VenueRationale` に新 field 追加した場合は** `src/server/actions/onboarding-types.ts` を同 PR で同期 (optional で後方互換)
6. オンボーディング画面 (`/onboarding`) で 1 回スモーク → 3 件生成 + 各 reason に decision-driver の 1 句が含まれる + 全件 budget 上限以内
7. exclusionNote 経路 (登録済み式場あり) のスモークも 1 回
8. PR description に「onboarding prompt 改定」と明記

## 既知の限界

- 「実在する式場」を判定する根拠はモデルの内部知識のみ。閉店 / 名称変更にはタイムラグあり (round 2 では「広く知られた本店 / 系列代表を選ぶ」で緩和)
- exclusionNote の式場名が **長くなると 4096 token 圧迫**（caller 側で件数制限なし。要監視）
- decision-driver の 5 分類はソフト判定。caller 側で「reason 冒頭に分類句が含まれているか」を assert しない
- budget 上限超過 (`budget_match=false`) を caller で reject していないため、prompt 違反時はそのまま UI に流れる (P3 課題: caller 側で budget filter を入れる)
- `rationale.note` は optional のため、UI が note を活用するかどうかは UI 担当タスクで決める (現状は表示されない可能性あり)
- 訓練データ cutoff の式場情報 (会場名 / 価格帯) は **古い可能性あり** (1-2 年遅れ)

---
name: onboarding.system
pairs_with: src/lib/prompts/onboarding.ts
model: claude-sonnet-4-6
maxTokens: 2048
last_synced: 2026-05-02
---

# Onboarding Recommendation Prompt — 仕様

オンボーディング初回フローで「3 件の式場を提案する」生成 prompt の正本。
`src/lib/prompts/onboarding.ts` の `ONBOARDING_RECOMMENDATION_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: 日本のウェディング会場アドバイザー (knowledgeable Japanese wedding venue advisor)
- 役割: ユーザーが入力した条件に最も合う **実在の式場** を 3 件選び、ふたりが「行ってみたい」と思える短い理由を添える
- スタンス: 「売る」のではなく「ふたりに合う候補を並べる」。ラグジュアリー / ミドル / バリューと**価格帯を散らす**

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
      "reason": "<1-2 sentence reason in Japanese>",
      "estimatedPrice": <number | null>,
      "ceremonyStyles": ["<style>"],
      "strengths": ["<2-3 strengths>"],
      "rationale": {
        "area_match": <true|false>,
        "budget_match": <true|false>,
        "style_match": <true|false>
      }
    }
  ],
  "advice": "<1 sentence general advice in Japanese>"
}
```

`recommendations` は厳密に 3 件。`advice` は 1 文。

## Generation Rules

1. **実在する有名式場のみ** を提案する（架空は禁止）
2. ゲスト人数は会場収容と合致、予算は estimatedPrice と合致させる
3. 価格帯を散らす: ラグジュアリー / ミドル / バリュー の 3 種をミックス
4. エリア未指定時は **首都圏 (Tokyo metropolitan area) をデフォルト**
5. `rationale.*` フラグの判定基準:
   - `area_match`: 提案する式場が希望エリア内なら true
   - `budget_match`: estimatedPrice が予算範囲内に収まれば true
   - `style_match`: ceremonyStyles が希望スタイルと 1 つでも重なれば true
   - **ユーザーが該当条件を未指定の場合、対応フラグは false** にする (true にしない)
6. 出力は **valid JSON のみ**。markdown コードフェンス / 前置き禁止

## PII / Sanitize 注意

- 入力は `conditions` (style / guestCount / area / budget) のみ。**自由記述は流入しない**
- `exclusionNote` の式場名 (caller 側で `Venue.name` から構築) は登録済みの自前データなので追加 sanitize 不要
- 出力は **架空のレビュー / 個人名を含まない** 設計。万一含まれた場合 caller 側で破棄する

## Caller

- `src/server/actions/onboarding.ts:223-225` — `fetchClaudeRecommendations`
- 呼び方: `withRetry(() => askClaude({ system, userMessage }))`
- **20 秒の hard timeout**（`Promise.race` で `setTimeout` と競合）。失敗時は `null` を返してテンプレート fallback
- code fence 除去 + JSON.parse 失敗時は `null` で fallback

## Cache

- caller 側で AI cache **未使用**。毎回 fresh 生成
  - 理由: 既登録式場 (exclusionNote) が変わるたびに結果も変わるべきだから
- リトライは `withRetry` (3 回, exponential backoff)

## Model 選定理由

- **SONNET 採用**: 候補生成の質が直接ユーザーの第一印象を決めるため
- HAIKU は試した結果、価格帯ミックス / エリア該当性の精度が落ちたので不採用
- max 2048 token: 3 件 + advice の JSON で十分

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/onboarding.ts` を同期 (system / buildUserMessage / model / maxTokens)
3. `last_synced` を更新
4. オンボーディング画面 (`/onboarding` 等) で 1 回スモーク → 3 件生成されることを確認
5. exclusionNote 経路 (登録済み式場あり) のスモークも 1 回
6. PR description に「onboarding prompt 改定」と明記

## 既知の限界

- 「実在する式場」を判定する根拠はモデルの内部知識のみ。閉店 / 名称変更にはタイムラグあり
- exclusionNote の式場名が **長くなると 4096 token 圧迫**（caller 側で件数制限なし。要監視）
- 出力の architectural 同意 (3 件固定 / 価格帯ミックス) はソフト制約。検証は caller 側 (`result.recommendations.length` の確認のみ) で**価格帯ミックスは未検証**

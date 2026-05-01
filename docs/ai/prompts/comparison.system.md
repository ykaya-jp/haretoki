---
name: comparison.system
pairs_with: src/lib/prompts/comparison.ts
model: claude-sonnet-4-6
maxTokens: 2048
last_synced: 2026-05-02
---

# Comparison Insight Prompt — 仕様

「候補に追加された 2 件以上の式場を比較し、tradeoff を自然文で説明する」AI Insight Card 用 prompt。
`src/lib/prompts/comparison.ts` の `COMPARISON_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: ウェディング会場の比較アナリスト (wedding venue comparison analyst)
- 役割: 与えられた式場群について、定量・定性両面から **tradeoff を客観的に整理** し、3 つの "pick" (予算重視 / 品質重視 / バランス) を提案する
- スタンス: **断定推薦しない**。「〜を重視するなら」と条件付きで提示

## Input (User Message)

`buildUserMessage(venueDescriptions, conditionsDesc)` で生成。caller 側で次のフォーマットで埋める:

```
以下の式場を比較分析してください:
【<venue.name>】
- エリア: <location | "不明">
- 収容: <capacityMin>〜<capacityMax>名
- スタイル: <ceremonyStyles.join(", ") | "不明">
- 見積もり: <"¥<total/10000>万円" | "未入力">
- スコア: <dimension=score, ...>
- 総合: <totalScore>点
... (式場ごとに繰り返し)

カップルの希望: <JSON.stringify(conditions)>  ← conditions が無いときは空文字
```

## Output (JSON Shape)

```json
{
  "summary": "<2-3 sentence overview in Japanese>",
  "tradeoffs": [
    { "dimension": "<name>", "analysis": "<1 sentence in Japanese>", "leader": "<venue name | null>" }
  ],
  "recommendations": ["<actionable recommendation in Japanese>"],
  "budgetPick": "<venue name | null>",
  "qualityPick": "<venue name | null>",
  "balancedPick": "<venue name | null>"
}
```

`recommendations` は **最大 3 件**。`*Pick` はどれかが null でもよい (該当なし時)。

## Generation Rules

1. **客観的に書く**: 「〜を重視するなら<X>」フォーマット。「〜にすべき」と決めつけない
2. 費用比較は **具体数字で** 表現する（「<X>は<Y>より <N> 万円安い」のように）
3. `recommendations` は最大 3 件。アクション可能な提案 (「次の見学で<X>を確認」等) を入れる
4. `*Pick` は与えられた式場名のいずれかから選ぶ。**架空名禁止**
5. 出力は **valid JSON のみ**。markdown コードフェンス / 前置き禁止

## PII / Sanitize 注意

- 入力に流入する `Venue.name` / `location` は自前 DB から。但し URL 取込由来のため**外部由来テキスト**を含む
  - caller 側で `sanitizeForPrompt` 適用は **未実施**（要レビュー: P3 課題）
- `conditions` は `JSON.stringify` 後そのまま埋め込み（自由記述があれば prompt injection 余地）
- 出力に PII は含まれない設計（Persona 上、あくまで集計分析）

## Caller

- `src/server/actions/comparison.ts:148-153` — `generateInsight`
- 呼び方: `withRetry(() => askClaude({ system, userMessage }))`
- 候補が **2 件未満** の場合は呼び出さず `generateTemplateInsight` で fallback
- JSON.parse 失敗 / 必須フィールド欠落でも `generateTemplateInsight` で fallback

## Cache

- **24h TTL** を `prisma.aiAnalysis` (`type: "comparison"`) で実装
- `inputHash`: `venues.map(v => v.id).sort().join(",") + JSON.stringify(conditions)` の sha256 16 字
- ヒット時は `output` 列を JSON.parse して返す（DB レベル cache）

## Model 選定理由

- **SONNET 採用**: tradeoff 推論 (複数式場のスコア / 数字を横断的に比較) に複雑度がある
- HAIKU は「<X>と<Y>はどちらも素敵」式の抽象まとめに陥りがちで採用見送り
- max 2048 token: 3 候補 + tradeoffs 数項目の JSON で収まる

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/comparison.ts` を同期 (system / buildUserMessage / model / maxTokens)
3. `last_synced` を更新
4. 候補画面で 2 件以上候補追加 → AI Insight が出ることを 1 回スモーク
5. cache TTL 内なら同条件で 2 回目の呼び出しが**追加 API call を発生させない**ことを Network タブで確認
6. PR description に「comparison prompt 改定」と明記

## 既知の限界

- `conditions` (project.conditions) を **そのまま** JSON 文字列化して流入させているため、ユーザー記述の自由テキストが prompt injection 経路になり得る (sanitize 未実装)
- 4 件以上比較するとプロンプトが膨らみ tradeoff 分析の粒度が落ちる (caller 側に件数制限なし、要監視)
- `*Pick` の妥当性は caller で検証していない (引数 venues に存在する name か未確認)

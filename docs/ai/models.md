# Claude Models — Haretoki

`src/lib/models.ts` の `MODEL` 定数と本ファイルは常にペアで更新する。
モデル ID は本ファイルから引用し、各 prompt / route ファイルでハードコードしない。

## 定数表

| 定数 | Model ID | 役割 |
|---|---|---|
| `MODEL.HAIKU` | `claude-haiku-4-5-20251001` | 軽量・高頻度。コーチ会話、URL 取込下処理、要約 |
| `MODEL.SONNET` | `claude-sonnet-4-6` | 標準。推薦・分析・比較・見積解析 |
| `MODEL.OPUS` | `claude-opus-4-7` | 高難度推論。アーキ判断（現状未使用） |

## 機能 → モデル割当

| 機能 | ファイル | モデル | 理由 |
|---|---|---|---|
| Coach chat (stream) | `src/app/api/coach/stream/route.ts` | SONNET | 多ターン対話の自然さ重視 |
| Coach action (sync) | `src/server/actions/coach.ts` | SONNET | 同上 |
| Onboarding 推薦 | `src/lib/prompts/onboarding.ts` | SONNET | 候補生成の質 |
| 式場比較分析 | `src/lib/prompts/comparison.ts` | SONNET | tradeoff 推論 |
| URL 取込（構造化抽出） | `src/lib/prompts/url-extraction.ts` | SONNET | フィールド抽出精度 |
| 口コミ要約 | `src/lib/prompts/review-summary.ts` | SONNET | sentiment / 抽出精度 |
| 見積もり解析 | `src/lib/prompts/estimate-analysis.ts` | SONNET | カテゴリ分類精度 |
| Matrix インサイト | `src/server/actions/matrix-insight.ts` | SONNET | 短文生成 |
| デフォルト (`askClaude`) | `src/lib/anthropic.ts` | HAIKU | コスト最適化 |

## モデル切替手順

1. `src/lib/models.ts` の対象定数を新 ID に更新
2. 本ファイルの定数表を更新
3. `npx tsc --noEmit && npm run lint && npm test`
4. coach / 推薦 / URL 取込のスモークを 1 回ずつ手動で実施
5. PR 説明に切替の動機（性能 / コスト / 廃止）を明記

## 禁止リスト

以下の旧 ID を直接書かない。本ファイル無視で再導入されたら CI で落とす（Phase 2 で grep ガード追加予定）:

- `claude-sonnet-4-20250514` (旧 Sonnet 4)
- `claude-3-5-sonnet-*` (Claude 3 系すべて)
- `claude-3-opus-*`

## 参考

- Anthropic 公式モデル一覧: <https://docs.anthropic.com/en/docs/about-claude/models>
- 課金単価とコンテキスト窓は四半期ごとに上記公式ドキュメントで再確認する

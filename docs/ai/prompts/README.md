# Prompts — Haretoki

Claude API に渡す system prompt の **人間が読む正本**。
コードは `src/lib/prompts/*.ts` に集約、本ディレクトリの `*.md` と必ず同期する。

## ペアリング

| 機能 | コード | 仕様 (本ディレクトリ) |
|---|---|---|
| Coach chat | `src/lib/prompts/coach-chat.ts` | `coach.system.md` |
| Onboarding 推薦 | `src/lib/prompts/onboarding.ts` | (Phase 2) `onboarding.system.md` |
| URL 取込 | `src/lib/prompts/url-extraction.ts` | (Phase 2) `url-extraction.system.md` |
| 比較分析 | `src/lib/prompts/comparison.ts` | (Phase 2) `comparison.system.md` |
| 口コミ要約 | `src/lib/prompts/review-summary.ts` | (Phase 2) `review-summary.system.md` |
| 見積解析 | `src/lib/prompts/estimate-analysis.ts` | (Phase 2) `estimate-analysis.system.md` |

## 更新プロトコル

1. **必ず両方を同 PR で更新**（片方だけ変えない）
2. md → ts の順で書く（仕様 → 実装）
3. md は **何を / なぜ** を書く。ts は **どう** を書く
4. Phase 2 で PostToolUse hook が drift を検知し SessionStart で警告

## ドキュメントの構造

各 `*.system.md` は以下のセクションを含む:

- **Persona** — モデルが演じる役割
- **Capabilities** — 持つべき知識領域
- **Behavior** — 応答の型・トーン・長さ
- **Context Variables** — system prompt にバインドされる動的データ
- **Forbidden** — 禁止事項
- **Update Protocol** — 仕様変更時のチェックリスト

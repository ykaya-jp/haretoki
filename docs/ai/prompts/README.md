# Prompts — Haretoki

Claude API に渡す system prompt の **人間が読む正本**。
コードは `src/lib/prompts/*.ts` に集約、本ディレクトリの `*.md` と必ず同期する。

## 状態凡例

- ✅ md / ts 両方ある (drift 監視対象)
- 🟡 ts のみ。md は未着手 ([`PENDING.md`](../../PENDING.md) 参照)
- ⏳ どちらも未実装 (Roadmap 該当 Release 待ち)

## ペアリング

| 機能 | コード | 仕様 (本ディレクトリ) | 状態 |
|---|---|---|---|
| Coach chat | `src/lib/prompts/coach-chat.ts` | `coach.system.md` | ✅ |
| Onboarding 推薦 | `src/lib/prompts/onboarding.ts` | `onboarding.system.md` | 🟡 |
| URL 取込 | `src/lib/prompts/url-extraction.ts` | `url-extraction.system.md` | 🟡 |
| 比較分析 | `src/lib/prompts/comparison.ts` | `comparison.system.md` | 🟡 |
| 口コミ要約 | `src/lib/prompts/review-summary.ts` | `review-summary.system.md` | 🟡 |
| 見積解析 | `src/lib/prompts/estimate-analysis.ts` | `estimate-analysis.system.md` | 🟡 |

> 🟡 のものは **コードでは動いている** が、md 仕様書がまだ書き起こされていない状態。`docs/PENDING.md` の "AI prompts md 化" 項目で扱い判断。

## 更新プロトコル

1. **必ず両方を同 PR で更新**（片方だけ変えない）
2. md → ts の順で書く（仕様 → 実装）
3. md は **何を / なぜ** を書く。ts は **どう** を書く
4. drift 自動検知 (PostToolUse hook on `src/lib/prompts/**` → 対応 md に `stale: true`) は `harness-ai-maintenance-plan.md` Phase 2 で計画済み・**未実装**

## ドキュメントの構造

各 `*.system.md` は以下のセクションを含む:

- **Persona** — モデルが演じる役割
- **Capabilities** — 持つべき知識領域
- **Behavior** — 応答の型・トーン・長さ
- **Context Variables** — system prompt にバインドされる動的データ
- **Forbidden** — 禁止事項
- **Update Protocol** — 仕様変更時のチェックリスト

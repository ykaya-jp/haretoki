# Prompts — Haretoki

Claude API に渡す system prompt の **人間が読む正本**。
コードは `src/lib/prompts/*.ts` に集約、本ディレクトリの `*.md` と必ず同期する。

## 状態凡例

- ✅ md / ts 両方ある (drift 監視対象)
- 🟡 ts のみ。md は未着手 ([`PENDING.md`](../../PENDING.md) 参照)
- 📍 inline prompt — モジュール化されておらず、利用箇所のファイル内に直書き
- ⏳ どちらも未実装 (Roadmap 該当 Release 待ち)

## ペアリング

| 機能 | コード | 仕様 (本ディレクトリ) | 状態 |
|---|---|---|---|
| Coach chat | `src/lib/prompts/coach-chat.ts` | `coach.system.md` | ✅ |
| Onboarding 推薦 | `src/lib/prompts/onboarding.ts` | `onboarding.system.md` | 🟡 |
| 比較分析 (AI Insight Card) | `src/lib/prompts/comparison.ts` | `comparison.system.md` | 🟡 |
| Decision Matrix Insight | `src/lib/prompts/matrix-insight.ts` | `matrix-insight.system.md` | 🟡 |
| 口コミ要約 | `src/lib/prompts/review-summary.ts` | `review-summary.system.md` | 🟡 |
| Fit Reason (1 行) | `src/lib/prompts/fit-reason.ts` | `fit-reason.system.md` | 🟡 |
| Daily Ritual | `src/lib/prompts/ritual.ts` | `ritual.system.md` | 🟡 |
| Vibe タグ自動サジェスト | `src/lib/prompts/vibe-suggest.ts` | `vibe-suggest.system.md` | 🟡 |
| URL 取込 抽出 | `src/server/actions/venues.ts` 内 `URL_EXTRACTION_SYSTEM_PROMPT` | (inline) | 📍 |
| 見積もり PDF 解析 | `src/server/actions/estimate-ai.ts` 内 `ESTIMATE_EXTRACT_SYSTEM_PROMPT` | (inline) | 📍 |

> 🟡 のものは **コードでは動いている** が、md 仕様書がまだ書き起こされていない状態。`docs/PENDING.md` の Phase 2 "AI prompts md 化" で扱う。
>
> 📍 (inline) は addVenueFromUrl / analyzeEstimatePdf のパイプラインに溶け込んでおり、汎用モジュールとしては切り出されていない。Phase 2 でモジュール化検討。

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

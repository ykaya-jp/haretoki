# Prompts — Haretoki

Claude API に渡す system prompt の **人間が読む正本**。
コードは `src/lib/prompts/*.ts` または該当 Server Action 内 (inline) に集約、本ディレクトリの `*.md` と必ず同期する。

## 状態凡例

- ✅ md / ts 両方ある (drift 監視対象)
- 🟡 ts のみ。md は未着手 ([`PENDING.md`](../../PENDING.md) 参照)
- ⏳ どちらも未実装 (Roadmap 該当 Release 待ち)

## ペアリング

| 機能 | コード | 仕様 (本ディレクトリ) | 状態 |
|---|---|---|---|
| Coach chat | `src/lib/prompts/coach-chat.ts` | [`coach.system.md`](coach.system.md) | ✅ |
| Onboarding 推薦 | `src/lib/prompts/onboarding.ts` | [`onboarding.system.md`](onboarding.system.md) | ✅ |
| 比較分析 (AI Insight Card) | `src/lib/prompts/comparison.ts` | [`comparison.system.md`](comparison.system.md) | ✅ |
| 口コミ要約 | `src/lib/prompts/review-summary.ts` | [`review-summary.system.md`](review-summary.system.md) | ✅ |
| URL 取込 抽出 | `src/lib/prompts/url-extraction.ts` | [`url-extraction.system.md`](url-extraction.system.md) | ✅ |
| 見積もり PDF 解析 | `src/lib/prompts/estimate-extract.ts` | [`estimate-extract.system.md`](estimate-extract.system.md) | ✅ |
| Decision Matrix Insight | `src/lib/prompts/matrix-insight.ts` | [`matrix-insight.system.md`](matrix-insight.system.md) | ✅ |
| Fit Reason (1 行) | `src/lib/prompts/fit-reason.ts` | [`fit-reason.system.md`](fit-reason.system.md) | ✅ |
| Daily Ritual | `src/lib/prompts/ritual.ts` | [`ritual.system.md`](ritual.system.md) | ✅ |
| Vibe タグ自動サジェスト | `src/lib/prompts/vibe-suggest.ts` | [`vibe-suggest.system.md`](vibe-suggest.system.md) | ✅ |

> 全 10 prompt の md 化が完了 (Phase 2.A、2026-05-02)。**今後はこの md と ts を必ず同 PR で同期**する規約。
>
> 2026-05-02 round 2: 旧 inline 配置だった `URL_EXTRACTION_SYSTEM_PROMPT` / `ESTIMATE_EXTRACT_SYSTEM_PROMPT` を `src/lib/prompts/url-extraction.ts` / `src/lib/prompts/estimate-extract.ts` に切り出し済。10 prompt 全てが `src/lib/prompts/*.ts` 配下に揃い、📍 inline 表記は廃止。

## 更新プロトコル

1. **必ず両方を同 PR で更新**（片方だけ変えない）
2. md → ts (or inline 直書き) の順で書く（仕様 → 実装）
3. md は **何を / なぜ** を書く。ts は **どう** を書く
4. drift 自動検知 (PostToolUse hook on `src/lib/prompts/**` → 対応 md に `stale: true`) は `harness-ai-maintenance-plan.md` Phase 2 で計画済み・**未実装**

## ドキュメントの構造

各 `*.system.md` は以下のセクションを含む（生成系・抽出系で見出しが多少変わる）:

- **Persona / Role** — モデルが演じる役割
- **Input (User Message)** — `buildUserMessage` で組み立てる入力フォーマット
- **Output (JSON Shape)** — 期待 JSON スキーマ
- **Generation / Extraction Rules** — 数値変換、enum マッピング、トーン
- **PII / Sanitize 注意** — `stripPII` / `sanitizeForPrompt` の適用有無、外部由来テキストの取扱い
- **Caller** — どの Server Action / Route から呼ばれるか (`file:line` 付き)
- **Cache** — キャッシュ戦略 (aiCache / aiAnalysis / 未使用)
- **Model 選定理由** — Haiku / Sonnet を選んだ根拠
- **Update Protocol** — 仕様変更時のチェックリスト
- **既知の限界** — truncate / sanitize 未適用 / 監視ギャップ

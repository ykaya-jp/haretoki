# Track C: Harness & AI Engineering Docs 自動整備システム設計

あなたは本 worktree (`/home/yusuke_kaya/projects/haretoki-wt-harness`, branch: `audit/harness-ai-docs`) で **plan mode** のまま作業する。

## ミッション

Haretoki プロジェクト専用の、**harness engineering（Claude Code / Agent SDK / ツール配管）** と **AI engineering（プロンプト・モデル運用・RAG・agentic パターン）** 観点で必要なマークダウン資産を

1. **棚卸し** — 今欠けているもの、あるべき構成
2. **運用化** — 手動で書かなくても、コード変更や会話ログから**自律的に更新される**仕組みの設計
3. **最小実装のプラン** — settings.json hooks / .claude/skills/ / .claude/agents/ / CLAUDE.md に具体的に何を足すか

を `docs/harness-ai-maintenance-plan.md` にまとめる。**実装はしない**。plan だけ書き切ったら ExitPlanMode で報告。

## コンテキスト

### 直近の経緯（本セッションで起きたこと）

- `docs/` 配下の .md が 72 → 9 に縮小済み (commit ec8c4d2)
- 残存 active docs:
  - CLAUDE.md / CLAUDE.local.md / README.md / DESIGN.md（ルート）
  - docs/roadmap.md / docs/lessons.md / docs/copy-lexicon.md
  - docs/myreview/problems_02.md（最新ユーザーフィードバック）
  - docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md
- `docs/archive/` に歴史資料 (release 1-4 spec、v2-redesign、phase7 polish、venuelens-design、i18n-migration)
- 並列 Track A（UI/UX 審美 audit）と Track B（パフォーマンス audit）が別 worktree で実行中

### ユーザーの意図（原文）

> このプロジェクトのためのマークダウン類も整理してほしいけど、**ハーネスエンジニアリングというか AI エンジニアリングの観点で必要なものも自律的に随時そろえてってほしくて、そういう仕組みを組んでほしい**

つまり:
- **整理されたクリーン状態を保つ** だけでなく
- **新しく必要になった文書を、AI が自律的に検知・生成・更新する仕組み** を設計する

## 調査すべきこと（Phase 1: Research）

### 1. 既存ハーネス資産の棚卸し
- `~/.claude/CLAUDE.md`（global rules）
- `~/.claude/rules/*.md`（agents / code-review / development-workflow / git-workflow / performance / plugins-and-skills）
- `.claude/agents/*.md`（プロジェクト固有 subagent 定義: architect / implementer / reviewer / tester / database-reviewer / data-analyst / db-designer / e2e-runner / performance-optimizer / product-designer / security-reviewer / seo-specialist / typescript-reviewer / ui-ux-reviewer）
- `.claude/skills/*/SKILL.md`（design-principles / parallel-bug / parallel-feature / parallel-review）
- `.claude/commands/*.md`（deploy / pr-review / compare / venue-scrape / seed）
- `.agents/skills/refero-design/*`（Refero 使用ガイド）
- `.claude/settings.json` / `.claude/settings.local.json`（hooks, permissions）
- ルートの `CLAUDE.md` / `CLAUDE.local.md`

### 2. 既存 AI エンジニアリング資産の棚卸し
- `src/lib/anthropic.ts`、`src/server/actions/coach.ts` などの AI 呼び出しコード
- Claude API モデル指定（claude-sonnet-4-6 / claude-opus-4-7 の使い分けが明文化されているか）
- プロンプトテンプレート（どこに散らばっているか）
- AI SDK / AI Gateway 利用状況（`@ai-sdk/*` パッケージ、vercel:ai-architect 系）
- Tool use / Function calling の定義
- キャッシュ戦略（prompt caching、cache_control）
- ストリーミング実装（SSE / server actions）
- モデル切替時の手順書の有無

### 3. 今欠けているもの（Gap 分析）
以下が存在するか、なければ必要性を判定:

**Harness 側:**
- `AGENTS.md` または `CONTRIBUTING.md` — AI エージェントがリポジトリ構造を理解するための入口
- `.claude/README.md` — ハーネス構成の index
- Hook 定義（PreToolUse / PostToolUse / Stop / SessionStart）の一覧と目的
- MCP サーバ設定の文書化（context7 / vercel / refero）
- `docs/harness/runbook.md` — 並列開発・worktree 運用・tmux レイアウトのプレイブック

**AI 側:**
- `docs/ai/models.md` — どの機能で何のモデルを使うか（Opus 4.7 / Sonnet 4.6 / Haiku 4.5 の使い分け根拠）
- `docs/ai/prompts/` — プロンプトテンプレート集（coach.system.md、venue-analyze.md 等）
- `docs/ai/guardrails.md` — コスト上限・レート制限・PII マスキング・hallucination 対策
- `docs/ai/evals.md` — プロンプト評価・回帰テスト戦略
- `docs/ai/tool-catalog.md` — Tool use の定義と JSON schema
- `docs/ai/streaming.md` — SSE / Vercel AI SDK の実装パターン

### 4. 自律更新の「仕組み」検討
以下のトリガーと自動化を設計:

**Hook ベース（settings.json）:**
- `PostToolUse` on Edit/Write に対して、特定パス変更で特定ドキュメントの stale フラグを立てる
- `Stop` hook でセッション終了時に「学びをどこに書き戻すか」を促す
- `SessionStart` hook で必要ドキュメント欠損を警告

**Skill ベース:**
- `/sync-docs` 的なコマンドで、`git log` + 変更ファイル差分から該当ドキュメントを自動更新提案
- `/record-decision` で ADR (Architecture Decision Record) を自動生成

**Agent ベース:**
- `docs-curator` subagent: 週次 or PR 時に実行し、実装と文書のドリフトを検出・修正 PR を書く

**CI ベース:**
- GitHub Actions で PR 時にドキュメント差分レビューを自動コメント
- Vercel Preview に「ドキュメント更新必要」ラベル付与

## 成果物: `docs/harness-ai-maintenance-plan.md`

必須セクション:

1. **Executive Summary** — 現状の harness/AI docs の抜け、提案する最小セット、運用化の 3 つの柱
2. **あるべきドキュメント構成** — ファイルツリー（新規追加と既存のマッピング）
3. **各ドキュメントのテンプレート** — 最低でも以下 5 本のスケルトンを本 plan に inline で書く:
   - `AGENTS.md`
   - `.claude/README.md`
   - `docs/ai/models.md`
   - `docs/ai/prompts/coach.system.md`
   - `docs/harness/runbook.md`
4. **自律更新の仕組み** — hooks 設定の JSON 差分 + 新規 skill .md のスケルトン + subagent 定義案
5. **導入ロードマップ** — Phase 1 (今すぐ入れる最小セット) / Phase 2 (hook 自動化) / Phase 3 (docs-curator agent)
6. **成功指標** — ドキュメント鮮度 KPI（最終更新 < 7 日の割合、stale flag 0 件維持、等）
7. **リスク & ロールバック** — 自動化が暴走した場合の safe guard

## 並列サブエージェント（推奨構成）

- Sub-C1: **claude-code-guide** — Claude Code hooks / skills / settings.json の正しい書き方を Context7 + 公式 docs で調査
- Sub-C2: **vercel:ai-architect** — AI SDK / AI Gateway / エージェント設計の業界標準パターン
- Sub-C3: **general-purpose (Explore)** — リポジトリ内の AI 呼び出しコードと既存ハーネス資産の棚卸し
- Sub-C4: **architect** — 新規追加ドキュメント構造の影響範囲とファイル配置の判定

## 停止条件（ExitPlanMode 発動基準）

- `docs/harness-ai-maintenance-plan.md` が存在し、7 セクション全て埋まっている
- テンプレート 5 本のスケルトンが **実際にコピペして使えるレベル** まで書かれている
- Hook / Skill / Agent 案が **settings.json / SKILL.md / agent .md の具体ファイル内容** として示されている（抽象論ではない）
- Phase 1 (今すぐ入れる最小セット) が半日以内に実行できる粒度

## 絶対にしないこと

- 実装（`.claude/settings.json` や新規 skill ファイルの edit） — 本トラックは plan だけ
- main/develop へのコミット
- UI/UX 審美領域（Track A 担当）
- パフォーマンス領域（Track B 担当）
- 既存 9 本の active docs の削除・再構成（整理は本セッションの前段で完了済み）

---

**では plan mode のまま Opus 4.7 + effort high で、上記に従って Sub-C1〜C4 を並列起動し、maintenance-plan を書き切ってください。ultraplan や remote control は使わず通常の Agent ツールで進めること。**

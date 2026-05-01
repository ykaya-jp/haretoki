# .claude/ — Harness Index

Haretoki プロジェクト専用の Claude Code harness 設定。
変更の影響範囲が大きいため、編集時は本 README と `docs/harness/runbook.md` を同時更新。

## 構成

```
.claude/
├── settings.json        # 全開発者共通の hook / permission
├── settings.local.json  # ローカル override（gitignored、各自作成）
├── .mcp.json.example    # MCP サーバ設定の正本（commit OK）
├── .mcp.json            # 上記をコピーして credentials を埋めた実体（gitignored）
├── agents/              # subagent 定義（@-mention で呼び出し）
├── skills/              # 手続きの playbook（SKILL.md をロード）
├── commands/            # /slash で呼ぶショートカット
├── scripts/             # shell utility（worktree 管理等）
└── worktrees/           # 並列開発時の worktree 一時格納（gitignored）
```

## Agents（`.claude/agents/`）

| name | model | 用途 | いつ使う |
|---|---|---|---|
| architect | opus | 影響範囲分析・実装分解 | 新機能・大規模リファクタ前 |
| implementer | sonnet | スコープが切られた実装 | architect 分解後の各単位 |
| reviewer | opus | コードレビュー | 実装完了直後、merge 前 |
| tester | sonnet | test 作成・E2E 実行 | 実装と並走 |
| db-designer | opus | Prisma スキーマ設計 | schema 変更前 |
| data-analyst | sonnet | scripts/ でのデータ分析 | venue データ分析・集計 |
| docs-curator (Phase 3) | sonnet | docs drift 検出 PR 起案 | 週次 / PR 時 |

## Skills（`.claude/skills/*/SKILL.md`）

| name | 用途 |
|---|---|
| design-principles | UI コンポーネント作成時のデザイン原則 |
| parallel-bug | bug の root cause 調査 → 修正 → 回帰防止 |
| parallel-feature | 中〜大規模機能を architect → 分割 → implementer 並列 |
| parallel-review | 実装完了後の多視点並列レビュー |
| sync-docs (Phase 2) | git 差分から docs 更新提案 |
| record-decision (Phase 2) | ADR を自動生成 |

## Commands（`.claude/commands/`）

| name | 用途 |
|---|---|
| /deploy | Vercel 本番デプロイ |
| /pr-review | 現ブランチの diff レビュー |
| /compare | DB 式場データで比較表生成 |
| /venue-scrape | URL から式場情報を収集 |
| /seed | テスト式場データ投入 |

## Scripts（`.claude/scripts/`）

| name | 用途 |
|---|---|
| worktree-create.sh | `feat/...` ブランチを develop から worktree で切る + `.env.local` コピー |
| worktree-clean.sh | worktree + branch を一括削除 |
| mark-docs-stale.sh (Phase 2) | PostToolUse hook: ペアリング設定に基づき該当 docs に `stale: true` を立てる |
| docs-drift-check.sh (Phase 2) | SessionStart / Stop hook: stale 件数を stderr に警告 |

## MCP サーバ（`.claude/.mcp.json`）

詳細は `docs/harness/mcp.md`。MCP は 2 種類:

- **Plugin-provided**（Refero / Context7 / Vercel / Figma など）: marketplace で `enabledPlugins` 経由、本ファイルには書かない
- **Project-defined**（github / supabase / postgres-ro / filesystem-ro / sentry など）: `.mcp.json.example` をコピーして実体を作成、必要なものだけ `disabled: false` に

**シークレット**: `.mcp.json` は gitignored。`env` の値は全て `${ENV_VAR}` で参照し、実値は各開発者の shell / `~/.claude/.env` に置く。`.env*` / `*credentials*` / `.key` / `.pem` は `PreToolUse` hook が write block する。

## Hooks（settings.json）

詳細は `docs/harness/hooks.md`。現行 hook:

| Event | Matcher | 目的 |
|---|---|---|
| PreToolUse | `Write\|Edit\|MultiEdit` | 機密ファイル（`.env` / `.key` / `.pem` / `*credentials*`）への書込 block |
| PostToolUse | `Write\|Edit\|MultiEdit` | prettier --write を自動実行（ts/tsx/js/jsx/json/md/css） |

Phase 2 で追加予定:

- PostToolUse on `src/lib/prompts/**` → 対応する `docs/ai/prompts/*.md` に `stale: true` 付与
- PostToolUse on `src/lib/anthropic.ts` → `docs/ai/{guardrails,streaming}.md` を stale
- SessionStart → stale 件数を stderr に警告
- Stop → セッション終了時の drift サマリ

## 追加・変更のルール

- 新規 agent / skill / command を追加したら**本 README の表も同時更新**する（drift 防止の一次ルール）
- `settings.json` に hook を足すときは `docs/harness/hooks.md` に目的・matcher・影響を必ず記載
- ローカル固有の hook は `settings.local.json`（gitignore 済）

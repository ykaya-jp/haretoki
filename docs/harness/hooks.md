# Claude Code Hooks

このリポジトリと、開発者個人のグローバル設定 (`~/.claude/settings.json`) で動いている hook を一覧化する。
新規 hook を足すときは本ファイルを必ず同時更新（drift 防止の一次ルール）。

## プロジェクトスコープ — `.claude/settings.json`

| Event | Matcher | 目的 | 失敗時の影響 |
|---|---|---|---|
| PreToolUse | `Write\|Edit\|MultiEdit` | 機密ファイル (`.env*` / `.key` / `.pem` / `*credentials*` / `*service_role*`) への書込 block | tool 実行が拒否される（exit 2） |
| PostToolUse | `Write\|Edit\|MultiEdit` | prettier --write を自動実行（ts/tsx/js/jsx/json/md/css） | サイレント（`\|\| true`） |

### 1. PreToolUse: secret-block

#### 目的
`.env*` / `.key` / `.pem` / `*credentials*` / `*service_role*` への書込を機械的に block。
エージェントが誤って秘密情報を commit する経路を物理的に遮断する。

> **メモ**: グローバル `~/.claude/settings.json` 側にも上位互換の secret-block hook が定義されている（追加のパターン: `*.pfx` / `*id_rsa*` / `*id_ed25519*`）。プロジェクト側 hook はそれより先に発火するため、両方共存しても二重 block になるだけで害はない。今後グローバル側に集約していく案あり。

#### Matcher
`Write|Edit|MultiEdit`

#### Command
```bash
f="${CLAUDE_FILE_PATH:-}"
case "$f" in
  *.env|*.env.*|*.key|*.pem|*credentials*|*service_role*)
    echo "BLOCK: refused to write secret-like file: $f" >&2
    exit 2
  ;;
esac
```

### 2. PostToolUse: prettier auto-format

書込・編集後のファイルを自動整形し、レビュー時の format diff ノイズを排除。
対象拡張子のみ整形、`--no-install` で勝手に prettier を取りに行かない、失敗してもサイレント (`|| true`)。

#### トラブル
- prettier が無限ループ → `.claude/settings.json` の PostToolUse matcher を一時 comment out（`docs/harness/runbook.md` トラブルシュート参照）

## グローバルスコープ — `~/.claude/settings.json`

開発者個人が `~/.claude/` に持つ設定。プロジェクトを跨いで効くため、**Haretoki 単体で完結しない**。詳細仕様はユーザーの個人 docs（`~/projects/docs/claude-code-harness/`）に集約。

| Event | 実装 | 目的 |
|---|---|---|
| PreToolUse | inline | 機密ファイル書込 block (上記プロジェクトスコープと同等 + 拡張) |
| SessionStart | `~/.claude/hooks/session-start-plan-reminder.sh` | `~/.claude/plans/` の 14 日超 plan を stderr で通知 |
| Stop | `~/.claude/hooks/stop-worktree-warning.sh` | session 終了時に live worktree が複数あれば一覧を stderr で通知 |

## Phase 2 以降（計画中・未実装）

`docs/harness-ai-maintenance-plan.md` §4 に詳細。`docs/PENDING.md` で実施可否を判断する対象:

| Event | Matcher | 目的 |
|---|---|---|
| PostToolUse | `src/lib/prompts/**` | 対応する `docs/ai/prompts/*.md` に `stale: true` 付与 |
| PostToolUse | `src/lib/anthropic.ts` | `docs/ai/{guardrails,streaming}.md` を stale |
| SessionStart | - | stale 件数を stderr に警告 |
| Stop | - | セッション終了時の drift サマリ |

## 環境変数

hook 実行時に Claude Code が渡すもの:

- `CLAUDE_FILE_PATH`: Write/Edit/MultiEdit の対象ファイル絶対パス
- `CLAUDE_TOOL_NAME`: 呼ばれた tool 名
- `CLAUDE_PROJECT_DIR`: プロジェクトルート

## 追加・変更時の手順

1. `.claude/settings.json` に matcher と command を追記（または `~/.claude/settings.json` をいじるならそちらに）
2. **本 README の表に 1 行追加**（Event / Matcher / 目的 / 失敗時影響）
3. `.claude/README.md` の Hooks 表も更新（プロジェクトスコープの場合）
4. local 検証: 該当 tool を 1 度動かして hook が期待通り発火 / block するか確認
5. PR description に hook 追加の旨を明記

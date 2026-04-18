# Claude Code Hooks

`.claude/settings.json` に定義された hook の目的・matcher・影響を記録する。
新規 hook 追加時は本ドキュメントを必ず同時更新（drift 防止）。

## 一覧（現状: Phase 0）

| Event | Matcher | 目的 | 失敗時の影響 |
|---|---|---|---|
| PreToolUse | `Write\|Edit\|MultiEdit` | 機密ファイル書込を block | tool 実行が拒否される（exit 2） |
| PostToolUse | `Write\|Edit\|MultiEdit` | prettier --write 自動実行 | サイレント（`\|\| true`） |

## 1. PreToolUse: secret-block

### 目的
`.env*` / `.key` / `.pem` / `*credentials*` / `*service_role*` への書込を機械的に block。
エージェントが誤って秘密情報を commit する経路を物理的に遮断する。

### Matcher
`Write|Edit|MultiEdit`

### Command
```bash
f="${CLAUDE_FILE_PATH:-}"
case "$f" in
  *.env|*.env.*|*.key|*.pem|*credentials*|*service_role*)
    echo "BLOCK: refused to write secret-like file: $f" >&2
    exit 2
  ;;
esac
```

### 動作
- exit 2 で tool 実行を拒否、stderr メッセージを Claude に返却
- match しないパスは通過

### 例外運用
- 本当に `.env.example` を更新したい場合: 一時的に `.claude/settings.local.json` で override（gitignore 済）

## 2. PostToolUse: prettier auto-format

### 目的
書込・編集後のファイルを自動整形し、レビュー時の format diff ノイズを排除。

### Matcher
`Write|Edit|MultiEdit`

### Command
```bash
f="${CLAUDE_FILE_PATH:-}"
case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css)
    [ -f "$f" ] && npx --no-install prettier --write "$f" >/dev/null 2>&1 || true
  ;;
esac
```

### 動作
- 対象拡張子のみ整形
- `--no-install` で勝手に prettier を取りに行かない
- 失敗してもサイレント（`|| true`）

### 注意
- prettier がループして停止しない場合は本 matcher を一時 comment out（`docs/harness/runbook.md` トラブルシュート参照）

## Phase 2 以降（計画中）

`docs/harness-ai-maintenance-plan.md` §4 に詳細。

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

1. `.claude/settings.json` に matcher と command を追記
2. 本 README の表に 1 行追加（Event / Matcher / 目的 / 失敗時影響）
3. `.claude/README.md` の Hooks 表も更新
4. local 検証: 該当 tool を 1 度動かして hook が期待通り発火 / block するか確認
5. PR description に hook 追加の旨を明記

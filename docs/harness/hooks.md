# Claude Code Hooks

このリポジトリと、開発者個人のグローバル設定 (`~/.claude/settings.json`) で動いている hook を一覧化する。
新規 hook を足すときは本ファイルを必ず同時更新（drift 防止の一次ルール）。

## プロジェクトスコープ — `.claude/settings.json`

| Event | Matcher | 目的 | 失敗時の影響 |
|---|---|---|---|
| PreToolUse | `Write\|Edit\|MultiEdit` | 機密ファイル (`.env*` / `.key` / `.pem` / `*credentials*` / `*service_role*`) への書込 block | tool 実行が拒否される（exit 2） |
| PostToolUse | `Write\|Edit\|MultiEdit` | prettier --write を自動実行（ts/tsx/js/jsx/json/md/css） | サイレント（`\|\| true`） |
| PostToolUse | `Write\|Edit\|MultiEdit` | AI prompt drift 検知（`src/lib/prompts/*.ts` / `src/lib/anthropic.ts` を編集したら paired `docs/ai/**/*.md` の同時更新を確認、未同期なら STDERR 警告） | 警告のみ・exit 0（block しない） |

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

### 3. PostToolUse: AI prompt drift detection

#### 目的
`src/lib/prompts/*.ts` または `src/lib/anthropic.ts` を編集したとき、対応する `docs/ai/**/*.md` (人間向け正本) が working tree で同時に modify されているか自動 check。未同期なら STDERR で警告し、PR を出す前に CLAUDE.md 規約 (「prompts/* と docs/ai/prompts/*.system.md は同 PR で同期」) を破っていないか開発者に伝える。**block しない** — 警告のみ (typo fix や rename refactor で md 更新が不要なケースもあるため)。

#### Matcher
`Write|Edit|MultiEdit`

#### Command
```bash
bash "${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/ai-prompts-drift-check.sh"
```

#### Pairing source of truth
各 `docs/ai/prompts/*.system.md` 冒頭の YAML frontmatter `pairs_with: src/lib/prompts/<name>.ts` 行を grep して逆引きする。並列の register table を持たない (frontmatter が単一の真実源)。例: `coach.system.md` の `pairs_with: src/lib/prompts/coach-chat.ts` がペア定義。

`src/lib/anthropic.ts` だけは frontmatter で逆引きできないため、script 内に hardcoded で `docs/ai/guardrails.md` をペアと宣言。将来 `streaming.md` などを追加する場合は script の `paired_mds` 配列に append。

#### 警告パターン
3 種類の warn を出す:
1. **paired md 未同期**: 既知ペアの md が working tree で修正されていない → 「同 PR で更新してください」
2. **paired md 不在**: prompts file は edit したが pair frontmatter を持つ md が見つからない (新規 prompt の発見シグナル) → 「md を追加するか script を拡張してください」
3. (silent): paired md が dirty (staged or unstaged) → OK, 警告なし

#### トラブル
- 警告が誤発火する (md 編集を別 commit でやりたい場合): exit 2 ではないので無視可。本当に煩わしければ commit message に `[no-drift]` 等の慣用語を入れて反映する規約は今のところなし
- 新しい prompt file を追加して "no paired md" 警告: `docs/ai/prompts/<name>.system.md` を作成し frontmatter `pairs_with: src/lib/prompts/<name>.ts` を入れれば次回から消える

## グローバルスコープ — `~/.claude/settings.json`

開発者個人が `~/.claude/` に持つ設定。プロジェクトを跨いで効くため、**Haretoki 単体で完結しない**。詳細仕様はユーザーの個人 docs（`~/projects/docs/claude-code-harness/`）に集約。

| Event | 実装 | 目的 |
|---|---|---|
| PreToolUse | inline | 機密ファイル書込 block (上記プロジェクトスコープと同等 + 拡張) |
| SessionStart | `~/.claude/hooks/session-start-plan-reminder.sh` | `~/.claude/plans/` の 14 日超 plan を stderr で通知 |
| Stop | `~/.claude/hooks/stop-worktree-warning.sh` | session 終了時に live worktree が複数あれば一覧を stderr で通知 |

## Phase 2 以降（計画中・未実装）

`docs/harness-ai-maintenance-plan.md` §4 に詳細。`docs/PENDING.md` で実施可否を判断する対象:

| Event | Matcher | 目的 | 状態 |
|---|---|---|---|
| PostToolUse | `src/lib/prompts/**` & `src/lib/anthropic.ts` | paired md 未同期を STDERR 警告 | ✅ 実装済（上記 §3） |
| PostToolUse | `src/lib/prompts/**` | md frontmatter に `stale: true` 自動付与 | 計画中（警告だけで十分なら不要） |
| SessionStart | - | stale 件数を stderr に警告 | 計画中 |
| Stop | - | セッション終了時の drift サマリ | 計画中 |

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

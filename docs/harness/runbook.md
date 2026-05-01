# Haretoki Harness Runbook

並列開発・worktree・tmux・AgentTeams の実行手順書。
`CLAUDE.md` の「Ship Cycle」と `~/.claude/rules/agents.md` の内容をプロジェクト固有に展開。

## TL;DR（最頻出フロー）

```bash
# 1. 新規ブランチを worktree で切る
.claude/scripts/worktree-create.sh feat/my-feature develop

# 2. 作業
cd ../haretoki-wt-feat-my-feature
# ...implement...

# 3. 検証（must-all-pass）
npm run lint && npx tsc --noEmit && npm test
npx playwright test --project="Mobile Chrome"

# 4. Ship
git push -u origin feat/my-feature
gh pr create --base develop
# merge 後:
# slash skill 経由で deploy（raw `vercel --prod` ではない）
.claude/scripts/worktree-clean.sh feat/my-feature
```

## 並列開発（2+ 独立タスク時は必ず）

### 決定フロー

1. architect agent で影響範囲分析・分解
2. 各単位で共有ファイル（`prisma/schema.prisma` / `package.json` / `DESIGN.md` / `src/app/(app)/layout.tsx`）との衝突を確認
3. 衝突なし → 並列、衝突あり → single-writer
4. 共通基盤は先に単独で整える

### git worktree ベース分離

- 1 タスク = 1 worktree（`../haretoki-wt-<branch-sanitized>`）
- base は常に `develop`
- `.env.local` は `worktree-create.sh` 内で自動コピー
- 終了時は必ず `worktree-clean.sh` で branch + directory を一括削除

### tmux レイアウト（N タスク並列時）

**原則: チャットペインは絶対に潰さない。N+1 ペイン構成。**

```bash
# 現在のウィンドウから split を順次追加
tmux split-window -d -t "$PANE" -v   # viewer pane 追加（focus を奪わない）
tmux select-pane -T "routes (P1/N)"  # ペインタイトル設定
tmux set -g pane-border-status top
tmux set -g pane-border-format " [#{pane_index}] #{pane_title} "
tmux select-layout tiled
tmux select-pane -t .0               # chat pane に focus 戻す
```

各 viewer は subagent の JSONL output を jq で整形して `tail -f`。
進捗に応じて `select-pane -T` でタイトルを `"(P1/N) 実行中"` → `"(P1/N) 完了"` に更新。

### AgentTeams（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`）

- 2+ 独立タスクで常に使用（逐次しない）
- 各メンバーに **具体ファイルパスとスコープ** を明示
- 共有コンポーネントは先に単独実装

### Agent(isolation: "worktree") で並列 subagent を飛ばすときの注意

Claude Code の `Agent` tool に `isolation: "worktree"` を渡すと、`.claude/worktrees/agent-<id>/` に自動で worktree が切られて worker が走る。ただし **作成される worktree の base は develop の現 HEAD ではなく、古い merge-base** になることがある (2026-04-20 確認)。対策を worker の prompt に必ず入れる:

1. **prompt 冒頭で rebase を明示**: 「作業開始前に `git rebase origin/develop`、conflict なら abort してログに記録して報告」
2. **必ずコミットさせる**: worker が完了報告だけしてコミットしないと orchestrator 側で cp する羽目になる。prompt に「最後に `git status` で変更を確認し、`git commit` で 1 コミットにまとめる」を明示
3. **進捗ログを `/tmp/haretoki-worker-<A|B|...>.log` に書き出させる**: tmux viewer pane は `tail -f` でここを見る
4. **他 worker のスコープを列挙**: 「worker-B が `foo.tsx` を触るので絶対 touch しない」と書くと衝突が減る

orchestrator 側の取り込み手順:
```bash
# worker が正しく commit している場合: cherry-pick が基本
git cherry-pick <worker-sha>
# conflict が出る場合 (worker の base が古い) は 3-way apply にフォールバック:
git format-patch -1 <worker-sha> --stdout | git apply --3way -
# マーカー解消 → add → commit --reuse-message=<worker-sha>
```

取り込み後は `git worktree remove -f -f <path>` + `git branch -D <worker-branch>` で掃除。`-f -f` (2 回) は lock 解除に必要。

## Ship Cycle（CLAUDE.md 準拠、省略しない）

1. **E2E**: `npx playwright test --project="Mobile Chrome"` PASS
2. **develop merge**: worktree 作業は develop にマージ（main ではない）
3. **push**: `git push origin develop`
4. **本番 deploy**: `vercel:deploy` skill の `prod` 引数経由
5. **worktree 掃除**: `git worktree remove` + branch 削除

途中で止めない。ローカル commit のみ / 未 deploy / worktree 残置は禁止。

## スキル・エージェントの呼び分け

| 状況 | 呼び出すもの |
|---|---|
| 新機能・大きめリファクタ | architect agent → parallel-feature skill |
| バグ報告 | parallel-bug skill（root cause → 修正 → 回帰防止） |
| 実装完了後 | parallel-review skill（reviewer + typescript-reviewer + security-reviewer） |
| UI コンポーネント新規 | design-principles skill + refero-design skill |
| DB スキーマ変更 | db-designer agent（single-writer） |
| Vercel 関連 | `vercel:*` skill 群 |
| Next.js / library ドキュメント疑問 | context7 MCP（[mcp.md](mcp.md) §3） |
| 新画面・コンポーネントの研究 | refero MCP（[mcp.md](mcp.md) §3） |
| Vercel deploy / runtime logs / build status | vercel MCP（[mcp.md](mcp.md) §3） |
| Figma URL を渡された | figma MCP（[mcp.md](mcp.md) §3） |
| 本番エラー triage / SQL 監査 | sentry / postgres-ro MCP（[mcp.md](mcp.md) §2、project MCP は `.mcp.json` で enable） |

## Model / Prompt 変更時

- モデル ID: `docs/ai/models.md` → `src/lib/models.ts` → 各 action / API route
- プロンプト: `docs/ai/prompts/<name>.md` → `src/lib/prompts/<name>.ts` を同 PR で同期
- Phase 2 以降は PostToolUse hook が drift を検知し、SessionStart で「stale 件数」が警告される

## Architecture Decision Records (ADR)

取り返しのつかない / 取り返しに重い決定 (フレームワーク採用、DB 戦略、auth 方針、prompt 正本配置、UX 不可逆な決定) は `docs/harness/adr/` に Nygard 形式で 1 本書く。

- 運用ガイド・テンプレ・命名規約: [`adr/README.md`](adr/README.md)
- 既存 ADR は `adr/<NNNN>-<title>.md`
- Status は `Proposed → Accepted → (Deprecated | Superseded by NNNN)`
- 書く / 書かないの判断: 6 ヶ月後に同じ判断を聞かれて理由を即答できないなら書く
- Decision を書き換えない。変えるなら新 ADR を起票し旧 ADR を `Superseded by NNNN` にする

## Secret / 危険操作

- `.env*` / `.key` / `.pem` / `*credentials*` は PreToolUse hook が block（`.claude/settings.json`）
- `git push --force` / `git reset --hard` / `prisma migrate reset` はユーザー承認必須
- `vercel env rm` 本番変数削除は事前に backup + 確認

## トラブルシュート

- **prettier hook がループ**: `.claude/settings.json` の PostToolUse matcher を一時 comment out
- **worktree 作成失敗（branch exists）**: `worktree-clean.sh <branch>` で旧 branch 除去
- **Claude API 429/529**: `src/lib/anthropic.ts` の `withRetry` が exponential backoff で処理（最大 3 回）
- **SSE hang**: `streamClaude` 内 30s `AbortController` で強制終了
- **Shell cwd が消えた worktree を指して動かない**: 別ディレクトリへの `cd` を含むコマンドを 1 回流せばリセットされる

## tmux 多ペイン並列運用（中央 + N worker）

並列で 2 つ以上の Claude セッションを別 tmux ペインで走らせる場合、**1 人を中央コーディネーターとして実装しない / 残りを worker** という役割分担で動かす。

### Worker のルール（明示通知すること）

1. 自分の `feat/<id>-pane<NN>` ブランチで commit
2. origin に branch push まではやる
3. **develop merge / `vercel --prod` は禁止、中央が引き受ける**
4. 完了したら中央に `tmux send-keys` 経由で通知

### Central のループ

```bash
# 1. worker 完了通知を受けたら同期
git fetch && git checkout develop && git merge --ff-only origin/develop

# 2. worker branch を merge（複数 worker なら順次）
git merge --no-ff feat/<branch> -m "merge: <summary>"

# 3. 検証
npx tsc --noEmit && npm run lint && npm test && npm run build

# 4. 動的スモーク必須（lessons.md 2026-04-30 参照）
#    実機ブラウザ（375px）で該当機能を叩く

# 5. push + deploy
git push origin develop
vercel --prod --yes        # main worktree から、または一時 worktree

# 6. runtime logs で error 0 件確認
#    MCP: mcp__plugin_vercel_vercel__get_runtime_logs
#    projectId / teamId は .vercel/project.json から

# 7. worker に完了通知 + 次タスク GO
tmux send-keys -t 0:0.X '完了通知 + 次の指示' Enter
```

### `tmux send-keys` の罠

`tmux send-keys -t 0:0.X 'message' Enter` を実行しても、**相手 TUI の入力欄にメッセージが貼り付くだけで submit されないことがある**（Claude Code TUI の入力ハンドリング由来）。

対策:

```bash
# 送信後に必ず capture-pane で動作中サインを確認
tmux send-keys -t 0:0.X 'message' Enter
sleep 2
tmux capture-pane -t 0:0.X -p | tail -5
# Running… / Kneading… / Burrowing… 等が無ければ submit 失敗
```

submit 失敗時の対応:
1. 空 Enter を送る: `tmux send-keys -t 0:0.X '' Enter`
2. `C-m` 試す: `tmux send-keys -t 0:0.X 'message' C-m`
3. **ユーザーに「pane 0:0.X で Enter 押してください」と頼む**（最確実）

### 中央交代（handoff）

中央セッションを別端末・別ペインに引き継ぐとき:

1. 引継ぎ書を `/tmp/haretoki-central-handoff.md` に書く（repo 状態、進行中タスク、protocol、教訓、Vercel IDs を含む）
2. 新中央のペインに「`/tmp/haretoki-central-handoff.md` を Read で全部読んでから動け」と send-keys
3. 全 worker pane に「中央が pane 0:0.X に変更、今後の完了通知は 0:0.X へ」と通知
4. 旧中央は数往復は監視を続ける（新中央が機能してることを確認してから降りる）

### Orphan commit 救出

並列セッションが両方 develop に直接 commit して片方が merge で orphan 化した場合:

```bash
# 1. orphan SHA を reflog で発見
git reflog --date=iso | head -20
# HEAD@{n}: commit: <message> がそれ

# 2. 即座に branch 化（auto-GC が 30 日後に走るが、安全のため即実行）
git branch <recover-branch-name> <SHA>

# 3. diff 確認
git show <SHA>

# 4. 後で「両方の良いとこ取り refactor」を develop 上に手動で重ねる
#    layout / structure 等の equivalent 差分は取り込まない（churn 回避）
#    docs JSDoc / interaction state / a11y 改善 のみ取り込む
```

詳細は `docs/lessons.md` の「2026-04-30: 並列セッション衝突 + /mypage SSR 事故」参照。

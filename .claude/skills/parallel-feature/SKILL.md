---
name: parallel-feature
description: 中〜大規模な新機能やリファクタを、architect→分割→implementer 並列→reviewer→tester の流れで回す playbook。複数ファイル・複数ルートに跨る変更や、Phase単位の実装で使う。
paths:
  - "src/**/*.{ts,tsx,js,jsx}"
  - "tests/**/*"
  - "prisma/**/*"
---

# parallel-feature

中〜大規模な追加開発を **安全に並列化** するための playbook。

## いつ使うか
- 仕様を実装に落とす段階
- 想定変更ファイル数が 5+ 個、または 2+ ルート/コンポーネント領域に跨る
- 並列化で時間短縮できる見込みがある

## 使わない（=single-writer に倒す）
- 1 ファイルだけ触る修正
- prisma/schema.prisma を変更する（migration順序が重要）
- DESIGN.md / package.json / next.config.ts の本体を書き換える
- 強い順次依存（Aの結果を見てBを設計）

## 手順

### 1. Architect 起動（必須）
```
Agent(subagent_type="architect", prompt="
仕様: <要件 or spec doc path>
出力: scope / 影響ファイル / 並列単位 / 推奨実行モード
")
```
返ってきた **Decomposition** と **Execution mode** を必ず読む。

### 2. 実行モード判定（architect の推奨を尊重）

| 状況 | 採用モード |
|---|---|
| 単位が 1 個 | single-writer（直接実装） |
| 単位が 2-3 個、共有ファイル無し | subagent 並列（implementer × N） |
| 単位が 4+ 個、長期、ブランチ分離欲しい | **agent-team + git-worktree** |
| Foundation→並列に分けるべき | foundation を single-writer で先行 → 完了後に並列 |

### 3a. subagent 並列モード
- 同一ターン内で複数の `Agent(subagent_type="implementer", ...)` を発行
- 各implementerに「触ってよいファイル/領域」を**明示**
- 親が結果を統合

### 3b. agent-team + worktree モード
1. Foundation を single-writer で先に完成 → develop に merge（並列前提を整える）
2. tmuxペイン分割を確認（`tmux list-panes`）
3. `.claude/scripts/worktree-create.sh feat/<name>` で各 implementer 用 worktree を作成
4. TeamCreate で team を編成し、各メンバーに以下を伝える:
   - 担当ブランチ + worktreeパス
   - 触ってよいファイル/領域
   - **触ってはいけないファイル**（共有定数、layout、schema 等）
   - 完了時の検証コマンド
5. 親（lead）は TaskList でモニタ

### 4. レビュー（必須、reviewer agent）
各 implementer 完了後に必ず:
```
Agent(subagent_type="reviewer", prompt="
diff: git diff develop...HEAD
spec: <元の要件 or architect レポート>
")
```
CRITICAL/HIGH があれば implementer に投げ返す。

### 5. テスト（必須、tester agent）
```
Agent(subagent_type="tester", prompt="変更スコープ: <files>")
```
PASS まで戻る。

### 6. Ship Cycle 完走（CLAUDE.md 規約）
- E2E `npx playwright test --project="Mobile Chrome"` 通過
- develop へ merge
- `git push origin develop`
- `vercel:deploy` skill (`prod` 引数) で本番デプロイ
- worktree 掃除: `.claude/scripts/worktree-clean.sh feat/<name>`

## 完了条件
- [ ] architect レポートを保存または会話に残した
- [ ] 全 implementer タスクが reviewer Approve
- [ ] tester 全 PASS
- [ ] develop マージ + Vercel prod 反映
- [ ] worktree 掃除済み

## アンチパターン回避
- ❌ 同一ファイルを 2 つの implementer に書かせる
- ❌ Foundation 未完成のまま並列に入る
- ❌ Reviewer をスキップ
- ❌ team でも prisma migration を並列化する

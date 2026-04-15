---
name: parallel-review
description: 実装完了後のレビューを多視点で並列実行し、指摘を反映するまでの playbook。PR作成前、merge前、Phase完了時に使う。
---

# parallel-review

実装完了 → 多角レビュー → 指摘反映 → 検証 → merge の流れ。

## いつ使うか
- 機能実装が一区切りついた
- PR を作る / merge する直前
- Phase 完了時の最終確認

## 使わない
- 1 行の typo 修正
- ドキュメントだけの変更

## 手順

### 1. レビュー対象を確定
```
git diff develop...HEAD --stat
```
変更ファイル一覧と件数を把握。

### 2. 並列レビュー（同一ターンで複数 agent）
**1 ターンで複数 Agent を発行** して並列モニタ:

| Agent | model | 観点 |
|---|---|---|
| reviewer (本リポ) | opus | 仕様/品質/UI/UX/security 総合 |
| typescript-reviewer or vercel:react-best-practices | sonnet | 型・hook・パフォーマンス |
| security-reviewer | sonnet | 機密・認可・入力検証（対象: server actions / API ） |

UIに変更があれば追加で:
- ui-ux-reviewer または ui-ux-pro-max（必要時）

### 3. 指摘の優先度判定
- **CRITICAL**: 必ずブロック。即修正
- **HIGH**: merge前修正
- **MEDIUM**: 同一PR or follow-up Issue
- **LOW**: ノートのみ

### 4. 反映
- single-writer で順次反映（並列にすると競合）
- 反映後の差分を再度 reviewer に投げて Approve をもらう

### 5. テスト（tester agent）
全 PASS まで。

### 6. 完了
- develop へ merge
- push
- `vercel:deploy prod` で本番反映（CLAUDE.md Ship Cycle）

## 完了条件
- [ ] 全 reviewer から Approve
- [ ] CRITICAL/HIGH 0件
- [ ] tester PASS
- [ ] CHANGELOG / docs 更新（必要なら）
- [ ] develop merge + Vercel prod 反映
- [ ] worktree 掃除

## アンチパターン
- ❌ Reviewer が「修正もする」（read-only に徹する）
- ❌ 並列 reviewer の指摘を統合せずに修正する（重複/矛盾）
- ❌ Approve 前に merge

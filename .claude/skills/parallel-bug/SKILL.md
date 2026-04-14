---
name: parallel-bug
description: バグ報告や予期しない挙動を、root-cause 調査 → 修正 → 回帰防止テストの流れで潰す playbook。複数原因や複数画面に跨る不具合、本番障害、E2E失敗の調査に使う。
---

# parallel-bug

バグ修正を **根本原因 driven** で安全に処理する playbook。

## いつ使うか
- ユーザー報告のバグ（例: problems_01.md）
- E2E / unit テスト失敗
- 本番障害（500, error.tsx, 沈黙する Server Action）
- 「なぜか動かない」系の調査

## 使わない
- 既知の typo 修正（直接実装でOK）
- スコープが完全に1ファイルかつ自明な fix

## 手順

### 1. 症状を 1 行に固定
- 再現条件、影響範囲、エラーメッセージを書き出す
- ユーザー語彙そのまま貼る（推測しない）

### 2. 原因調査（並列可、subagent推奨）
症状が独立に起きている **複数原因の可能性** がある場合（例: problems_01 のような複合報告）:
```
複数の Agent(subagent_type="general-purpose", model="opus") を **同一ターンで並列起動**:
- agent A: 機能X の根本原因（ファイル/行/想定修正）
- agent B: 機能Y の根本原因
- agent C: パフォーマンス監査
各agentは「コードを読むだけ、修正しない」と明示
```

症状が単発なら subagent 不要、その場で `superpowers:systematic-debugging` を起動。

### 3. 根本原因を仮説→検証
推測で修正しない。
- 仮説 A,B,C を立てる
- 最も検証コストが低いものから:
  - 該当ファイルを Read
  - `git log -- <file>` で最近の変更を見る
  - ユニットテストを 1 本書いて再現確認
- 検証できた根因のみ修正対象とする

### 4. 修正（single-writer 推奨）
- バグ修正は **原則 single-writer**（同一ファイルの可能性が高く、並列は事故る）
- 複数ファイルに跨る独立修正で、かつ依存が無い場合のみ subagent 並列
- ブランチ: `fix/<short-name>`

### 5. 回帰防止テスト（必須）
修正と同じコミットに:
- ユニットテスト or E2E テストを 1 本以上追加
- そのテストは **修正前なら fail / 修正後は pass** であることを確認

### 6. レビュー（reviewer agent）
```
Agent(subagent_type="reviewer", prompt="diff: ..., 元バグ: ...")
```
「修正が症状をカバーしているか」「副作用は無いか」を確認。

### 7. テスト（tester agent）
```
Agent(subagent_type="tester", prompt="変更スコープ: <files>")
```
PASS まで戻る。

### 8. Ship Cycle 完走
- E2E pass
- develop merge → push → vercel prod
- 本番障害だった場合は production deploy まで完了して初めて「修正完了」

## 完了条件
- [ ] 根本原因を `file:line` で特定（症状ベースの対症療法は不可）
- [ ] 回帰防止テスト追加
- [ ] reviewer Approve
- [ ] tester PASS
- [ ] develop merge + Vercel prod 反映
- [ ] ユーザー報告者に「本番で再確認できる URL」を返す

## アンチパターン
- ❌ ログだけ追加して「修正完了」
- ❌ try/catch で握りつぶす（CLAUDE.md違反）
- ❌ 「再現できない＝直った」と判定
- ❌ 回帰テスト無しで merge

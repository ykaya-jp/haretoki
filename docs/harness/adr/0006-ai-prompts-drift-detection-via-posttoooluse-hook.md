# 0006. AI prompts drift 検知を PostToolUse hook + warn-only で実装する

- **Status**: Accepted
- **Date**: 2026-05-02
- **Deciders**: yusuke.kaya

## Context

ADR-0005 で全 10 Claude prompt の正本を `docs/ai/prompts/*.system.md` に置き、
TS コードはその実装ペアとして同 PR で同期する規約を確立した。
ただし 0005 の "Consequences" にも明記されている通り、**drift 検知 hook が無い間は人手で同期が必要**で、
md が古くなる risk が残っていた。

Phase 2.A での md 化完了直後の状態:

- 全 10 ペア (`src/lib/prompts/<name>.ts` ↔ `docs/ai/prompts/<name>.system.md`) が揃った
- 各 md の冒頭に `pairs_with: src/lib/prompts/<name>.ts` の YAML frontmatter があり、md → ts のペア定義は明示
- `CLAUDE.md` / `AGENTS.md` の "AI Call Conventions" に「md と ts を 1 PR で揃える」規約あり
- ただし規約は人間 / AI agent の規律で守られているだけで機械的な検知が無く、片方だけ修正した PR が物理的に通る
- 同様に `src/lib/anthropic.ts`（PII / sanitize / retry / streaming の library 層）と `docs/ai/guardrails.md` の同期も人手依存

`harness-ai-maintenance-plan.md` Phase 2 は当初「PostToolUse hook で md 自動的に `stale: true` 付与」を構想していたが、
実装前に再評価した時点で以下が見えた:

- `stale: true` を機械的に付けると、md と ts が **「同 PR で更新済みかどうか」** ではなく **「last_synced 以降に ts が変わったか」** という別問題を解くことになる
- typo fix / rename refactor では md 更新が要らないが、`stale: true` を立てると次回読み手に余計な雑音
- 実際に欲しいのは「**この PR / セッションで md と ts が両方触られているか**」のチェック → ワーキングツリーの dirty 状態でチェックすれば足りる

## Decision

**`.claude/settings.json` の PostToolUse hook + `.claude/scripts/ai-prompts-drift-check.sh` で warn-only の drift 検知を実装する。** 具体仕様:

1. **発火条件**: `Write|Edit|MultiEdit` ツールが `src/lib/prompts/*.ts` または `src/lib/anthropic.ts` を編集したとき
2. **ペア解決**: prompts 側は md frontmatter `pairs_with: <ts path>` を `grep -l` で逆引き (md frontmatter が単一の真実源、parallel registry を作らない)。`anthropic.ts` だけ script 内に hardcoded で `docs/ai/guardrails.md` を pair 宣言
3. **判定**: `git status --porcelain -- <md>` で paired md が dirty なら OK、empty なら未同期
4. **警告のみ・block しない**: PostToolUse の exit 0 で STDERR に WARN メッセージ。`exit 2` (block) は採用しない (typo fix / rename refactor で md 更新が不要なケースで邪魔になるため)
5. **ドキュメント**: `docs/harness/hooks.md` の Project-scope 表に正式 hook として登録、`.claude/README.md` の Hooks セクションも追従

## Consequences

良かった点:

- **md / ts 同期規約が機械的にチェックされるようになった**: AI agent が片方だけ更新する事故が即座に表面化
- **frontmatter `pairs_with` が単一の真実源**: 別ファイルに pair table を持たないので、md を移動 / リネームしてもペア解決が壊れない
- **警告のみなので「規約に外れる例外」を許容できる**: typo / rename はそのまま通せる、本当の drift だけ目立つ
- **0005 の "drift 検知の計画 (未実装)" Consequences が解消**: harness-ai-maintenance-plan Phase 2 のうち最重要部が実装完了

悪かった点 / 後始末:

- **`.claude/settings.json` 編集者が `docs/harness/hooks.md` も同時更新する規律が必要**: 同種の drift だが、これは hook 自体の対象外 (規約で守る)
- **ローカルで `git` が走らないと no-op**: detached state や git installed されていない CI 環境では fallback で silent。production CI で再検査するレイヤーは別途必要 (今回は scope 外)
- **新規 prompts file 追加時の "no paired md" warn は人手で md を作らないと消えない**: 自動で skeleton 生成する案はあるが、md は「何を / なぜ」を書く性質上、AI/人間判断を要するため自動化しない判断
- **`CLAUDE_PROJECT_DIR` 環境変数に依存**: 将来 Claude Code が変数名を変えると script を追従させる必要 (`docs/harness/hooks.md` "環境変数" セクションが台帳)

## Alternatives considered

- **md に `stale: true` を自動付与する write hook**: 当初プラン。「last_synced 以降に ts が変わったか」を解いてしまうので欲しい問題と微妙に違う。読み手にも余計な雑音
- **`exit 2` で block**: 規約違反を物理的に防げるが、typo fix / rename refactor の通常作業を阻害する。warn-only の方が信号 / ノイズ比が良い
- **CI 側 (GitHub Actions) で drift check**: PR 単位なら可能だが、ローカル開発のフィードバックループが遅く、AI agent が PR 出すまで気づかない。PostToolUse hook の方が AI agent にも開発者にも近い
- **frontmatter ではなく別 YAML 設定 file (e.g. `docs/ai/prompts/_pairs.yaml`)**: 検索 / 移動コストは低いが、md と分離した瞬間にそれ自体が drift する

## References

- 前提となる ADR: [0005 Claude prompt canonicalization in md](./0005-claude-prompt-canonicalization-in-md.md)
- 実装: `.claude/scripts/ai-prompts-drift-check.sh` / `.claude/settings.json` / `docs/harness/hooks.md` §3
- 計画書: `docs/harness-ai-maintenance-plan.md` Phase 2 (本 ADR で完了、stale: true 自動付与は採用せず Phase 3 で再検討)
- PENDING.md L162: 本ADRで close
- 関連 ADR: なし (将来 SessionStart / Stop に拡張するときに別 ADR 起票)

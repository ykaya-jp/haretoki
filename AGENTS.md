# AGENTS.md — Haretoki

このファイルは AI コーディングエージェント（Claude Code / Codex / Cursor / その他）のための入口です。人間向けの README は `README.md` を参照してください。

## Quick Orient

- プロダクト: 結婚式場比較・評価・最終決定支援の Web アプリ（モバイルファースト 375px）
- スタック: Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma + Supabase + Claude API
- パッケージマネージャ: npm（pnpm / yarn に切り替えない）
- ブランチ運用: `main`（本番）/ `develop`（統合）/ `feat|fix|docs/*`（作業ブランチ）

## Must-Read（着手前に必ず読む）

1. `CLAUDE.md` — プロジェクトルール・用語対応表・Ship Cycle
2. `docs/roadmap.md` — 現在のリリース状態
3. `DESIGN.md` — デザインシステム（Single Source of Truth）
4. `docs/ai/models.md` — どの機能で何のモデルを使うか
5. `docs/ai/guardrails.md` — PII / prompt injection / コスト上限
6. `docs/harness/runbook.md` — 並列開発・worktree・tmux 手順
7. `docs/harness/hooks.md` — `.claude/settings.json` の hook 定義
8. `.claude/README.md` — agents / skills / commands / hooks 一覧

## Conventions（違反しない）

- 日本語で応答。コメント・コミットは英語
- モバイル 375px 基準。タップターゲット最低 44px (`h-11`)
- 見出し font-weight 300-400（太字禁止）
- 式場名に Noto Serif JP、数値に `tabular-nums`
- Server Components デフォルト、`"use client"` は必要時のみ
- DB 直叩き禁止（Server Actions / Route Handler 経由）
- 機密情報を commit しない（`.env` / `.key` / `credentials` は PreToolUse hook で block）

## Safe Commands（AI が自由に走らせて良い）

| Command | Purpose |
|---|---|
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:e2e -- --project="Mobile Chrome"` | Playwright |
| `npx tsc --noEmit` | 型チェック |
| `npx prisma generate` | Prisma Client 再生成 |
| `git status` / `git diff` / `git log` | 調査系すべて |

## Dangerous Commands（ユーザー承認必須）

- `git push --force`、`git reset --hard`、`git branch -D`
- `npx prisma migrate reset`、`npx prisma db push`（本番 DB）
- `vercel --prod`、`vercel env rm`
- `.env*` / `prisma/schema.prisma` / `next.config.ts` / `package.json` の編集は scope に明示された時のみ

## AI Call Conventions

- Claude API 呼び出しは `src/lib/anthropic.ts` の `askClaude` / `streamClaude` 経由（singleton / retry / 30s timeout）
- プロンプトは `src/lib/prompts/*.ts` に集約、編集時は対応する `docs/ai/prompts/*.md` も同期
- モデル ID は `docs/ai/models.md` の定数表に従う（旧 `claude-sonnet-4-20250514` は使用禁止）
- ユーザー由来の文字列は必ず `sanitizeForPrompt` + `<user_data>` タグで囲む
- PII は `stripPII` で除去してからログ / history に保存

## Task Completion Checklist

- [ ] `npm run lint` pass
- [ ] `npx tsc --noEmit` pass
- [ ] 関連 test 追加 / 更新
- [ ] 375px mobile で動作確認
- [ ] 変更範囲に対応する `docs/ai/**` または `docs/harness/**` 更新
- [ ] Ship Cycle（E2E → develop merge → push → `vercel:deploy prod` → worktree clean）

## Escalation

- 仕様不明: `docs/roadmap.md` → `CLAUDE.md` → ユーザーに確認
- 設計判断: `.claude/agents/architect.md` を呼ぶ
- 競合しそう: `prisma/schema.prisma` / `src/app/(app)/layout.tsx` / `package.json` / `DESIGN.md` は always single-writer

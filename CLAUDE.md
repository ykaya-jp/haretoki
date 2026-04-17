# Haretoki (晴れ時)

## Overview
結婚式場の比較・評価・最終決定を支援するWebアプリ。AIコーチが二人の好みを理解し、見積もりの落とし穴を先回りで教え、自然に式場選びを導く。モバイルファースト（375px基準）、商用化を視野に入れている。

## Product Vision
「式場選びを、もっと納得のいくものに。」— 式場を「売る」メディアではなく、カップルの「選ぶ」を支援する中立ツール。
ブランドメタファー: 曇り（不安）→ 晴れ間（見えてきた）→ 晴れの日（確信と喜び）

## Roadmap & Design Docs
- IMPORTANT: [docs/roadmap.md](docs/roadmap.md) — 統合ロードマップ（Release 1-4）。機能スコープとAI境界の判断はここを参照
- IMPORTANT: [DESIGN.md](DESIGN.md) — デザインシステム（Single Source of Truth）
- IMPORTANT: [docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md](docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md) — 非機能要件（パフォーマンス予算、楽観的更新、バンドル管理）。実装時に必ず準拠すること
- [docs/myreview/problems_02.md](docs/myreview/problems_02.md) — 最新ユーザー(妻)フィードバック。現行 audit 計画の原典
- 過去 Release 技術仕様・v2 UI 仕様は [docs/archive/](docs/archive/) に移動済み。必要なときだけ参照

## Tech Stack
- Framework: Next.js 16 (App Router) + TypeScript 5.x
- Styling: Tailwind CSS + shadcn/ui
- Database: PostgreSQL via Supabase
- ORM: Prisma
- Auth: Supabase Auth（Email + Google OAuth）
- Storage: Supabase Storage（式場写真・見積もりPDF）
- Test: Vitest (unit) + Playwright (E2E)
- Animation: framer-motion
- Form: react-hook-form + zod
- Package Manager: npm
- Hosting: Vercel (Frontend) + Supabase (DB/Auth/Storage)

## Project Structure
```
src/
  app/           # Next.js App Router ページ・レイアウト
  components/    # UIコンポーネント（shadcn/ui ベース）
  lib/           # Supabaseクライアント、ユーティリティ、定数
  server/        # Server Actions、サーバーサイドロジック
  hooks/         # カスタムReact Hooks
  types/         # 共通の型定義
prisma/
  schema.prisma  # データモデル定義
  migrations/    # マイグレーション履歴
scripts/         # データ収集・分析（Python: pandas, BeautifulSoup）
tests/           # テスト（__tests__/ ではなくここに集約）
public/          # 静的アセット
docs/            # 仕様書・設計ドキュメント
```

## Commands
- `npm run dev` — 開発サーバー（http://localhost:3000）
- `npm run build` — プロダクションビルド
- `npm test` — Vitest ユニットテスト
- `npm run test:e2e` — Playwright E2E テスト
- `npm run lint` — ESLint
- `npx prisma db push` — スキーマをDBに反映
- `npx prisma generate` — Prisma Client 再生成
- `npx prisma migrate dev --name <名前>` — マイグレーション作成
- `npx prisma studio` — DB GUI

## Verification
- 変更後は `npm run lint && npm test` で確認する
- DB関連の変更後は `npx prisma generate && npm run build` でビルドが通ることを確認する
- IMPORTANT: テストが通らない状態でコミットしない
- UI変更はモバイルビューポート（375px幅）で必ず確認する

## Ship Cycle（一区切りごとの標準フロー）
IMPORTANT: 機能実装・バッチ修正など「一区切り」が完了したら、必ず以下を**最後まで**実行する。中途半端な状態（ローカルコミットのみ、未デプロイ、worktree残置）で止めない。

1. **E2Eテスト** — `npx playwright test --project="Mobile Chrome"`。通らないまま先に進まない
2. **developブランチへマージ** — worktree作業時は develop にマージする
3. **push** — `git push origin develop`
4. **本番デプロイ** — `vercel:deploy` スキル経由（`prod` 引数）で実行。raw `vercel --prod` CLI ではなくスキルを使う
5. **worktree掃除** — worktreeを使った場合は `git worktree remove` + ブランチ削除まで完了させる

並列タスクがあるときは tmux ペイン分割 + git worktree + AgentTeams で並列実行する（逐次しない）。共通基盤は先に単独で整えてから並列に入る。

## Architecture Decisions
- Server Components をデフォルトとし、インタラクションが必要なコンポーネントだけ "use client" をつける
- データ取得は Server Actions または Route Handlers 経由。クライアントから直接 Supabase を叩かない（RLS は補助的な安全装置として使う）
- 画像は Supabase Storage に保存し、Next.js Image コンポーネントで最適化配信する
- 環境変数は .env.local に置き、.env.example にキー名だけ記録する。IMPORTANT: 秘密情報をコミットしない
- Supabase の型は `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts` で自動生成する。手書きしない

## App Structure (v2 — redesigned)
4タブ構成: ホーム / 探す / 候補 / コーチ
- ホーム: AIインサイトカード + 進捗リング + 最近見た式場 + クイックアクション
- 探す: 式場カードブラウズ + フィルタチップ + 式場追加
- 候補: ショートリスト + 比較ボード + 最終決定
- コーチ: AIインサイトカードフィード + チャットバー

初回のみAI対話オンボーディング（3-4問で好み把握→式場提案）。
6ステップ進捗バーは廃止。進捗は控えめなリング表示のみ。

## Domain Model（主要エンティティ）
- Project: カップル単位のプロジェクト。ProjectMember(owner/partner)で共有
- Venue: 式場の基本情報（名前、住所、アクセス、収容人数、ステータス）
- VenueScore: 式場の評価スコア（次元×ソース別、UNIQUE制約あり）
- Estimate / EstimateItem: 見積もり（バージョン管理、カテゴリ別項目）
- Visit / VisitRating / VisitNote: 見学記録（チェックリスト、メモ、写真、評価）
- Decision: 最終決定（プロジェクトにつき1件、理由記録付き）
- Data Model の詳細は `prisma/schema.prisma` と [docs/archive/2026-04-12-venuelens-design.md](docs/archive/2026-04-12-venuelens-design.md) を参照

## UI/UX Rules
- IMPORTANT: デザインシステムの詳細は [DESIGN.md](DESIGN.md) を参照（Single Source of Truth — v2で全面刷新済み）
- IMPORTANT: モバイルファースト。375px幅を基準に設計する
- IMPORTANT: 全タッチターゲットは最低44px（h-11）。shadcn/uiのdefaultを上書き済み
- IMPORTANT: 全タップに即時フィードバック（active:scale-[0.98], active:bg-muted）
- IMPORTANT: 固定要素にはiOS SafeArea（env(safe-area-inset-bottom)）を適用
- IMPORTANT: 見出しは細字（font-weight 300-400）。太字禁止。ラグジュアリー感の源泉
- IMPORTANT: 式場名にはNoto Serif JP（明朝）を使用。本文はNoto Sans JP
- IMPORTANT: 数値にはtabular-numsを適用（font-variant-numeric: tabular-nums）
- 情報密度は高めに保つ（日本ユーザーは「情報量 = 信頼」）
- 費用は概算でも数字を見せる。「お問い合わせください」は禁止
- UIコピーは丁寧体（「予約する」→「見学してみる」）、急かさないトーン
- 式場カードは写真ファースト（4:3）、ハートお気に入り、カルーセル対応
- AIインサイトカードはgold-subtle背景 + 3px gold左ボーダー + Sparklesアイコン
- 新しいページには必ず loading.tsx（スケルトン）と空ステート（CTA付き）を用意
- フィードバック: Sonner（トースト）でServer Action結果を通知
- ダークモード対応（Phase 5）
- 6ステップ進捗バーは廃止。ステップ感を出さない

## Conventions
- 新しいページを追加したら、対応するテストファイルを tests/ に作成する
- Prisma スキーマ変更時は必ず `npx prisma migrate dev` でマイグレーションを作成する（db push ではなく）
- IMPORTANT: 既存のコードパターンに従う。新しいライブラリやパターンを導入する前に確認する
- コンポーネントは shadcn/ui の既存コンポーネントを最大限活用する。同等のものを自作しない
- エラーメッセージ・バリデーションメッセージは日本語で具体的に書く

### 用語対応表
| UI上の表記 | コード/DB上の名前 | 注意事項 |
|-----------|-----------------|---------|
| 候補 | `VenueFavorite` | ハートで追加。旧「ショートリスト」は使わない |
| AIコーチ | Coach画面、`sendCoachMessage` 等 | UI上は「AIコーチ」で統一。「AIコンシェルジュ」はマーケティング用語（Overview等の説明文のみ） |

## Lessons
詳細は [docs/lessons.md](docs/lessons.md) を参照。CLAUDE.mdにはルール化された要点のみ記載:
- IMPORTANT: 全タッチターゲットは44px(h-11)以上。shadcn/uiのdefaultサイズをプロジェクトレベルで上書きする
- IMPORTANT: 固定要素（ボトムナビ等）には `env(safe-area-inset-bottom)` を必ず適用する
- 新しいページを追加したら `loading.tsx` も必ず用意する。Server Component遷移の白画面を防ぐ
- `app/(app)/error.tsx` と `global-error.tsx` はプロジェクト初期に作成する
- 認証ヘルパーは `src/server/auth.ts` に統一。各Server Actionファイルにコピペしない
- `.env` にDB URLのプレースホルダーを書かない（prisma.config.tsが.env.localより先に読む）
- ユーザー向けラベルはエンジニア用語ではなく、実際のユーザー行動に合わせて命名する
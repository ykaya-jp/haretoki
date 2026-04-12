# VenueLens

## Overview
結婚式場の情報収集・整理・比較Webアプリ。夫婦でスマホからアクセスし、式場情報を共有・評価・比較して最終候補を絞り込む。商用化を視野に入れている。

## Tech Stack
- Framework: Next.js 15 (App Router) + TypeScript 5.x
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

## Architecture Decisions
- Server Components をデフォルトとし、インタラクションが必要なコンポーネントだけ "use client" をつける
- データ取得は Server Actions または Route Handlers 経由。クライアントから直接 Supabase を叩かない（RLS は補助的な安全装置として使う）
- 画像は Supabase Storage に保存し、Next.js Image コンポーネントで最適化配信する
- 環境変数は .env.local に置き、.env.example にキー名だけ記録する。IMPORTANT: 秘密情報をコミットしない
- Supabase の型は `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts` で自動生成する。手書きしない

## Domain Model（主要エンティティ）
- Project: カップル単位のプロジェクト。ProjectMember(owner/partner)で共有
- Venue: 式場の基本情報（名前、住所、アクセス、収容人数、ステータス）
- VenueScore: 式場の評価スコア（次元×ソース別、UNIQUE制約あり）
- Estimate / EstimateItem: 見積もり（バージョン管理、カテゴリ別項目）
- Visit / VisitRating / VisitNote: 見学記録（チェックリスト、メモ、写真、評価）
- Decision: 最終決定（プロジェクトにつき1件、理由記録付き）
- 詳細は [docs/superpowers/specs/2026-04-12-venuelens-design.md](docs/superpowers/specs/2026-04-12-venuelens-design.md) のData Model参照

## UI/UX Rules
- IMPORTANT: 詳細は [docs/ux-guidelines.md](docs/ux-guidelines.md) を参照。以下は最重要ルールのみ
- IMPORTANT: モバイルファースト。375px幅を基準に設計する
- IMPORTANT: 全タッチターゲットは最低44px（h-11）。shadcn/uiのdefaultを上書き済み
- IMPORTANT: 全タップに即時フィードバック（active:scale, active:bg-muted）
- IMPORTANT: 固定要素にはiOS SafeArea（env(safe-area-inset-bottom)）を適用
- 情報密度は高めに保つ（日本ユーザーは「情報量 = 信頼」）
- 費用は概算でも数字を見せる。「お問い合わせください」は禁止
- UIコピーは丁寧体（「予約する」→「見学してみる」）、急かさないトーン
- 式場カードには写真・価格帯・収容人数・エリア・スタイルタグを表示
- 新しいページには必ず loading.tsx（スケルトン）と空ステート（CTA付き）を用意
- フィードバック: Sonner（トースト）でServer Action結果を通知
- ダークモード対応（Phase 5）

## Conventions
- 新しいページを追加したら、対応するテストファイルを tests/ に作成する
- Prisma スキーマ変更時は必ず `npx prisma migrate dev` でマイグレーションを作成する（db push ではなく）
- IMPORTANT: 既存のコードパターンに従う。新しいライブラリやパターンを導入する前に確認する
- コンポーネントは shadcn/ui の既存コンポーネントを最大限活用する。同等のものを自作しない
- エラーメッセージ・バリデーションメッセージは日本語で具体的に書く

## Lessons
詳細は [docs/lessons.md](docs/lessons.md) を参照。CLAUDE.mdにはルール化された要点のみ記載:
- IMPORTANT: 全タッチターゲットは44px(h-11)以上。shadcn/uiのdefaultサイズをプロジェクトレベルで上書きする
- IMPORTANT: 固定要素（ボトムナビ等）には `env(safe-area-inset-bottom)` を必ず適用する
- 新しいページを追加したら `loading.tsx` も必ず用意する。Server Component遷移の白画面を防ぐ
- `app/(app)/error.tsx` と `global-error.tsx` はプロジェクト初期に作成する
- 認証ヘルパーは `src/server/auth.ts` に統一。各Server Actionファイルにコピペしない
- `.env` にDB URLのプレースホルダーを書かない（prisma.config.tsが.env.localより先に読む）
- ユーザー向けラベルはエンジニア用語ではなく、実際のユーザー行動に合わせて命名する
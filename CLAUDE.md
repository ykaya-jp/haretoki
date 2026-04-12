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
- Venue: 式場の基本情報（名前、住所、アクセス、収容人数、特徴）
- Plan: 式場が提供するプラン（挙式のみ、挙式+披露宴、費用内訳）
- Review: ユーザーの見学メモ・評価（スコア、コメント、写真）
- Comparison: 比較リスト（複数Venueの横並び比較）
- Couple: 夫婦のアカウント。2ユーザーで1つのCoupleを共有

## UI/UX Rules
- IMPORTANT: モバイルファースト。375px幅を基準に設計する
- 式場の写真が主役。画像は aspect-ratio を統一し、Skeleton で読み込み中を表示する
- タップターゲットは最低 44x44px
- 1画面の主要な選択肢は 5〜7個以内（ヒックの法則）
- 日本語コンテンツ: Noto Sans JP、本文 16px 以上、改行位置に注意
- ダークモード対応

## Conventions
- 新しいページを追加したら、対応するテストファイルを tests/ に作成する
- Prisma スキーマ変更時は必ず `npx prisma migrate dev` でマイグレーションを作成する（db push ではなく）
- IMPORTANT: 既存のコードパターンに従う。新しいライブラリやパターンを導入する前に確認する
- コンポーネントは shadcn/ui の既存コンポーネントを最大限活用する。同等のものを自作しない
- エラーメッセージ・バリデーションメッセージは日本語で具体的に書く

## Lessons
<!-- Claudeが間違えたときにここに追記する -->
<!-- 形式: - [日付] 状況 → 正しい方法 -->
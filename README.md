# VenueLens

結婚式場の情報収集・整理・比較ツール。  
見学メモ、見積もり、写真、口コミをひとつにまとめて、夫婦で最適な式場を選べるようにする。

## 何ができるか

- **式場情報の一元管理**: 名前、場所、収容人数、費用、写真、特徴をまとめて登録
- **見学メモ**: 見学時の感想・気づきをスマホからその場で記録
- **見積もり比較**: 各式場の見積もりを項目別に並べて比較
- **夫婦間共有**: 2人でログインして同じデータを閲覧・編集。評価のすり合わせに使う
- **スコアリング**: 重視する条件（アクセス、料理、雰囲気、費用など）に重み付けして総合スコアを算出
- **ショートリスト**: お気に入り登録 → 比較 → 最終候補の絞り込み

## Tech Stack

| 領域 | 技術 |
|------|------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Storage | Supabase Storage (式場写真・見積もりPDF) |
| Test | Vitest (Unit), Playwright (E2E) |
| Hosting | Vercel (Frontend) + Supabase (DB/Auth/Storage) |

## セットアップ

### 前提条件

- Node.js 22+
- Docker（DevContainer使用時）
- Supabaseアカウント（無料枠で開始可）

### DevContainer（推奨）

```bash
git clone https://github.com/<your-username>/venuelens.git
cd venuelens
code .
# VSCode で「Reopen in Container」を選択
```

### 手動セットアップ

```bash
git clone https://github.com/<your-username>/venuelens.git
cd venuelens
npm install
cp .env.example .env.local
# .env.local に Supabase の接続情報を記入
npx prisma db push
npm run dev
```

`http://localhost:3000` でアクセスできる。

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動
npm run build      # プロダクションビルド
npm test           # ユニットテスト (Vitest)
npm run test:e2e   # E2Eテスト (Playwright)
npm run lint       # ESLint
npx prisma studio  # DBのGUI閲覧
npx prisma db push # スキーマをDBに反映
```

## プロジェクト構成

```
src/
├── app/            # Next.js App Router (ページ・レイアウト)
├── components/     # UIコンポーネント (shadcn/ui ベース)
├── lib/            # Supabaseクライアント、ユーティリティ
├── server/         # サーバーサイドロジック、Server Actions
├── hooks/          # カスタム React Hooks
└── types/          # 共通の型定義
prisma/
├── schema.prisma   # データモデル定義
└── migrations/     # マイグレーション履歴
scripts/            # データ収集・分析 (Python)
tests/              # テストファイル
docs/               # 仕様書・設計ドキュメント
.claude/            # Claude Code設定 (スキル・コマンド・エージェント)
```

## 環境変数

`.env.example` を `.env.local` にコピーして値を埋める。

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

## ブランチ運用

| ブランチ | 用途 |
|---------|------|
| `main` | 本番リリース可能な状態を維持 |
| `feat/*` | 機能開発 |
| `fix/*` | バグ修正 |
| `docs/*` | ドキュメント更新 |

コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に従う。

## ライセンス

Private（商用化検討中）
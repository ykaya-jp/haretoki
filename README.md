# Haretoki (晴れ時)

二人で自然に、迷わず、後悔なく結婚式場を選べるWebアプリ。
AIコーチが好みを理解し、見積もりの落とし穴を先回りで教え、パートナーとの意見のすり合わせを支援する。

## 何ができるか

- **AI対話オンボーディング**: 3-4問の対話で好み・条件を把握し、最適な式場を提案
- **URL貼り付けで式場登録**: ゼクシィ・ハナユメ等のURLからAIが情報を自動抽出
- **写真ファーストの式場カード**: 3:2カルーセル、ハートお気に入り、フィルタチップで直感的にブラウズ
- **6次元星評価**: 雰囲気・ホスピタリティ・料理・費用・アクセス・総合印象をauto-saveで記録
- **パートナー独立お気に入り**: 「自分のみ」「パートナーのみ」「二人とも」の3ビュー切替
- **比較ボード**: QuickLook + DimensionBar + 差分のみ表示トグル + AIインサイト
- **見積もりX線**: AIが見積もりの「上がりやすい項目」を統計データに基づいて警告
- **AIコーチ**: インサイトカード（先回り提案）+ チャット（自由質問）のハイブリッド
- **パートナー招待**: LINEリンク1つで3タップリアクション（アカウント不要）
- **決定セレモニー**: コンフェッティ + 旅路サマリ + タグチップで理由記録

## Tech Stack

| 領域 | 技術 |
|------|------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Storage | Supabase Storage (式場写真・見積もりPDF) |
| AI | Claude API (Anthropic SDK) — 式場抽出・見積もり分析・コーチチャット |
| Animation | framer-motion |
| Charts | Recharts |
| Test | Vitest (Unit), Playwright (E2E) |
| Hosting | Vercel (Frontend) + Supabase (DB/Auth/Storage) |

## セットアップ

### 前提条件

- Node.js 22+
- Supabaseアカウント（無料枠で開始可）
- Anthropic API Key（AI機能に必要）

### インストール

```bash
git clone https://github.com/<your-username>/haretoki.git
cd haretoki
npm install
cp .env.example .env.local
# .env.local に接続情報を記入
npx prisma migrate dev
npm run dev
```

`http://localhost:3000` でアクセスできる。

## 開発コマンド

```bash
npm run dev           # 開発サーバー起動
npm run build         # プロダクションビルド
npm test              # ユニットテスト (Vitest)
npm run test:e2e      # E2Eテスト (Playwright)
npm run lint          # ESLint
npx prisma studio     # DBのGUI閲覧
npx prisma migrate dev --name <名前>  # マイグレーション作成
```

## プロジェクト構成

```
src/
├── app/            # Next.js App Router (4タブ: ホーム/探す/候補/コーチ)
├── components/     # UIコンポーネント (shadcn/ui ベース)
│   ├── ai/         # AIインサイトカード
│   ├── coach/      # チャットバー、インサイトフィード
│   ├── comparison/ # 比較ボード、DimensionBar
│   ├── decision/   # 決定セレモニー
│   ├── explore/    # フィルタチップ、式場追加シート
│   ├── home/       # グリーティング、クイックアクション
│   ├── layout/     # BottomNav
│   ├── partner/    # 招待、ゲストビュー
│   ├── ratings/    # 星評価、パートナー比較サマリ
│   ├── ui/         # shadcn/ui + ProgressRing, PillOptions
│   └── venues/     # 式場カード、写真カルーセル
├── lib/            # Supabaseクライアント、定数、ユーティリティ
├── server/         # Server Actions、認証ヘルパー
├── hooks/          # カスタム React Hooks
└── types/          # 共通の型定義
prisma/
├── schema.prisma   # データモデル定義
└── migrations/     # マイグレーション履歴
tests/              # テストファイル
docs/               # 設計ドキュメント
```

## 環境変数

`.env.example` を `.env.local` にコピーして値を埋める。

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL接続（Supabase pooled） | R1 |
| `DIRECT_URL` | PostgreSQL直接接続（マイグレーション用） | R1 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | R1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase公開キー | R1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスキー | R1 |
| `APP_URL` | アプリURL（招待リンク生成） | R1 |
| `ANTHROPIC_API_KEY` | Claude API（AI機能） | R1 |

## 設計ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [DESIGN.md](DESIGN.md) | デザインシステム（カラー、タイポ、画面仕様） |
| [docs/roadmap.md](docs/roadmap.md) | 統合ロードマップ（Release 1-4） |
| [非機能要件書](docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md) | パフォーマンス予算/応答性/CI CD |
| [docs/copy-lexicon.md](docs/copy-lexicon.md) | UI コピー辞書 / Tone of Voice |
| [docs/lessons.md](docs/lessons.md) | 実装で学んだ教訓集 |
| [docs/archive/](docs/archive/) | 過去 Release 技術仕様・v2 UI 仕様など歴史資料 |

## ブランチ運用

| ブランチ | 用途 |
|---------|------|
| `main` | 本番リリース可能な状態を維持 |
| `develop` | 開発統合ブランチ |
| `feat/*` | 機能開発 |
| `fix/*` | バグ修正 |

コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に従う。

## ライセンス

Private（商用化検討中）

# VenueLens Lessons Learned

開発中に遭遇した問題と解決策の詳細記録。CLAUDE.md にはルール化された要点のみ記載し、ここに経緯と詳細を残す。

---

## 2026-04-13: 5-Agent Review から判明した問題群

### Mobile UX

**タッチターゲットが32px（h-8）だった**
- 状況: shadcn/ui のデフォルト Button が `h-8`(32px)、Input も `h-8`。全アプリのインタラクティブ要素が Apple HIG / WCAG の推奨44pxを下回っていた
- 影響: スマホでタップしにくい、特に星評価ボタンとフィルターチップ
- 解決: `button.tsx` と `input.tsx` の default サイズを `h-11`(44px) に変更。全チップ・セレクトにも `min-h-[44px]` を適用
- ルール: **プロジェクト初期に shadcn/ui のデフォルトサイズをモバイル基準(44px)に上書きする**

**iOS SafeArea 未対応**
- 状況: `mobile-bottom-nav.tsx` が `fixed bottom-0` だが `padding-bottom: env(safe-area-inset-bottom)` がなく、iPhone のホームインジケーター領域にナビが被った
- 解決: ボトムナビに `pb-safe`、レイアウトに `pb-[calc(4rem+env(safe-area-inset-bottom))]`
- ルール: **固定要素には SafeArea を必ず考慮する**

**ページ遷移が遅い（Server Component の往復）**
- 状況: 全ページが Server Component で、遷移ごとにサーバーラウンドトリップ。loading.tsx がなく白画面
- 解決: `app/(app)/loading.tsx` にスケルトンUI追加。フィルタ・検索はクライアントサイド処理に変更
- ルール: **新ページ作成時に loading.tsx も必須。フィルタ等の即時操作はクライアントで処理**

### セキュリティ

**認証ヘルパーのコピペによるセキュリティ穴**
- 状況: `requireUser()` / `requireProjectId()` が `venues.ts`, `ratings.ts`, `decisions.ts` に個別定義。`updateProjectStep` は認証なしで任意のprojectIdを書き換え可能だった
- 解決: 共通 `src/server/auth.ts` に統一予定（Phase 1.5）
- ルール: **認証ロジックは1ファイルに集約。Server Actionは必ず認証ヘルパーを呼ぶ**

### 環境設定

**Prisma が .env.local ではなく .env を優先読み込み**
- 状況: `prisma.config.ts` が `import "dotenv/config"` で `.env` を読む。`.env` にプレースホルダーの `localhost:5432` があり、`.env.local` の Supabase URL が無視された
- 解決: `prisma.config.ts` で `dotenv.config({ path: ".env.local" })` を先に読むように修正。`.env` からDB URLを削除
- ルール: **`.env` にDB URLのプレースホルダーを書かない**

### UXデザイン

**「口コミ」ラベルの意味不明**
- 状況: Tier 1 評価軸の「口コミ (reviews)」がユーザー視点で何を評価するのか曖昧。「自分が他人の口コミを評価するのか、自分の感想なのか」がわからない
- 解決: 「総合印象 (overall_impression)」に変更
- ルール: **ラベルはエンジニア用語でなくユーザーの行動に合わせる**

**エラーバウンダリの不在**
- 状況: `error.tsx` / `global-error.tsx` がなく、Server Action のエラーやDB接続エラーで白画面
- ルール: **プロジェクト初期に error.tsx を作成する**

# Haretoki Lessons Learned

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

---

## 2026-04-14: Haretoki UI/UX 全面刷新から判明した問題群

### デザインシステム

**カラーパレット変更だけではデザインは変わらない**
- 状況: Navy → Cream にCSS変数を変えたが、コンポーネントの形・余白・サイズがshadcn/uiデフォルトのまま。ユーザーから「古臭い」「モダンでも美しくもない」の評価
- 解決: globals.css にコンポーネントオーバーライド（ボタン letter-spacing + hover lift、input 角丸12px + focus ring、カード borderless + shadow、シート backdrop-blur）を追加
- ルール: **カラーだけでなく、spacing, border-radius, shadow, transition を全てカスタマイズしないとshadcn/uiのデフォルト感は消えない**

**アニメーション速度が早すぎた**
- 状況: 150-300ms のアニメーションを実装したが「動きが早すぎる」のフィードバック。ラグジュアリーブランドはもっと遅い
- 解決: 全アニメーションを 600-800ms に変更。spring の stiffness を 150-200 に下げた
- ルール: **ラグジュアリー = 遅い。Aesop ~600ms、Apple ~500ms。150msはチープに感じる**

### コピー/用語

**エンジニア用語がUIに混入**
- 状況: 「ランディングページへ」「リトライ」「登録に失敗しました」などのテキストが花嫁向けアプリに不適切
- 解決: 「ランディングページへ」→ ロゴクリックでトップに戻る（テキストリンク自体を削除）。「リトライ」→「もう一度」。「〜に失敗しました」→「〜できませんでした」
- ルール: **モダンなアプリではロゴ = ホーム。テキストリンクで「〇〇ページへ」は使わない。エラーメッセージは柔らかく**

### セキュリティ

**クロスプロジェクトデータアクセスが全Server Actionで未防止**
- 状況: ratings, favorites, visits, estimates, decisions の全Server Actionでvenue/visitのプロジェクト帰属チェックがなかった。理論上、他ユーザーの式場データにアクセス可能
- 解決: auth.ts に requireVenueAccess / requireVisitAccess ヘルパーを追加し、全データ操作関数で使用
- ルール: **全てのデータ操作で「このリソースはユーザーのプロジェクトに属するか」を検証する。RLS は補助的な安全装置であり、Server Actionレベルのチェックが必須**

### 画像/ビジュアル

**コード生成でロゴは作れない**
- 状況: SVGでロゴを手書きしようとしたが、ユーザーから「ダサそうだからCodexとかに作らせなよ」のフィードバック
- 解決: ChatGPT (DALL-E) でロゴ、ヒーロー画像、空ステートイラスト、認証ページパターン、OGP画像を生成
- ルール: **ロゴ・イラスト・パターンはAI画像生成ツール（DALL-E/Midjourney）に任せる。コードで作ろうとしない**

### マイグレーション/デプロイ

**`_prisma_migrations` の failed row が build を巻き込む (P3009)**
- 状況: W15 F1-F4 を develop に merge → push したら Vercel preview build が `Error: P3009`。`20260421132434_enable_realtime_pub` の row が failed 状態のまま残っており、それ以降の migration が deploy できない。`alter publication supabase_realtime add table ...` 系の SQL は publication が既に持っているテーブルを 2 度目に add すると error を吐く一方、Supabase 側のテーブルは実態として publication 入りしているケースが該当
- 解決: `vercel env pull --environment=preview .env.preview.tmp` → preview 用の prisma config (一時ファイル) → `npx prisma migrate resolve --config prisma.config.preview.ts --applied 20260421132434_enable_realtime_pub` で row を applied に書き換え。Production 環境も同様に確認。終わったら tmp と一時 config は削除。
- ルール: **`alter publication ... add table` は `IF NOT EXISTS` 相当の冪等性が無いので必ず `do $$ begin ... exception when ... end $$;` で wrap する。failed row は CI を止めるので、merge 前に `prisma migrate status` を全環境で確認**

**`Server Action ファイル内の "_helper" は公開エンドポイント**
- 状況: F3 で `src/server/actions/decision-todos.ts` (`"use server"` 付き) に `_seedDecisionTodosForProject` / `_resetDecisionTodosForProject` を内部ヘルパー扱いで export していたが、Next.js は `"use server"` モジュールの **全 export を RPC エンドポイントとして自動公開**する。アンダースコア prefix は名前のヒントで Next.js のルーティングには影響しない。`requireProjectMembership` ガード抜きで他テナントの decision_todos を任意に reset できる状態だった
- 解決: ヘルパー本体を `src/lib/decision-todos/seed.ts` (plain module、`"use server"` なし) に移し、Server Action 側は `requireUser` + `requireProjectMembership` を通したラッパーだけに整理
- ルール: **`"use server"` ファイル内の export は全部 public API として扱う。内部ヘルパーは plain module に分離する。`_` prefix を信用しない**

**Server Component 内で `cookies().set()` は Next.js 16 で必ず throw**
- 状況: F4 で `src/app/invite/[token]/(guest)/view/page.tsx` の Server Component 内で cookie の screenCount bump のために `cookieStore.set(...)` を呼んでいたが、Next.js 16 の readonly cookie adapter は phase !== 'action' で `ReadonlyRequestCookiesError` を必ず throw する。Level 1 guest 体験が完全に死んだ
- 解決: bump を `src/app/invite/[token]/(guest)/bump/route.ts` の POST Route Handler に切り出し、client component (`BumpOnMount`) が mount 時に 1 回 fetch する形に
- ルール: **Server Component は cookie を read のみ。set/delete は Server Action または Route Handler に切り出す**

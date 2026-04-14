# Haretoki — problems_01.md 全問題解消 マスタープラン

> 実ユーザー感想 `problems_01.md` に対する統合改善計画。3つの専門エージェント（機能不具合調査 / UI・UX・IA再設計 / パフォーマンス監査）を並列実行した結果を1本に統合している。
>
> 関連文書:
> - [problems_01.md](./problems_01.md) — 原文フィードバック
> - [ui-ux-remediation-plan.md](./ui-ux-remediation-plan.md) — IA / ビジュアル / 画面別 / コピー / モーション詳細（UX専任作業物）
> - 本書 — 機能不具合の根本原因 + パフォーマンス対策 + 実行計画

---

## 0. 問題の俯瞰

ユーザー感想は一見バラバラだが、根っこは **3層の故障** に整理できる。

| 層 | 症状 | 根本原因 |
|---|---|---|
| A. インフラ/データ層の故障 | 「うまくいきませんでした」が候補・マイページ・比較で常態化。AI解析・AIおすすめ・星評価保存・口コミ解析が軒並み失敗 | 本番DBに最新Prismaマイグレーションが未適用、または本番の `ANTHROPIC_API_KEY`／AI Gateway設定が効いていない |
| B. 情報設計と視覚表現の陳腐化 | 「20年前のデザイン」「押せそうで押せない」「探すなのに集める場所」「縦にボタンを並べただけ」 | IAとコンポーネント設計が初期のままアップデートされておらず、2026モダンのラグジュアリー表現に追いついていない |
| C. 体感速度の不足 | タップから反応・表示まで遅すぎる | レイアウトの直列await、重いPrisma include、prefetch漏れ、過剰な`"use client"`、framer-motion/recharts/lucideの非最適化 |

A層が直らないと何をやっても「使い物にならない」。B・CはA解決後に効いてくる。したがって**必ずAから着手**する。

---

## 1. 実行フェーズ定義（推奨ロードマップ）

### Phase 0 — 緊急ホットフィックス（当日〜2日）
目的: 「うまくいきませんでした」画面を消す。本番を使える状態に戻す。

### Phase 1 — 体感速度の底上げ（3〜5日）
目的: タップ→画面表示の待ち時間を半減。ラグジュアリー感の前提条件。

### Phase 2 — 情報設計の再構築（1〜2週間）
目的: ホーム・探す・追加・詳細・コーチの骨格をやり直す。`ui-ux-remediation-plan.md` §1・§3 を実装。

### Phase 3 — ビジュアル刷新（2〜3週間、Phase 2と並走可）
目的: 2026年4月水準のモダン・ラグジュアリー表現。`ui-ux-remediation-plan.md` §2 を実装。

### Phase 4 — 仕上げ（1週間）
目的: コピー統一、モーション微調整、ダークモード、計測。

---

## 2. Phase 0 — 緊急ホットフィックス

### H0-1. 本番DBのマイグレーション適用を確認・適用する（最優先）
**対象**: Vercel build 設定、`prisma/migrations/`
**現状**: `20260414100000_payment_method_enum` 含む最新マイグレーションが production DB に適用されていない疑い。`getVenues` が新カラム（例: `reviewEstimateDeltaPct`）を orderBy で参照するため、未適用だと Prisma が throw → `/candidates`・`/mypage` で error.tsx 発火。
**対応**:
- Vercel プロジェクトの Build Command を `prisma generate && prisma migrate deploy && next build` に変更
- 手動で `DATABASE_URL=... npx prisma migrate deploy` を実行して現状を同期
- Release ノートに「本番マイグレーション適用状況の確認」を常設化

### H0-2. 本番の `ANTHROPIC_API_KEY` と Claude 呼び出しを再稼働させる
**対象**: Vercel env、`src/lib/claude.ts`
**症状にヒット**: URL解析失敗(#10)、AIおすすめ固まる(#13)、口コミAI解析失敗(#15)
**対応**:
- `vercel env ls production | grep ANTHROPIC_API_KEY` で存在確認。無ければ追加
- **Vercel AI Gateway 経由で `provider/model` 文字列指定に切替**（2026年時点の推奨）。直接SDK呼び出しのレート制限/モデル名変動リスクを吸収
- `src/lib/claude.ts:9-13` の catch で `console.error(err)` + 構造化ログを追加。以降の障害を本番で追跡可能にする
- AI呼び出しを行う全Server Action（`venues.ts` URL解析、`reviews.ts`、`onboarding.ts` の getExploreAIRecommendations）の戻り値を `{ status: "unavailable", reason }` 形式で統一し、UI側で「一時的に停止中」表示を出せるようにする

### H0-3. `getVenues` の orderBy を防御的にする
**対象**: `src/server/actions/venues.ts:49-128`
**内容**: 新カラムが nullable または未migrateでも落ちない orderBy フォールバック。マイグレ適用済みの本番で不要になってもコストは低い。

### H0-4. `requireProjectMembership` と onboarding ループを解消
**対象**: `src/server/auth.ts:14-22`, `src/app/(app)/mypage/page.tsx:30-40`
**症状**: owner の `acceptedAt` が null のまま作られるケースがあり、`/mypage` アクセス時に onboarding へリダイレクトされ続けて error.tsx 扱いになる疑い
**対応**:
- owner作成時に `acceptedAt: new Date()` を必須とする migration（backfill含む）
- `requireProjectMembership` で owner はリダイレクト対象外にする defensive ガード
- `mypage/page.tsx` で project/members null 時の防御表示

### H0-5. 星評価保存の Visit create 失敗を直す
**対象**: `src/server/actions/ratings.ts:98-124`, `prisma/schema.prisma` の `Visit`
**内容**: 最新マイグレ `20260413142641_r3_visit_fields_rating_comparison` で Visit に NOT NULL 列が追加されていれば `saveDirectRatings` の create に追加、そうでなければ optional に戻す。`rating-section.tsx:44-46` の toast は `result.error` の内容をそのまま表示するよう修正（原因追跡しやすくする）。

### H0-6. URL追加モーダルのUX不具合を同時修正
**対象**: `src/components/explore/add-venue-sheet.tsx:109-113`
**内容**:
- エラー時 `setUrl("")` を追加（戻った時の残留解消、#10後半）
- `toast.info(msg, { duration: 3000 })` で表示時間を短縮（#10前半）
- toast を「押している間だけ表示」挙動は Sonner の `onDismiss` + タップ外で閉じるカスタムコンポーネントで対応（Phase 2 推奨、ここでは duration 短縮だけで最低限OK）

### H0-7. 「気になる点を先に」ボタンを明快にする
**対象**: `src/components/venues/review-section.tsx:118-131`
**内容**: ラベルを「ネガティブな声を先頭に」または「気になる声から表示」に変更。`Tooltip` で機能説明。ネガ口コミが 0 件なら disable + title で理由表示。

**Phase 0 完了判定**: `/home` → 「比べる」タップ → 候補画面が normal 表示される。`/mypage` が開く。式場詳細で星を付けるとトーストに保存成功が出る。URL解析が本番で成功、または「AIが一時停止中」の説明が出てUXが継続可能。

---

## 3. Phase 1 — 体感速度の底上げ

以下は `performance` 監査結果を優先度順に抜粋。完全版は本書末の Appendix A 参照。

### P1-1. `(app)/layout.tsx` の直列await → 並列 + Suspense
- `getOrCreateProject` と `getBottomNavBadgeCounts` を `Promise.all`、badgeCounts は `<Suspense>` に包んで nav を先に flush
- 期待効果: 全ページで -150〜300ms

### P1-2. `requireUser` / `requireProjectMembership` を `React.cache` 化
- `src/server/auth.ts` の両関数を `cache(...)` で包む。同一リクエスト内の Supabase auth 往復を 1回に集約
- 期待効果: 認証多重呼び出しのあるページで -100〜250ms

### P1-3. `/home`・`/candidates` の Server Action 呼び出しを並列化・重複排除
- `/home`: `getPendingInvitation` を `Promise.all` の前から中へ
- `/candidates`: `getHomeData` は `userName` しか使っていないので `getCurrentUserName()` に分離。`getVenues` も id/name のみの軽量版に

### P1-4. `/venues/[id]` の過剰 include を分割＋Suspense
- `getVenue` を `getVenueHeader` / `getVenueEstimates` / `getVenueVisits` に分割
- page.tsx で各ブロックを独立 Suspense。hero 部分を即 flush
- 期待効果: LCP -400〜800ms

### P1-5. `bottom-nav.tsx` の motion.div を CSS で置き換え＋全タブ prefetch
- framer-motion import を外してナビ初期ロードを軽量化
- 全タブ `prefetch={true}`（モバイルでも RSC ペイロードは十分小さい）
- 期待効果: タップ→表示 -200〜500ms

### P1-6. Next.js 16 機能の活用
- **`"use cache"` + `cacheTag`** を読み取り系 Server Action（`getHomeData`, `getAIInsights`, `getFavorites`, `getBottomNavBadgeCounts`）に導入。`revalidateTag("project:{id}")` で無効化
- **PPR** を `/home`・`/explore` で有効化（`experimental_ppr = true`）。ヘッダ/ナビの静的シェルが即表示
- **View Transitions** experimental を有効化。タブ間遷移の知覚遅延が半減

### P1-7. バンドル削減
- `next.config.ts` に `optimizePackageImports: ["lucide-react", "framer-motion"]` 追加
- `recharts` / `EstimateWaterfallChart` は `dynamic(() => ..., { ssr: false })`
- Shippori Mincho は `preload: false`、Noto Serif JP は weight を 400 のみに絞る
- 画像は Supabase ホスト限定 + `sizes` 明示 + LCP 候補に `priority`

**Phase 1 完了判定**: モバイル実機（Moto G Power / iPhone 12相当）でタブ切替 < 500ms、初回 /home LCP < 1.8s、ホームからの候補遷移の"空白"が体感で消える。

---

## 4. Phase 2 — 情報設計の再構築

詳細は **[ui-ux-remediation-plan.md §1・§3](./ui-ux-remediation-plan.md)** を参照。主な決定事項を抜粋:

### ホーム
- **押せないボタン列（比較／追加／見学）を廃止**、押せるものだけを「次の一歩（NBA: Next Best Action）」1枚のカードに統合
- 「次の一歩」と「比較してみましょう」の重複を解消 → NBA 1 CTA のみ表示
- 「お二人の式場探し」改行問題は見出しコピー自体を短くし、1行収まる形へ（→ §4 マイクロコピー参照）
- 「最近ご覧になった式場」の「すべて」は **/candidates（候補一覧）** へ遷移。`/explore` と責務分離

### 探す（/explore）の責務
- 「気になる式場を集める場所」というコピーは廃止。**探す = 追加 + ブラウズ**の両方を担う画面として統一コピーに差し替え（例: 「式場を追加・比較する」）
- 「追加」ボタンを FAB 相当の目立つ位置に再配置

### 式場追加モーダル
- 左右タブ（URL / 手動）を **段階 Bottom Sheet** に再設計: Step1 = URL or 手動の選択、Step2 = 入力、Step3 = 確認
- URLで取り込み失敗時も「このまま手動で続ける」導線を段階の中に置く（タブ戻し不要）

### 式場詳細
- 縦長のボタン羅列を廃止し、**タブ/セグメント（概要 / 見積もり / 訪問 / 口コミ）** に分割
- ラベル書式統一（「項目名：値」形式のグリッド）
- 見積もり項目名は **プリセット + 自由入力**（Combobox）
- 「他のカップルも同程度の調整をしています」の重複表示を削除

### コーチ
- 過去チャットが常時残る挙動を廃止し、**セッション履歴サイドバー方式**（ChatGPT/Claude準拠）: 起動時は空の新規セッション。左側ドロワーで過去セッション一覧→タップでロード

### 用語
- 「比較する」に統一（「比べる」は廃止）

---

## 5. Phase 3 — ビジュアル刷新

詳細は **[ui-ux-remediation-plan.md §2](./ui-ux-remediation-plan.md)** 参照。

刷新の5本柱（要約）:
1. **明朝×サンセリフのタイポグラフィ対比** — Shippori Mincho を hero の数字・式場名で主役に、本文は Noto Sans JP で軽やかに
2. **余白設計の見直し** — カード密度より呼吸。セクション間 64px 以上
3. **グラデーション・メッシュ と 写真の扱い** — 晴れ間の光をUIに落とし込む（gold-subtle / morning-light グラデーション）
4. **bento レイアウト** — ホームのインサイト・進捗・NBAをbento化
5. **モーション** — View Transitions + subtle motion。ラグジュアリーは「速さ + 静けさ」

DESIGN.md の差分アップデート案は UX計画書 §2 後半。

---

## 6. Phase 4 — 仕上げ

- `ui-ux-remediation-plan.md §4` のコピー統一表を全画面に適用
- `§5` のモーション予算を実装（タッチ応答 150ms 以内、スケルトン→実体 200ms以内）
- 空ステート・ローディングの品質向上（`loading.tsx` を実レイアウトと一致させる）
- ダークモード対応の本実装
- 計測: Core Web Vitals / Server Action p95 / Vercel Analytics でリリース前後比較

---

## 7. リリース境界とブランチ戦略

- Phase 0 は `fix/hotfix-broken-features` ブランチで 1 PR 集約、即日 develop→main→本番へ
- Phase 1（パフォーマンス）は `perf/*` 系ブランチを worktree で並列実行:
  - `perf/layout-parallelize` (P1-1, P1-2)
  - `perf/route-split` (P1-3, P1-4)
  - `perf/bundle-optim` (P1-7)
  - `perf/next16-features` (P1-6)
- Phase 2 は IA 再設計の性質上、大きな 1 本ブランチ `feat/ia-redesign` で進める（ナビ・ホーム・追加モーダル・詳細タブ化を同時切替）。ただし**ビジュアル（Phase 3）はフラグで切替**できるようにして検証を容易に
- 全 Phase で **Ship Cycle**（E2E → develop merge → push → vercel prod → worktree掃除）を厳守

---

## 8. 問題番号 → タスク対応表

| 問題# | 内容 | 担当Phase | 担当タスク |
|---|---|---|---|
| ホーム#1 | 「お二人の式場探し」改行 | Phase 2 | コピー変更（§4） |
| ホーム#2 | 押せないボタン列 | Phase 2 | NBA 1カード化 |
| ホーム#3 | 比べる→うまくいきません | Phase 0 | H0-1, H0-3 |
| ホーム#4 | 比較ガイド冗長 + 同エラー | Phase 2 / Phase 0 | NBA統合 + H0-1 |
| ホーム#5 | 比較/比べる揺れ | Phase 4 | コピー統一 |
| ホーム#6 | モダンでない | Phase 3 | ビジュアル刷新 |
| ホーム#7 | 「すべて」→探す画面 | Phase 2 | IA再設計 |
| 探す#8 | 追加ボタン地味 | Phase 2 | FAB昇格 |
| 探す#9 | 探すと集める場所の矛盾 | Phase 2 | コピー統一 |
| 探す#10 | URL解析失敗・toast長い・残留 | Phase 0 | H0-2, H0-6 |
| 探す#11 | URL/手動タブ構造 | Phase 2 | 段階BottomSheet化 |
| 探す#12 | 追加モーダルがつまらない | Phase 3 | ビジュアル刷新 |
| 探す#13 | AIおすすめ固まる | Phase 0 | H0-2 |
| 探す#14 | ラベル書式・星更新失敗・縦長・プリセット・重複表示 | Phase 0 + Phase 2 | H0-5 + 詳細タブ化 + プリセット実装 + 重複削除 |
| 探す#15 | 気になる点を先にボタン・口コミAI失敗 | Phase 0 | H0-7, H0-2 |
| 探す#16 | 全体的に縦並び | Phase 2 + Phase 3 | 詳細タブ化 + ビジュアル |
| 候補#1 | うまくいきません | Phase 0 | H0-1 |
| コーチ#1 | 過去チャット残留 | Phase 2 | セッション履歴方式 |
| コーチ#2 | 比較するエラー | Phase 0 | H0-1 |
| マイページ#1 | うまくいきません | Phase 0 | H0-1, H0-4 |
| 共通#1 | 遷移/リロード遅い | Phase 1 | P1-1 〜 P1-7 |
| 妻W-1 | カテゴリ別☆ソート無し | Phase 2 | W-1（venue-filters拡張） |
| 妻W-2 | 持ち込み料一覧UI | Phase 2 | W-2 |
| 妻W-3 | ウォーターフォール信頼度 | Phase 2 | W-3 |
| 妻W-4 | 候補比較の写真横並び | Phase 2 | W-4 |
| 妻W-5 | 総合☆の外部ソース混合 | Phase 2 | W-5 |
| 妻W-6 | ポジ/ネガ件数バランス | Phase 2 | W-6 |

---

## Appendix A — パフォーマンス改善詳細（監査結果より）

### Quick win（Phase 1-A: 1〜3日で全部入る）
| # | 施策 | 対象 | 期待効果 |
|---|---|---|---|
| Q1 | layout.tsx の直列await並列化 | `src/app/(app)/layout.tsx` | -150〜300ms |
| Q2 | /home の pendingInvitation 並列化 | `src/app/(app)/home/page.tsx:14` | -100〜200ms |
| Q3 | /candidates の getHomeData 削除 + 軽量化 | `src/app/(app)/candidates/page.tsx` | -300〜500ms |
| Q4 | /venues/[id] aggregate を Suspense下に | `src/app/(app)/venues/[id]/page.tsx:42` | LCP -200〜400ms |
| Q5 | requireUser を React.cache 化 | `src/server/auth.ts` | -100〜250ms |
| Q6 | bottom-nav の motion.div → CSS | `src/components/layout/bottom-nav.tsx` | TTI -50〜150ms |
| Q7 | 全タブ prefetch 復活 | `src/components/layout/bottom-nav.tsx:89-92` | 遷移 -200〜500ms |
| Q8 | recharts dynamic import | `src/components/venues/estimate-waterfall-chart.tsx` | JS -80〜150KB |
| Q9 | next/image の priority/sizes 明示 | 画像系コンポーネント | LCP -200〜500ms |
| Q10 | フォント preload/weight最適化 | `src/app/layout.tsx:14-39` | FCP -100〜200ms |
| Q11 | getHomeData の venues.take を 10→5 | `src/server/actions/home.ts:62,90` | -30〜80ms |
| Q12 | revalidatePath → revalidateTag | `src/server/actions/favorites.ts` | 楽観更新の再検証短縮 |

### 中期（Phase 1-B: 1〜3週間）
| # | 施策 | 対象 | 期待効果 |
|---|---|---|---|
| M1 | "use cache" + cacheTag 導入 | 読み取り系Server Actions全般 | 再訪問 -300〜800ms |
| M2 | PPR を /home・/explore で有効化 | next.config.ts + 各page.tsx | 体感TTFB -500ms〜1s |
| M3 | getVenue を分割＋Suspenseストリーム | `src/server/actions/venues.ts:136` ほか | LCP -400〜800ms |
| M4 | View Transitions API 対応 | next.config + ViewTransitionラップ | 知覚遅延 -200〜500ms |
| M5 | useOptimistic 徹底 | heart-button / rating-section / venue-status-select | pending感ゼロ |
| M6 | 認証を middleware で1回化 | `src/server/auth.ts` + middleware | 全ページ -100〜300ms |
| M7 | Prisma N+1 解消 | getFavorites / getVenues | -100〜300ms |
| M8 | バレルimport最適化 | lucide-react / framer-motion | 初回JS -30〜100KB |
| M9 | 非重要アニメをCSS/WAAPIへ | journey-card など | クライアントJS -50〜120KB |
| M10 | LazyMotion化 | motion-provider + m.div | 初回JS -40〜80KB |
| M11 | 画像リモートパターン限定＋変換 | next.config.ts | 画像ペイロード -30〜60% |
| M12 | loading.tsx のスケルトン品質向上 | 全loading.tsx | 体感TTI -300〜600ms |

### 最優先3本
1. **Q1 + Q2 + Q5**（直列await並列化 + requireUser cache化）
2. **M1**（`"use cache"` 導入）
3. **Q6 + Q7**（bottom-nav の motion 除去 + 全タブ prefetch）

---

## Appendix B — 機能不具合の根本原因コード位置

| # | File | Lines | 修正内容 |
|---|---|---|---|
| H0-1 | `prisma/migrations/*` (本番適用) | — | `prisma migrate deploy` を本番で実行、Vercel Build Commandに組込 |
| H0-1 | `src/server/actions/venues.ts` | 59–66 | orderBy を try/catch でフォールバック |
| H0-2 | `src/lib/claude.ts` | 9–13 | catch で `console.error` + 型付き返却 |
| H0-2 | Vercel env | — | `ANTHROPIC_API_KEY` を production に設定、AI Gateway 経由推奨 |
| H0-2 | `src/server/actions/onboarding.ts` | `getExploreAIRecommendations` | Claude失敗時は `{ status: "unavailable" }` |
| H0-2 | `src/components/venues/ai-recommendations.tsx` | 437–450 | 「AI機能が一時停止中」明示 |
| H0-4 | `src/server/auth.ts` | 14–22 | owner の acceptedAt 問題を defensive 対応 |
| H0-4 | `src/app/(app)/mypage/page.tsx` | 30–40, 95–100 | null 時の防御表示 |
| H0-5 | `src/server/actions/ratings.ts` | 113–121 | Visit create のフィールドを schema と同期 |
| H0-5 | `src/components/venues/rating-section.tsx` | 44–46 | `result.error` を toast に含める |
| H0-6 | `src/components/explore/add-venue-sheet.tsx` | 109–113 | `setUrl("")` + `toast.info(msg, { duration: 3000 })` |
| H0-7 | `src/components/venues/review-section.tsx` | 118–131 | ラベル・Tooltip・ゼロ件disable |

---

## Appendix B-2 — 妻要望（wife-requirements.md）ギャップ対応

調査結果: 妻要望の主要機能（ソート・フィルタ / 口コミ要約 / プラン透明化 / 6カテゴリチェックリスト / ウォーターフォール）は**ほぼ全て実装済み**。真の未実装項目は無く、5件の軽微な「部分実装」のみ。以下を Phase 2 後半に組み込む。

| # | ギャップ | 対象 | 対応 | 難易度 |
|---|---|---|---|---|
| W-1 | カテゴリ別☆評価でのソートが無い（フィルタはあり） | `src/server/actions/venue-filters.ts:48-53` sortBy enum / `venue-filter-sheet.tsx` | `score_cuisine_desc`, `score_service_desc`, `score_venue_desc`, `score_cost_desc`, `score_facility_desc` を追加 | S |
| W-2 | 持ち込み品目ごとの料金一覧UIの網羅性が弱い | `src/components/venues/plan-section.tsx` の `bringInItems` 描画 | `{item, fee?}` を行テーブル（品目／可否／料金）で明示表示 | S |
| W-3 | 見積もりウォーターフォールのレビュー由来値に信頼度情報が無い | `src/components/venues/estimate-waterfall-chart-impl.tsx` | ReferenceLine に「n=X件の口コミ平均」ラベル、±σバンド追加 | M |
| W-4 | 候補比較で写真サムネイルの横並び表示が無い（`hasPhotos` フラグのみ） | `src/server/actions/checklist-comparison.ts:20`, `src/components/comparison/checklist-comparison.tsx` | 式場×項目のマトリクスで写真サムネを並べる。タップでライトボックス | M |
| W-5 | 総合☆評価の算出が `user_rating` ソースのみ。外部ソース（zexy/wedding_park）混合無し | `src/server/actions/venues.ts:107` | `VenueScore` 全ソースの加重平均に拡張。source別のウェイト定義を追加 | M |
| W-6 | ポジ/ネガ口コミの件数バランス可視化が無い（`isNegative`ソートはある） | `src/components/venues/review-section.tsx` | 口コミセクション冒頭に `ポジ:ネガ = X:Y` の比率バー | S |

**Phase 2 のIA再構築時にまとめて実装**（ソート UI 再設計と同時）。いずれも既存スキーマで対応可能で migration 不要。

---

## Appendix C — 運用ガードレール

本障害を二度と起こさないために、以下をプロジェクトルールに追加:

1. **Build Command に `prisma migrate deploy` を組み込む**（マイグレ未適用で本番が壊れない）
2. **AI呼び出しは Vercel AI Gateway 経由に統一**（`provider/model` 文字列 + 失敗時の構造化エラー）
3. **error.tsx に Sentry 相当のログ送信**を追加。「うまくいきませんでした」の裏側で何が起きたかを production で即追跡可能にする
4. **E2E（Playwright）のスモーク**: `/home → 比較CTA → /candidates` が error.tsx を出さないテストを必ず通す
5. **リリース前に mobile 375px 実機 or エミュレータで Phase 0〜2 の改善箇所をすべて目視確認**（lessons.md の原則）

---

**次アクション（コーダーへ指示する順序）**:
1. Phase 0 のタスク H0-1〜H0-7 を `fix/hotfix-broken-features` ブランチで1つずつ潰す
2. Playwright E2E で `/home→候補`、`/mypage`、`/venues/:id` の基本動線を通す
3. develop へマージ → Vercel prod 反映 → problems_01.md の "うまくいきませんでした" 系をユーザー側で確認してもらう
4. Phase 1 → Phase 2 → Phase 3 → Phase 4 の順で並列worktree実行

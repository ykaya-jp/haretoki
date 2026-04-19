# v4 — 残問題・リスク全削ぎ落とし + 並列実装 + 本番 E2E 検証

## Context

v3 (Phase A/B/C/D) はコード上完了 (tests 269/269 pass, preview READY) だが、**3 系統の問題が継続**:

- 系統 I: `feat/url-import-v3` が develop に未 merge (26 commits リード) → `haretoki.vercel.app` (= develop alias) では v3 UI が一度も見えていなかった
- 系統 II: 写真手動 upload 非反映 + 式場削除後の reload 必須の **動作バグ 2 件** (cacheComponents 下の router.refresh 順序問題)
- 系統 III: /compare PC 幅崩れ / ステータス体系混在 / /explore IA 曖昧 / URL シート幅 / 遷移ラグの **UI/UX 5 件**

さらに v3.1 で Out of scope にしていた **Favorites 廃止 / Browserless / backfill / IA 再設計 / streaming 再計測** も今回すべて攻める。

**ゴール**: 全問題 + 全 Risk を潰した完璧な実装を並列で仕上げ、develop → preview → production に反映、最後に **本人アカウントで自動ログイン → E2E スモーク → 合格確認** までを一続きで完了する。

**成功条件**: `haretoki.vercel.app` (production) を私が e2e-runner 経由で本人 credential ログイン → P1-P13 + 旧 Risk 由来の副作用ゼロを確認 → 完了報告。

---

## 問題インベントリ (最終版)

| # | 症状 | 系統 | Step |
|---|------|------|------|
| P1 | /venues 写真 broken | I | 1 |
| P2 | 詳細の 4 section (Fact/Amenity/Cost/Cuisine) 欠落 | I | 1 |
| P3 | 口コミボタン旧「追加/更新」文言 | I | 1 |
| P4 | /compare が旧 flex | I + III | 1 + 3a |
| P5 | 「印象を残す」8 行空行 | 独立 | 2c |
| P6 | 写真手動 upload 非反映 | II | 2b |
| P7 | 式場削除 reload 必須 | II | 2a |
| P8 | zexy CDN 成功率不明 | 観測 | 4a (Browserless 込み) |
| P9 | /compare PC 幅 左 800px 押し込み + 星はみ出し | III | 3a |
| P10 | ステータス 3-way 混在 (heart / status enum / badge) | III | 3b (DB ごと) |
| P11 | /explore AI おすすめ / 通常 list 混在 | III | 3c |
| P12 | URL シート PC 幅 full-width | III | 3d |
| P13 | タブ遷移の描画ラグ | III | 3e + 4c |
| R1 | Step 2a 順序 swap で 1 フレーム stale 描画 | Risk→攻め | 5a |
| R2 | merge conflict (v3 が 26 commits リード) | Risk→攻め | 1 の sub |
| R3 | 古い venue は 19 cols 空 → 詳細 4 section 白紙 | Risk→攻め | 4b backfill |
| R4 | cacheComponents streaming の体感遅延 | Risk→攻め | 4c |

---

## 修正方針 (全 Step — 並列実行)

### Step 1 — Deploy 反映 + merge conflict 対策 (最短経路)
- `feat/url-import-v3` (`bb3852b`) を **develop に rebase → merge**
- 途中 conflict があれば 1 commit 単位で resolve、type + vitest + build を再実行
- merge 後 Vercel 自動 deploy → READY 待ち → `haretoki.vercel.app` 反映
- 検証: P1-P3 解消

### Step 2 — 動作バグ 3 件 (Worktree: `wt-bug`)
**2a. 式場削除の順序 (P7)**
- `src/components/venues/venue-action-bar.tsx:30-31` で `push → refresh` を `refresh → push` に swap
- R1 対策: `startTransition` で navigate を包み、削除済 id を Optimistic で client filter に反映

**2b. 写真手動 upload の即反映 (P6)**
- `uploadVenuePhotos` server action 返り値に `photoUrls` を含める
- `add-photos-button.tsx` で useState に optimistic 反映 + `router.refresh()` を await
- `src/app/(app)/venues/[id]/page.tsx` で `revalidateTag("venue-header")` + `revalidatePath` を確認/補完

**2c. 印象セクション 8 行空行 (P5)**
- `src/components/venues/venue-impression-*` を Grep で特定
- 初期 state: 1 CTA「評価を追加」+ 既存評価のみ、追加時に slot を increment

### Step 3 — UI/UX 一貫性 (Worktree: `wt-ux`)
**3a. /compare PC 幅 (P4+P9)**
- `comparison-grid.tsx` wrapper に `max-w-[min(1200px,100%)] mx-auto`
- 列 grid を `minmax(180px, 1fr)` + venue ≤4 なら full-width 利用、≥5 で snapper fallback
- 星行を `items-baseline` + tabular-nums で高さ固定、container をはみ出さない

**3b. ステータス体系の単一化 (P10)** ★ **DB 変更込み (v3.2 送りから前倒し)**
- 新 enum: `researching / visit_scheduled / visited / shortlisted / selected / rejected` を **単一 source-of-truth** に
- Favorites テーブルを削除 → heart ♡ tap は `researching → shortlisted` への status transition
- `prisma/schema.prisma` 変更 + migration 作成
- UI ラベル: 「気になる / 見学予定 / 見学済 / 検討中 / 決定 / 見送り」で全箇所統一
- 既存 favorite データを migration で `shortlisted` に backfill
- 関連: `venue-status-badge.tsx`, `heart-button.tsx`, `explore-content.tsx`, candidates/compare クエリすべて

**3c. /explore 情報設計 (P11)**
- AI Recommendations を上部 fixed carousel、通常 venue list との間に divider + 「すべての候補」見出し
- フィルタ: 「検索 / 雰囲気 / 状態」に用途別ラベル、tab 概念を排除
- `ai-recommendations.tsx` と `explore-content.tsx` を再構成

**3d. URL シート max-width (P12)**
- `src/components/ui/sheet.tsx` で `side="bottom"` 時に `max-w-[min(720px,100%)] mx-auto`
- modal / drawer 全般の width ポリシーを 1 箇所で統制

**3e. タブ遷移の即応 (P13 パート 1)**
- `bottom-nav.tsx` で `/coach` `/mypage` の `prefetch={false}` を削除
- mount 直後に warm-up (timer 0ms)、`onMouseEnter`/`onTouchStart` で先行 prefetch

### Step 4 — 旧「v3.2 送り」を全部攻める (Worktree: `wt-future`)
**4a. Photo Tier 3 (P8)**
- Browserless.io 統合 (env `BROWSERLESS_API_KEY`)
- `src/lib/supabase/storage.ts` の `uploadVenuePhotoFromUrl` で Tier 1+2 失敗時に **Tier 3 fallback**: Browserless で実ブラウザ fetch → Supabase upload
- Sentry に `photo_tier` 属性追加、成功率 telemetry

**4b. 旧 venue の backfill (R3)**
- admin server action `backfillDeepExtraction()` を新規作成
- `Venue.sourceUrl` が埋まっている既存 venue を iterate → `extractDeepDetail()` 再実行 → 19 cols 更新
- `/admin/backfill` 管理画面 or one-shot script (seed 類) として実装
- Vercel Cron で定期実行も可 (v4.1)

**4c. cacheComponents streaming 再計測 (P13 パート 2 + R4)**
- `/compare` `/candidates` の page.tsx で `Promise.all` 分解 → Suspense boundary で段階 streaming
- `loading.tsx` を skeleton から **実コンテンツ shape** (placeholder card) に差し替え、perceived latency 短縮
- Web Vitals (LCP/INP) を Vercel Analytics で計測、preview / production 比較

### Step 5 — Risk 対策実装 (Worktree: `wt-risk`)
**5a. Step 2a の 1 フレーム stale 防止 (R1)**
- venue-action-bar.tsx に `startTransition` + `useOptimistic` で削除済 id を即 filter

**5b. merge conflict prevention (R2)**
- 各 worktree で毎 commit 前に `git fetch origin && git rebase origin/develop`
- conflict が出たら即 resolve、main branch への merge 時は必ず clean rebase

**5c. dark mode 全画面カバレッジ**
- 全新規セクション / comparison-grid / URL シート / loading skeleton で dark mode 視認確認

### Step 6 — 統合 + 自動テスト
- 4 worktree を `feat/url-import-v4` に順次 merge (conflict 最小化順: bug → ux → future → risk)
- `npx tsc --noEmit` clean
- `npx vitest run` 全 pass (+ 新規 test: comparison-grid PC width, status migration, Browserless fallback, backfill)
- `npm run build` 成功
- Playwright E2E: 追加 journey (delete reflection, photo upload reflection, URL import end-to-end, /compare PC width, status consistency)

### Step 7 — Deploy
- `feat/url-import-v4` を develop に merge → Vercel auto preview
- preview READY 確認 → main に promote (production)
- Vercel 側で production alias `haretoki.vercel.app` が新 deploy を指していることを確認

### Step 8 — 本人アカウントで自動ログイン検証 ★完了条件★
- `e2e-runner` subagent を起動 (Vercel Agent Browser preferred)
- ユーザー credential (env or `.claude/secrets` から取得、無ければ事前に AskUserQuestion で取得) で `haretoki.vercel.app` にログイン
- P1-P13 + R1-R4 すべてのスモーク journey を自動実行
- 失敗があれば該当 worktree で直ちに修正 → 再 deploy → 再検証
- スクリーンショットを保存してレポート化

### Step 9 — 完了報告
- 各問題 / Risk の before / after、deploy URL、E2E 結果サマリをユーザーに提示
- memory 更新: 並列 worktree 運用の lessons、ステータス単一化の設計判断

---

## 並列実行 (tmux + git worktree + AgentTeams)

### worktree 構成
```
haretoki-wt-bug     → Step 2 動作バグ
haretoki-wt-ux      → Step 3 UI/UX
haretoki-wt-future  → Step 4 旧 v3.2 送り
haretoki-wt-risk    → Step 5 Risk 対策
```

### tmux ペイン (N+1 原則)
現在 1 ペイン (チャット) → `tmux split-window -d` を 4 回で 4 viewer 追加 → `tmux select-layout tiled` → focus チャットに戻す。各 viewer は `pane-title` を設定 (`wt-bug`, `wt-ux`, `wt-future`, `wt-risk`)、進捗に応じて `(P/X/Y) 実行中` → `✓完了` で更新。

### 各 worktree 内の team (AgentTeams)
- **architect** で最小単位分割
- **implementer** で実装
- **tester** で unit / integration test
- **reviewer** + **typescript-reviewer** + **ui-ux-reviewer** (Step 3 のみ)

### 順序
1. Step 1 (merge + deploy) を main worktree で即実行
2. その後 Step 2/3/4/5 を 4 worktree で並列
3. 全完了後、Step 6 統合、Step 7 deploy、Step 8 本人検証、Step 9 報告

---

## Critical Files

### Step 1
- git merge only (`feat/url-import-v3` → develop)

### Step 2 (wt-bug)
- `src/components/venues/venue-action-bar.tsx`
- `src/components/venues/add-photos-button.tsx`
- `src/server/actions/venues.ts`
- `src/app/(app)/venues/[id]/page.tsx`
- 印象セクション (Grep 後特定)

### Step 3 (wt-ux)
- `src/components/comparison/comparison-grid.tsx`
- `src/components/comparison/comparison-mobile-snapper.tsx`
- `prisma/schema.prisma` + `prisma/migrations/` (status 単一化)
- `src/components/venues/venue-status-badge.tsx`
- `src/components/venues/heart-button.tsx`
- `src/components/explore/explore-content.tsx`
- `src/components/venues/ai-recommendations.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/layout/bottom-nav.tsx`

### Step 4 (wt-future)
- `src/lib/supabase/storage.ts` (Browserless fallback)
- `src/lib/url-import/browserless-client.ts` (新規)
- `src/server/actions/admin/backfill-deep.ts` (新規)
- `src/app/(app)/compare/page.tsx` (Suspense 分割)
- `src/app/(app)/candidates/page.tsx` (Suspense 分割)
- 各 `loading.tsx` を shape-aware skeleton に

### Step 5 (wt-risk)
- `src/components/venues/venue-action-bar.tsx` (startTransition/useOptimistic)
- dark mode smoke (全 Step の成果物)

---

## Verification

### 自動 (CI 互換)
- `npx tsc --noEmit` clean
- `npx vitest run` 全 pass + 新規テスト (comparison-grid-pc.test.ts, status-migration.test.ts, browserless-fallback.test.ts, backfill-deep.test.ts, venue-action-bar-optimistic.test.tsx)
- `npm run build` 成功
- `npx playwright test` (E2E): delete reflection / upload reflection / URL import / compare PC / status consistency

### 手動動的スモーク (e2e-runner 自動化)
1. 本人 credential で `haretoki.vercel.app` ログイン
2. P1-P13 + R1-R4 の journey (各 1 回) を実行:
   - URL 投入 → 詳細ページで 4 section + 写真 + 新口コミ文言
   - 写真手動 upload → reload なし反映
   - 式場削除 → reload なし一覧から消える
   - /compare PC 幅で centred, 星 baseline 揃い, 名前クリップなし
   - /explore AI おすすめ / 通常 list 視覚分離
   - ステータス変更でラベル統一確認
   - URL シート PC 幅で max-width 制約
   - タブ遷移の体感改善
   - dark mode
   - mobile 375px
3. スクリーンショットをレポートに添付

### エッジケース
- 古い venue (19 cols 空) → backfill 後に 4 section 表示
- Browserless fallback 成功/失敗の Sentry telemetry
- status migration で既存 favorite データが shortlisted に正しく移行

---

## Out of scope (v4.1 以降)
- 新ドメイン (foreign な結婚情報サイト) 追加
- Chef/Cuisine の構造化 extraction 強化
- 比較ボードの AI 意思決定支援 (「この 3 件が合います」)
- 複数プロジェクト横断比較

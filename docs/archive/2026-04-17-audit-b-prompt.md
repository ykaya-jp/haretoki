# Track B: Performance / 体感速度 Audit

あなたは本 worktree (`/home/yusuke_kaya/projects/haretoki-wt-perf`, branch: `audit/performance`) で **plan mode** のまま作業する。

## ミッション

Haretoki（Next.js 16 App Router + Supabase + Prisma + framer-motion、モバイル 375px ファースト）の体感速度を総点検し、`docs/myreview/performance-audit.md` を書き切る。**実装はしない**。audit ドキュメントを書き上げたら ExitPlanMode で報告して終わる。

## 背景（必読）

- 実ユーザーフィードバック: `docs/myreview/problems_02.md` #11「画面変化が遅すぎてストレス」— フィルタ操作・タップ→画面変化のラグ・ロード遅延・画面遷移遅延
- デザインシステムの速度要件: `DESIGN.md` P3「フィードバックは 150ms 以内」P6 アニメーション速度予算
- framer-motion が 29 ファイル 229 箇所で使用 — 過剰アニメーションが体感速度を殺している疑い
- 本トラック全体計画: `/home/yusuke_kaya/.claude/plans/opus4-7-uiux-linked-knuth.md` の **Track B** セクション

## 使うべきエージェント / ツール

- **performance-optimizer** — bottleneck 特定とアルゴ改善（主導）
- **vercel:performance-optimizer** — Core Web Vitals / Vercel 最適化
- **typescript-reviewer** — Server Action / データ取得の型・非同期正しさ
- **database-reviewer** — Prisma クエリの N+1 / include 肥大化
- 領域 4 分割で **並列サブエージェント**:
  - Sub-B1: クライアント境界 — `"use client"` 10+ ファイル精査、Server/Client 境界、bundle サイズ
  - Sub-B2: データ取得 — Server Actions、Prisma、revalidatePath、useOptimistic/useTransition 導入余地
  - Sub-B3: ナビゲーション — `<Link prefetch>` 抜け、loading.tsx 品質、route transition 白画面
  - Sub-B4: アニメーション/レンダリング — framer-motion 削減、Image LQIP/sizes、CLS/INP

## 監査観点（13）

1. タップ → 画面変化 150ms 以内の抜け（filter chip、heart、tab 切替、list item）
2. Server Action latency p50/p95（コード読みで推定 + 可能なら実測手順を示す）
3. Prisma クエリ include / select 最適化
4. Route transition の白画面 / loading.tsx 抜け / skeleton 不整合
5. `<Link prefetch>` 指定漏れ
6. bundle サイズ（`npm run build` の route 別 first load JS 上位 10）
7. framer-motion 削減余地（CSS transition で足りる箇所、AnimatePresence 不要使用）
8. Image 最適化（sizes, priority, placeholder="blur", loading="lazy"）
9. Next.js 16 Cache Components (PPR, `use cache`) 導入余地
10. Middleware / Supabase auth の layout ブロック
11. Font loading（Noto Serif JP / Sans JP のサブセット、`next/font` 設定）
12. Chrome DevTools Performance trace 手順書（mobile 4G emulation で LCP/INP/CLS）
13. React 19 useOptimistic 導入候補リスト（heart、filter、rating、delete 等）

## 成果物: `docs/myreview/performance-audit.md`

必須セクション:

1. **Executive Summary** — 現状 LCP/INP/CLS の想定値（手元計測 or Vercel Speed Insights 推定）と目標値、Top 5 ボトルネック
2. **ボトルネック一覧（優先度順）** — 各項目に:
   - 計測値 or 観察された挙動 (before)
   - 原因（コード引用 + 該当ファイル:行番号）
   - 改善案（具体コード差分）
   - 期待改善値 (after 見込み)
   - 工数 (S/M/L)
3. **Quick Wins** — 半日〜1日で削れる遅延（prefetch、sizes 追加、use client 削減等）
4. **構造的改善** — Cache Components / Edge / PPR / Routing Middleware の導入設計
5. **回帰防止** — Lighthouse CI、@vercel/speed-insights、bundle size budget の設定案
6. **計測手順書** — Chrome DevTools / Vercel Agent / Playwright trace の具体コマンド

## 停止条件（ExitPlanMode 発動基準）

- audit .md が存在し、6 セクション全て埋まっている
- 最低 5 画面 (home/explore/venues/[id]/compare/coach) で LCP/INP/CLS の数値（実測 or 推定）が入っている
- 各項目に before/after コード差分 + 優先度 + 工数
- Quick wins と構造改善が明確に区別されている
- 実装可能な粒度

## 絶対にしないこと

- 実装（`.tsx` / `.ts` / `.prisma` への edit）
- main/develop へのコミット — audit .md 追加に閉じる
- problems_02.md の #1-10 バグ修正（別トラック/別セッション担当）
- 審美領域（別ペイン Track A 担当）
- Branch 変更、push、デプロイ

---

**では plan mode のまま、上記に従って 4 サブエージェントを並列で起動し、audit ドキュメントを書き切ってください。**

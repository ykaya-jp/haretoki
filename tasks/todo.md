# Phase 10 P1 Bundle A — Performance & Motion

## Tasks

- [x] 1a. /api/coach/stream route (SSE) with auth + history + persistence
- [x] 1b. ChatBar streaming + optimistic UI (SSE reader, fallback to server action)
- [x] 1c. ChatBubble typing indicator (3 pulsing gold dots)
- [x] 2. AIRecommendations sessionStorage cache (1h TTL)
- [x] 3. BottomNav optimistic active (useTransition + pending href, render-derived)
- [x] 4. Motion duration normalization (chat-bubble 0.22, candidates 0.28/0.3, duration-[400ms] → duration-200 × 12 files)
- [x] Model ID update: anthropic.ts + coach.ts → claude-sonnet-4-6
- [x] lint (0 errors, 4 pre-existing warnings) / vitest (64/64) / build (success)

## Review

- **Stream route** (`src/app/api/coach/stream/route.ts`): zod validation (1–500 chars), auth, loadUserContext, last-20 history piped into Claude messages array, SSE frames `data: {"text":"..."}\n\n` + `data: [DONE]` sentinel, persists assistant response on stream close. Returns 503 if `ANTHROPIC_API_KEY` missing.
- **ChatBar**: optimistic in-flight pair (user + empty assistant bubble) rendered above the fixed bar while SSE stream drains; chunk appender updates assistant content; `router.refresh()` + 80ms hold folds optimistic state back into persisted history. Aborts honored; errors fall back to `sendCoachMessage` Server Action.
- **ChatBubble**: assistant content === "" → framer-motion typing indicator (3 dots, 0.6s staggered opacity loop). Duration 0.9 → 0.22.
- **AIRecommendations**: `sessionStorage` key `ai-recs-v1` with 1h TTL; initial mount hydrates from cache and skips fetch; manual `更新` button passes `ignoreCache: true` and re-writes cache. Errors do not pollute cache.
- **BottomNav**: `useTransition` + `pendingHref` state; onClick sets pendingHref + starts transition; `activeHref` derived purely in render (no setState-in-effect) — pendingHref honored only while `isPending && !matchesHref(pathname, pendingHref)`, otherwise pathname wins. Self-correcting.
- **Motion**: candidates-view 0.9/0.8/0.7 → 0.28/0.3; chat-bubble 0.9 → 0.22; `duration-[400ms]` → `duration-200` across 12 files (partner-invite, visit-checklist, segmented-control, favorite-filter, decision-matrix, dimension-focus, checklist-comparison, priority-weights, add-photos-button, landing-page, login, signup). Luxury ease `[0.16, 1, 0.3, 1]` preserved.

## Verification

- `npm run lint` — 0 errors, 4 warnings (all pre-existing unused imports).
- `npx vitest run` — 64/64 passing (added `useRouter` mock to bottom-nav test).
- `npm run build` — successful; `/api/coach/stream` listed as dynamic route.

---

# Phase 11 P2 Bundle H — Performance & Bundle Optimization

## Tasks

- [x] 1A. recharts lazy load: extract `estimate-waterfall-chart.tsx` → `*-impl.tsx` + dynamic wrapper (ssr:false, skeleton loading)
- [x] 1B. canvas-confetti lazy load: `await import("canvas-confetti")` inside useEffect in decision-ceremony
- [x] 1C. embla lazy load: split photo-carousel into static single-photo path + dynamic multi-photo carousel
- [x] 2. BottomNav layoutId → CSS transform: computed `left`/`width` with `transition-[left,width]`
- [x] 3. /venues/[id] Suspense streaming: split Estimate/Reviews/Plans/Visits into async child components
- [x] 4. `getAIInsights` wrap with React `cache()` for same-request memoization
- [x] Verification: lint 0 errors, tests pass, build success, First Load JS reduced

## Review

- **1A recharts**: `estimate-waterfall-chart.tsx` → tiny `next/dynamic` wrapper (ssr:false, aspect-matched skeleton); real impl moved to `estimate-waterfall-chart-impl.tsx`. recharts now lives in its own ~314KB chunk (`.next/static/chunks/0hfaz.oyru3nr.js`), loaded only when a venue has predictedFinal estimate data.
- **1B confetti**: `decision-ceremony.tsx` drops the static `import confetti from "canvas-confetti"`; effect now does `await import("canvas-confetti")` after the prefers-reduced-motion gate and uses a `cancelled` flag so late-arriving imports don't fire confetti after unmount. Isolated into its own ~10KB chunk.
- **1C embla**: `photo-carousel.tsx` became a static shell that handles 0- and 1-photo paths with `<Image>`; 2+ photos render via a `next/dynamic`-loaded `photo-carousel-embla.tsx`. embla-carousel-react (~20KB) no longer pulled in on detail pages with ≤1 photo.
- **2 BottomNav**: deleted the `layoutId="bottomNavIndicator"` framer-motion FLIP and replaced with a single absolutely-positioned bar inside the nav container. `left` / `width` are computed from `activeIndex` as percentages (1/5 tabs, bar spans the middle half), and `transition-[left,width] duration-200` handles animation on the GPU. Icon-scale + badge motion preserved.
- **3 Suspense streaming on /venues/[id]**: above-the-fold (`getVenue` + `getFavorites`) stays synchronous; below-the-fold split into 4 Suspense boundaries — `RatingWithPartner` (fetches partner ratings), `ReviewsContent` (fetches reviews), `PlansContent` (fetches plans), `VisitsContent` (reuses embedded payload for symmetry). Skeletons use existing `Skeleton` component sized to approximate final layout.
- **4 cache()**: `getAIInsights` body extracted to internal `getAIInsightsImpl`; a `cache(getAIInsightsImpl)` memoizes per-request; exported async wrapper preserves `"use server"` contract. home ↔ coach now share one Prisma fan-out.

## Verification

- `npm run lint` — 0 errors (4 pre-existing warnings).
- `npx vitest run` — 64/64 passing.
- `npm run build` — success. Heavy deps isolated into on-demand chunks: recharts 314KB (was in initial bundle), canvas-confetti 10KB, embla 20KB. Estimated initial-bundle reduction on /venues/[id]: ~120KB raw (~40–50KB gzipped).


---

# Demo — Unauthenticated /demo walkthrough (feat/demo)

## Tasks

- [x] Middleware: add `/demo` to public paths
- [x] Demo data provider + `useDemoData()` hook
- [x] Demo layout with top banner, demo bottom nav, `data-demo` marker
- [x] /demo, /demo/venues, /demo/venues/[id], /demo/candidates, /demo/coach pages
- [x] DemoVenueCard with local-state heart
- [x] Landing: 「まずは体験してみる」 + 「実際に触ってみる」 CTAs
- [x] Verify: lint 0 errors, vitest 128/128, build success
- [x] Commit on feat/demo (no push)

## Review

- Public paths `/demo` added in `src/middleware.ts` (excludedPaths) + `src/lib/supabase/middleware.ts` (publicPaths). Unauth visitors hit `/demo/*` without redirect.
- Provider has 3 venues (aoyama-grace, kamakura-hana, yokohama-bay), 2 initial favorites, 1 visit with checklist, 1 estimate, 4-turn coach transcript, 2 insights. Pure React state — no DB, no server actions.
- Layout mirrors (app)/layout.tsx skeleton, wraps in DemoDataProvider, renders sticky gold-subtle banner with「はじめる」CTA, mounts DemoBodyMarker (sets body.dataset.demo=1 in effect with cleanup).
- Pages: home uses real JourneyCard pre-filled; venue detail renders photo/rating/heart/chips/estimate/visit/reviews; candidates has 一覧/比較 tabs with 6-row comparison table; coach shows 4-turn chat + disabled input with tooltip "体験モードではチャットは送れません、登録後にお使いください".
- Interactive: heart toggle on DemoVenueCard updates provider's Set<string>; /demo/candidates reflects changes live.
- Landing: subtle gold-dotted "まずは体験してみる" underline-link below hero signup/login; pill "実際に触ってみる" CTA centered after How-It-Works mockup.

## Verification

- `npm run lint` — 0 errors, 5 pre-existing warnings.
- `npx vitest run` — 128/128 passing.
- `npm run build` — success. `/demo`, `/demo/venues`, `/demo/candidates`, `/demo/coach` are static (○); `/demo/venues/[id]` is dynamic (ƒ).


---

# Phase 1 — 体感速度の底上げ（remediation-master-plan.md §3）

> 目的: タップ→画面表示の待ち時間を半減。モバイル実機でタブ切替 < 500ms、/home LCP < 1.8s、ホーム→候補の"空白"を体感で消す。

## 進め方

`docs/myreview/remediation-master-plan.md §7` のブランチ戦略に従い、**git worktree + 並列実装**。共通基盤変更（`src/server/auth.ts` の cache 化など）は先に単独で入れてから並列フェーズに入る。

### ブランチ構成

| ブランチ | スコープ | タスク |
|---|---|---|
| `perf/layout-parallelize` | layout の直列await解消、authのReact.cache化 | P1-1, P1-2 |
| `perf/route-split` | /home・/candidates の軽量化、/venues/[id] の分割ストリーム | P1-3, P1-4 |
| `perf/bundle-optim` | optimizePackageImports、Shippori/Noto Serif 絞り、画像 sizes/priority | P1-7 |
| `perf/next16-features` | `"use cache"` + cacheTag、PPR、View Transitions | P1-6 |

P1-5（bottom-nav の motion 除去 + 全タブ prefetch）は **Phase 11/Bundle H で既に実装済み**（`tasks/todo.md` の Phase 11 §2 参照）。→ スキップ

## Tasks

### Wave 0 — 共通基盤（単独実装、develop 直）

- [ ] 0-1. `src/server/auth.ts` の `requireUser` / `requireProjectMembership` を `React.cache()` でラップ（P1-2）
  - 同一リクエスト内の Supabase auth 往復を 1 回に集約
  - `"use server"` ディレクティブとの両立を確認（cache内でサーバーサイド処理OK）

### Wave 1 — 4ブランチ並列（worktree + AgentTeams）

#### perf/layout-parallelize (P1-1)
- [ ] `src/app/(app)/layout.tsx`: `getOrCreateProject` と `getBottomNavBadgeCounts` を `Promise.all`
- [ ] badgeCounts を `<Suspense>` で包み nav を先に flush
- [ ] 期待効果: 全ページで -150〜300ms

#### perf/route-split (P1-3, P1-4)
- [ ] `/home`: `getPendingInvitation` を `Promise.all` に統合
- [ ] `/candidates`: `getHomeData` 依存を削除し `getCurrentUserName()` に分離。`getVenues` を id/name のみの軽量版に置換（比較用途）
- [ ] `/venues/[id]`: `getVenue` を `getVenueHeader` / `getVenueEstimates` / `getVenueVisits` に分割し page.tsx で独立 Suspense 化（Phase 11 の Suspense 分割と重ねず、hero を即 flush する方針へ再構成）
- [ ] 期待効果: LCP -400〜800ms

#### perf/bundle-optim (P1-7)
- [ ] `next.config.ts` に `experimental.optimizePackageImports: ["lucide-react", "framer-motion"]`
- [ ] `recharts` / `EstimateWaterfallChart` の `dynamic({ ssr: false })` は実装済みか確認、漏れあれば追加
- [ ] フォント最適化: Shippori Mincho `preload: false`、Noto Serif JP weight を 400 のみに絞る
- [ ] 画像: Supabase ホスト限定 `remotePatterns`、`sizes` 明示、LCP 候補に `priority`

#### perf/next16-features (P1-6)
- [ ] 読み取り系 Server Action（`getHomeData`, `getAIInsights`, `getFavorites`, `getBottomNavBadgeCounts`）に `"use cache"` + `cacheTag("project:{id}")` 導入
- [ ] 書き込み系（`toggleFavorite`, `saveEstimate`, 他）で `revalidateTag("project:{id}")` を呼ぶ
- [ ] `experimental_ppr = true` を `/home`, `/explore` で有効化
- [ ] View Transitions experimental を有効化

### Wave 2 — 統合 & 計測

- [ ] 各ブランチを develop にマージ（競合解消）
- [ ] Playwright E2E でスモーク（`/home → 候補`, `/venues/:id`, `/mypage`, `/coach`）
- [ ] Lighthouse モバイル計測: 初回 /home LCP < 1.8s、タブ切替 < 500ms
- [ ] Ship Cycle: develop push → vercel prod → worktree 掃除

## 方針確認ポイント（ユーザー承認待ち）

1. **4ブランチ並列 worktree + AgentTeams** で進める。共通基盤（Wave 0）は先に単独で入れる
2. **P1-5 (bottom-nav) はスキップ**（Phase 11 で実装済み）
3. **Next.js 16 の `"use cache"` / PPR / View Transitions** を本番導入する（experimental だが §3 で指定）
4. 完了判定: モバイル実機でタブ切替 < 500ms、/home LCP < 1.8s

## Review

（実装完了後に記載）


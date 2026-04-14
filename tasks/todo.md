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


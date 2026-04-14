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

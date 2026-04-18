# Performance Audit — Haretoki (2026-04-17)

> 対象: Next.js 16.2.3 / React 19.2.4 / Prisma 7.7 / framer-motion 12.38 / @supabase/ssr 0.10 / Vercel Tokyo edge + Supabase US east
>
> 監査手法: 4 領域並列コード監査 (クライアント境界 / データ取得 / ナビゲーション / アニメ・レンダリング) + Next 16 / React 19 / Core Web Vitals ベストプラクティス照合 + 5 画面 LCP/INP/CLS 静的推定
>
> 起点: `docs/myreview/problems_01.md` 共通 #1「画面遷移する際、またはリロードする際、タップしてからの反応や画面表示までが遅すぎる」。DESIGN.md P3「タップ→反応 150ms 以内」/ P6 アニメーション速度予算との乖離を暴く。
>
> 範囲外: problems_01.md の #2〜#15 機能不具合修正 (別トラック)、審美領域 (Track A)

## 1. Executive Summary

### 1.1 現状の Core Web Vitals 推定値 (Mobile Fast 4G / 1.6Mbps / 150ms RTT)

| Route | LCP | INP | CLS | 判定 |
|-------|-----|-----|-----|------|
| `/home` | **2.4 s** | 180 ms | 0.05 | LCP borderline / INP OK / CLS OK |
| `/explore` | **3.1 s** | **250 ms** | 0.08 | 全項目悪化 |
| `/venues/[id]` | **2.8 s** | **220 ms** | 0.04 | LCP / INP 悪化 |
| `/compare` | 2.0 s | **280 ms** | **0.12** | INP / CLS 悪化 |
| `/coach` | 1.9 s | **300 ms+** | **0.15** | INP / CLS 大幅悪化 |

**全体所感**: モバイル体感上の痛点は 2 点に収束する。
1. **Server-side の中継レイテンシ** — middleware が全 page request で Supabase `auth.getUser()` を呼び、`/venues/[id]` は 9 並列クエリを毎回フル取得して `use cache` が効いていない。
2. **Client-side の過剰 JS** — `"use client"` 123 ファイル / framer-motion 213 箇所 / PostHog と Sentry Replay が全 route に eager bundle / BottomNav にも framer spring が常駐し、4G 帯域でも JS 実行が INP を押し下げている。

### 1.2 目標 (3 スプリント後)

| Route | LCP 目標 | INP 目標 | CLS 目標 |
|-------|----------|----------|----------|
| `/home` | **< 2.0 s** | < 150 ms | < 0.05 |
| `/explore` | **< 2.3 s** | **< 180 ms** | < 0.08 |
| `/venues/[id]` | **< 2.0 s** | < 180 ms | < 0.05 |
| `/compare` | < 1.8 s | **< 200 ms** | **< 0.1** |
| `/coach` | < 1.8 s | **< 200 ms** | **< 0.1** |

### 1.3 Top 5 ボトルネック (優先度順)

| # | ボトルネック | 影響 route | 推定 before | 推定 after | 工数 |
|---|------------|-----------|------------|-----------|------|
| 1 | middleware の `supabase.auth.getUser()` が全 page request で発火 | 全 route | TTFB +100〜300 ms | TTFB -100 ms 以上 | M |
| 2 | `/venues/[id]` 9 並列クエリが `use cache` 未適用 | venue detail | TTFB 500〜800 ms | TTFB 150 ms | M |
| 3 | `MotionProvider` + 213 箇所の `motion.*` が全 route bundle に eager | 全 route | JS 実行 +80〜150 ms | JS 実行 -60 ms 以上 | L |
| 4 | `ExploreContent` の `AnimatePresence mode="popLayout"` が filter 変更で全カード re-mount | `/explore` | INP 250 ms | INP 120 ms | M |
| 5 | favorite / rating / checklist トグルが Server Action 待ち (楽観的更新なし) | 全 route | 体感 200〜400 ms | 体感 0 ms (楽観反映) | M |

---

## 2. ボトルネック一覧 (優先度順)

> 各項目: before (計測/観察) / 原因 (ファイル+行) / 改善案 (コード差分スケッチ) / after (期待) / 工数 (S=半日 M=1-2日 L=3-5日) / 優先度 (P0 致命 / P1 高 / P2 中)

---

### B-01 【P0 / M】middleware の `supabase.auth.getUser()` が全リクエストで発火

**before**: `src/middleware.ts:5` が全 page request (static asset 以外) で `updateSession(request)` を呼び、内部で `supabase.auth.getUser()` が JWT refresh + `/auth/v1/user` への HTTP を発生させる。Supabase Tokyo region 未使用 (US east) の場合、RTT 150 ms × 2 = p50 200 ms / p95 500 ms の TTFB 上乗せ。matcher は画像系のみ除外、`.css/.js/.woff2/_next/data/monitoring/robots.txt/sitemap.xml/manifest.webmanifest/icons/` が抜けて余計に middleware を走らせる。

**原因**:
- `src/middleware.ts:1-25` — 毎リクエスト auth 呼び出し
- `src/middleware.ts:27-31` — matcher に font / css / JS / data route / sentry tunnel を含めてしまう
- Node 標準 runtime (Edge Runtime 未指定)

**改善案**:
```ts
// src/middleware.ts (sketch)
export const runtime = "edge"; // ★ Tokyo edge で Supabase RTT 短縮

// matcher 拡張
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|monitoring|manifest.webmanifest|robots.txt|sitemap.xml|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|css|js|map)$).*)",
  ],
};
```
さらに `updateSession` を「cookie の有無 + 有効期限だけで判定 → 失効時のみ `getUser()`」へ薄くする。Supabase SSR 公式ガイドから一歩踏み出す判断だが、実運用で expired JWT への到達率は極めて低い (クライアント側で refresh される)。

**after**: TTFB p50 -100 ms、p95 -300 ms。全 route の LCP 一律 -150〜200 ms。

---

### B-02 【P0 / M】`/venues/[id]` の 9 並列クエリが `use cache` 未適用

**before**: `src/app/(app)/venues/[id]/page.tsx` が `getVenueHeader` / `getVenueEstimates` / `getVenueVisits` / `getPartnerRatings` / `getFavorites` / `getVenueReviews` / `getVenueReviewEstimateAggregate` / `getVenuePlans` / `getMoneyReality` を並列発火。`home.ts` / `insights.ts` / `favorites.ts` は `use cache` 済だが、venue 詳細系は未適用。Supabase round-trip (US east) が最遅クエリ律速で TTFB 500〜800 ms。

**原因**:
- `src/server/actions/venues.ts:197-270` — `getVenue` / `getVenueHeader` は cache なし
- `src/server/actions/ratings.ts` — `getPartnerRatings` cache なし
- `src/server/actions/reviews.ts` — `getVenueReviews` / `getVenueReviewEstimateAggregate` cache なし
- `src/server/actions/plans.ts` — `getVenuePlans` cache なし

**改善案**:
```ts
// src/server/actions/venues.ts (sketch)
"use cache";
import { cacheTag } from "next/cache";

export async function getVenueHeader(venueId: string) {
  cacheTag(`venue:${venueId}`);
  // ... 既存実装
}
// 以降 getVenueEstimates / getVenueVisits / getPartnerRatings も同様
```
mutation 側 (rating upsert / estimate save / review add 等) で `revalidateTag(\`venue:${venueId}\`)` を発火。`project:${projectId}` タグと併用し、粒度を細分化する (B-08 参照)。

**after**: venue detail TTFB 500〜800 ms → 150 ms、LCP 2.8 s → 2.0 s、INP も re-fetch オーバーヘッドが消えて 220 ms → 170 ms。

---

### B-03 【P0 / L】`MotionProvider` + framer-motion 213 箇所が全 route に eager bundle

**before**: `src/components/providers/motion-provider.tsx` が root layout に常駐 (`src/app/layout.tsx:8`)。結果、**framer-motion が全 route の First Load JS に含まれる**。26 ファイル × 213 箇所 (`motion.*` / `AnimatePresence` / `useAnimation` / `useMotionValue` / `useScroll`) のうち約 90 箇所 (58%) が CSS transition / animate-in で代替可能な fade-in / scale tap feedback。

**原因**:
- `src/app/layout.tsx:8,159` — MotionProvider root mount
- `src/components/home/editorial-hero.tsx:196` — motion.section (fade-in only)
- `src/components/home/daily-ritual.tsx:34` — motion.section (fade-in only)
- `src/components/onboarding/onboarding-flow.tsx:389` — motion.div fade-in
- `src/components/comparison/decision-matrix.tsx:255,689-738` — AnimatePresence single-child
- `src/components/candidates/candidates-view.tsx:236` — whileTap scale
- `src/components/layout/bottom-nav.tsx:140-153` — motion.div + motion.span (全タブ遷移で spring)
- `src/components/landing/landing-page.tsx` 全域 — whileInView 10 箇所
- `src/components/landing/demo-sequence.tsx:262-271` — LoadingDots (永続 rAF 3 本)
- `src/components/venues/rating-section.tsx:202-228` — AnimatePresence mode="wait"
- `src/components/explore/add-venue-sheet.tsx:358,595,616,637` — AnimatePresence single child × 4

**改善案** (代表 3 件):
```tsx
// 1) BottomNav icon scale を CSS に置換
// src/components/layout/bottom-nav.tsx:140 (before)
<motion.div animate={{ scale: isActive ? 1.12 : 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}>
  <Icon className="h-5 w-5" strokeWidth={1.75} />
</motion.div>

// after
<div className={cn("transition-transform duration-200 ease-out",
                   isActive && "scale-110")}>
  <Icon className="h-5 w-5" strokeWidth={1.75} />
</div>
```
```tsx
// 2) EditorialHero の client 境界を深く
// src/components/home/editorial-hero.tsx:196 (after)
// 新規: editorial-hero-motion.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
export function HeroMotionSection({ children }: { children: React.ReactNode }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.section
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.9, ease: [0.16,1,0.3,1] }}
    >{children}</motion.section>
  );
}
// editorial-hero.tsx: "use client" を削除し HeroMotionSection を wrap
```
```tsx
// 3) LoadingDots を Tailwind animate-pulse に
// src/components/landing/demo-sequence.tsx:262 (after)
{[0,1,2].map(i => (
  <span key={i}
        className="inline-block h-1 w-1 rounded-full bg-primary-foreground animate-pulse"
        style={{ animationDelay: `${i * 150}ms` }} />
))}
```

**after**: home / landing / bottom-nav から framer-motion が排除できれば First Load JS -30〜50 KB gzip、ルート遷移時 INP -40 ms。最終的に landing Server Component 化で TTI -200 ms が見込める。

---

### B-04 【P1 / M】`ExploreContent` のリスト filter INP 250 ms

**before**: `src/components/explore/explore-content.tsx:270-287` が `AnimatePresence mode="popLayout"` + stagger delay で filter 変更のたびに全カード exit → enter。カード 10 件で stagger 最大 200 ms + framer layout 計算で INP 250 ms。さらに `useSearchParams` 依存で ExploreContent 全体が re-render。

**原因**:
- `src/components/explore/explore-content.tsx:270-287` — AnimatePresence popLayout
- `src/components/explore/explore-content.tsx:87-140` — useCallback / useMemo / startTransition だが `useDeferredValue` 未採用

**改善案**:
```tsx
// src/components/explore/explore-content.tsx (sketch)
const deferredFilters = useDeferredValue(liveFilters);
const filteredVenues = useMemo(
  () => venues.filter(v => matches(v, deferredFilters)),
  [venues, deferredFilters]
);
// AnimatePresence + motion.div stagger を削除し、layout prop だけ残す:
<LayoutGroup>
  {filteredVenues.map(v => (
    <motion.div key={v.id} layout="position"
                className="animate-in fade-in duration-300">
      <VenueCard venue={v} />
    </motion.div>
  ))}
</LayoutGroup>
```

**after**: INP 250 ms → 120 ms。filter chip タップから 150 ms 以内で視覚反応。

---

### B-05 【P1 / M】楽観的更新 (useOptimistic / useTransition) 未採用

**before**: heart toggle / rating 更新 / checklist yes-no トグル / status 変更 / venue 削除が全て Server Action 完了待ち。4G だと 200〜400 ms の "タップしたのに反応がない" 感。

**原因 (候補 TOP 10、database-reviewer 特定)**:

| UI アクション | Server Action | 現状 |
|-------------|---------------|------|
| ♡ お気に入りトグル | `toggleFavorite` (`favorites.ts:24`) | SA 待ち |
| チェックリスト yes/no | `updateChecklistItemStatus` | SA 待ち (visit 内 63 アイテムでの体感悪化主要因) |
| 評価スライダー | `saveRatings` / `saveDirectRatings` | SA 待ち |
| チェックリスト ON/OFF | `toggleItem` | SA 待ち |
| ステータス変更 | `updateVenueStatus` | SA 待ち |
| コーチメッセージ送信 | `sendCoachMessage` | skeleton 出る前に遅延 |
| 合意事項追加 | `createAgreement` / `updateAgreement` | SA 待ち |
| venue 削除 | `deleteVenue` | SA 待ち |
| 通知既読 | `markNotificationRead` | SA 待ち |
| filter 確定 | `updateSearchParams` | URL 反映待ち |

**改善案** (代表: heart toggle):
```tsx
// src/components/explore/venue-card.tsx (sketch)
"use client";
import { useOptimistic, useTransition } from "react";

export function FavoriteButton({ venueId, initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(initial);
  return (
    <button
      onClick={() => startTransition(async () => {
        setOptimistic(!optimistic);
        await toggleFavorite(venueId); // 失敗時は toast で rollback hint
      })}
      aria-pressed={optimistic}
      className="active:scale-[0.9] transition-transform">
      <Heart fill={optimistic ? "currentColor" : "none"} />
    </button>
  );
}
```

**after**: 全トグル系で体感 0 ms。DESIGN P3 「タップ→反応 150ms 以内」完全達成。

---

### B-06 【P1 / M】`coach` 画面の INP 300 ms+ / CLS 0.15

**before**: chat stream の SSE parse + markdown 風レンダリング + insight card 多数の client hydration が main thread を占有。新メッセージ追加で下スクロール中にレイアウトシフトが起きる。

**原因**:
- `src/components/coach/chat-bubble.tsx:4` — framer motion typing animation (CSS 代替可能)
- `src/components/coach/chat-history.tsx:1` — `useEffect` スクロールのためだけに 全 history を client 化
- `src/server/actions/coach.ts:284-307` — `loadUserContext` と message history 取得が直列

**改善案**:
```tsx
// 1) chat-history を二分割
// chat-history-scroller.tsx (新、"use client", 5行の useEffect wrapper)
// chat-history.tsx ("use client" 削除 → Server Component、list は SSR)
```
```ts
// 2) sendCoachMessage の直列を並列に
// src/server/actions/coach.ts:284 (sketch)
const [context, history] = await Promise.all([
  loadUserContext(projectId),
  prisma.coachMessage.findMany({
    where: { sessionId }, orderBy: { createdAt: "desc" }, take: 20,
  }),
]);
```
```css
/* 3) coach chat container に content-visibility */
.chat-list { content-visibility: auto; contain-intrinsic-size: 0 600px; }
```

**after**: INP 300 ms → 180 ms、CLS 0.15 → 0.08。

---

### B-07 【P1 / S】PostHog / Sentry Replay が全 route eager bundle

**before**: `src/components/providers/posthog-provider.tsx:5` が `import posthog from "posthog-js"` をトップレベルで行うため、`NEXT_PUBLIC_POSTHOG_KEY` が空でも `posthog-js` が bundle される (~40 KB gzip)。`sentry.client.config.ts:9` で `replaysOnErrorSampleRate: 0.5` により `@sentry/replay` (~50 KB gzip) も条件付きロード。

**原因**: 両者とも「使っていない環境でも常時 bundle」。

**改善案**:
```tsx
// src/components/providers/posthog-provider.tsx (sketch)
useEffect(() => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  import("posthog-js").then(({ default: posthog }) => { posthog.init(key, {...}); });
}, []);
```
```ts
// sentry.client.config.ts
replaysOnErrorSampleRate: 0,  // まず 0 で Replay SDK を除外
// or integrations を lazy import
```

**after**: 全 route の First Load JS -90 KB gzip。3G で LCP -200〜400 ms。

---

### B-08 【P1 / M】`revalidatePath` の乱用で cache 粒度が粗い

**before**: `toggleFavorite` (`src/server/actions/favorites.ts:24`) が `/explore` + `/candidates` + `/home` を 3 路 revalidate。`venues.ts` / `visits.ts` / `decisions.ts` 等でも `revalidateTag` + 複数 revalidatePath の重複。favorite 1 クリックで page tree 全再生成。

**原因**:
- `src/server/actions/favorites.ts:24-38`
- `src/server/actions/venues.ts:65-67,263-266,664-666`
- `src/server/actions/visits.ts:49-52`
- `src/server/actions/decisions.ts:64-66,120-122`
- `src/server/actions/coach.ts:108,193,205,335,387` (tag なし path のみ)

**改善案**:
```ts
// src/server/actions/favorites.ts (sketch)
// before
revalidateTag(`project:${projectId}`, { expire: 0 });
revalidatePath("/explore");      // 削除
revalidatePath("/candidates");   // 削除
revalidatePath("/home");         // 削除
// after
revalidateTag(`project:${projectId}`, { expire: 0 });

// coach.ts にも tag を導入
// before: revalidatePath("/coach")
// after: revalidateTag(`coach-sessions:${projectId}`)
```
タグ粒度を細分化: `venue:${id}` / `estimates:${venueId}` / `scores:${venueId}` / `coach-sessions:${projectId}`。

**after**: mutation 後の無駄な RSC 再生成が消え、favorite 連打でも一貫して体感即応。

---

### B-09 【P1 / S】Prisma クエリの `include` 肥大化 / select 未指定

**before**: 大テーブル (Venue / Estimate / Review / Visit / VenueScore) で `include: { ...: true }` 全カラム取得。

**原因 (抜粋)**:
- `src/server/actions/venues.ts:201-216` `getVenue` — 4 層 include + scores 全カラム
- `src/server/actions/visits.ts:25` — venue 全カラム取得 (name のみ使用)
- `src/server/actions/insights.ts:44-49` — EstimateItem 全カラム
- `src/server/actions/venues.ts:311-329` `getVenueVisits` — `ratings: true` / `checklist: true`
- `src/server/actions/vibe-search.ts:24-38` — scores/items 全カラム

**改善案**:
```ts
// 代表: getVenueVisits (sketch)
prisma.visit.findMany({
  where: { venueId },
  select: {
    id: true, status: true, scheduledAt: true,
    ratings: { select: { dimension: true, score: true, userId: true, createdAt: true } },
    notes: { select: { id: true, content: true, tags: true, createdAt: true,
                       media: { select: { mediaUrl: true, type: true } } } },
    checklist: { select: { id: true, item: true, status: true, category: true } },
  },
});
```
さらに `getVenue` 自体は廃止候補 (既に分割された header/estimates/visits を使うべき)。

**after**: payload -30〜50%、Prisma decode 時間短縮で SA p95 -30 ms 程度。

---

### B-10 【P1 / S】Prisma schema の missing index

**before**: クエリで使うが `@@index` が無い列が複数。

**原因**:
- `VenueFavorite.venueId` — index なし (JOIN 経由の `where: { venue: { projectId } }` で Seq Scan 化リスク)
- `Venue.(projectId, updatedAt)` 複合なし — `home.ts:69` `orderBy: { updatedAt: "desc" } LIMIT 5` が index 外ソート
- `CoachMessage.(sessionId, createdAt)` — sessionId のみ。LIMIT 20 が index only scan 不可
- `AiAnalysis.(projectId, type, createdAt)` — createdAt TTL チェックで heap fetch
- `VenueChecklistAnswer.(venueId, projectChecklistId)` — 2 列複合なし
- `VisitRating.(visitId, userId)` — 複合なし

**改善案**:
```prisma
// prisma/schema.prisma (sketch)
model VenueFavorite { @@index([venueId]) /* + 既存 */ }
model Venue         { @@index([projectId, updatedAt(sort: Desc)]) }
model CoachMessage  { @@index([sessionId, createdAt(sort: Desc)]) }
model AiAnalysis    { @@index([projectId, type, createdAt]) }
model VenueChecklistAnswer { @@index([venueId, projectChecklistId]) }
model VisitRating   { @@index([visitId, userId]) }
```
マイグレーション方針: `CREATE INDEX CONCURRENTLY` (Prisma 直接サポートはないが migration SQL を手動編集)。本番適用前に PostgreSQL `pg_stat_user_indexes` で現行 index 使用率を確認。

**after**: home list query -50%、coach history fetch -40%、AI cache lookup -30%。

---

### B-11 【P1 / M】loading.tsx / error.tsx の網羅ギャップ

**before**:
- `(app)/loading.tsx` (旧 HomeLoading bento) と `home/loading.tsx` (editorial) が重複。home segment の loading が優先されるが、home segment を持たない route (accept-invite 等) で旧 bento が fallback として出る可能性。
- `(app)/error.tsx` と `venues/[id]/error.tsx` のみ。他 segment でエラー時 bottom-nav が消え `RealtimeProvider` WebSocket も再接続。

**原因**:
- `src/app/(app)/loading.tsx` — 古い skeleton が残存
- error.tsx 不在 route: coach / explore / candidates / home / compare / checklist / mypage / notifications / journey / settings / onboarding / venues/[id]/checklist / visits/[visitId]/prep / candidates/duel

**改善案**:
- `(app)/loading.tsx` を汎用シンプル fallback (spinner + message) に差し替え
- `src/components/errors/segment-error-card.tsx` に現行 `(app)/error.tsx` の中身を抽出
- 各主要 route (home / explore / candidates / coach / compare / checklist) に 10 行の segment error.tsx を追加

**after**: SA 失敗時も bottom-nav と WebSocket が生き残り、ユーザーは別タブに逃げられる。

---

### B-12 【P1 / S】`<Link prefetch={false}>` の誤用

**before**: 19 箇所の `prefetch={false}` のうち 6 箇所は「ユーザーが次に必ず行く」動線。prefetch が効かず遷移時に白画面 200〜400 ms。

**原因** (要変更箇所):

| file:line | 対象 | 変更 |
|-----------|------|------|
| `src/app/(app)/candidates/page.tsx:77` | `/checklist` | `prefetch={undefined}` (default) |
| `src/app/(app)/venues/[id]/checklist/page.tsx:58` | `/venues/[id]` 戻り | default に |
| `src/components/candidates/candidates-view.tsx:217` | `/candidates/duel` | default に |
| `src/components/candidates/couple-gap-section.tsx:75` | `/venues/[id]` | default に |
| `src/components/candidates/duel-client.tsx:391` | `/venues/[winner.id]` | default に |
| `src/components/visits/visit-section.tsx:197` | `/visits/[id]/prep` | default に |

さらに `src/components/candidates/duel-client.tsx:391` や `visits/[visitId]/prep` への遷移は hover / touchstart でも warm したいので、既存 `PrefetchLink` パターンが使える箇所は置き換える。

**after**: 6 箇所の主要動線で白画面消失。体感 200 ms 改善。

---

### B-13 【P2 / S】next/image の `sizes` / `priority` / `blur` 漏れ

**before**:
- `src/components/visits/visit-checklist.tsx:223` (thumbnail 64px fill) — sizes 未指定
- `src/components/comparison/decision-matrix.tsx:502` (avatar 48px fill) — sizes 未指定
- `src/components/comparison/priority-weights.tsx:163` (thumbnail 64px fill) — sizes 未指定
- `src/components/home/recent-venues.tsx:63-68` — LCP 候補だが `priority` 未指定
- `src/components/landing/landing-page.tsx:93-102` — `priority` 付きだが `sizes` 未指定 (preload ヒント不正確)
- `src/components/ui/empty-state.tsx:41-42` — `priority` 過剰、`loading="lazy"` に

**改善案**: 各 `fill` に `sizes="48px"` / `"64px"` / `"300px"` / `"100vw"` を適切に追加。LCP 候補には `priority`、非 LCP 候補の `priority` を外す。

**after**: 無駄な 100vw 解像度取得を排除、Supabase egress -10〜20%、LCP 画像を正しく preload。

---

### B-14 【P2 / S】Shippori Mincho の weight × 3 + preload: true 問題

**before**: `src/app/layout.tsx:37-44` が `weight: ["400","500","600"]` + `preload: true`。`subsets: ["latin"]` 指定で latin のみ preload されるが、実用価値は日本語グリフにあり、日本語は unicode-range lazy fetch → headline 日本語 FOIT が Android Chrome で顕著。

**改善案**:
```ts
// src/app/layout.tsx (sketch)
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400"],              // 3 → 1
  variable: "--font-shippori-mincho",
  display: "optional",          // swap → optional (FOIT 受容、fallback を最大限活用)
  preload: false,               // 日本語 glyph が latin preload の後追いになる問題を回避
  fallback: ["Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS Mincho", "serif"],
});
```

**after**: hero 見出しの表示開始 -200〜500 ms (低速 Android)、bundle -10〜16 KB。

---

### B-15 【P2 / S】React 19 `useCallback` / `useMemo` 過剰使用

**before**: React Compiler (Next 16 experimental) 有効化を検討する場合、手動 memoization は冗長。現状 compiler は未有効。`src/components/explore/explore-content.tsx:67,87,103,110` に集中。

**改善案**: まず React Compiler を opt-in 検証し、パフォーマンステストで劣化がないことを確認 → 有効化後に `useMemo` / `useCallback` を段階削除。

**after**: コード削減と長期保守性。計測上の短期改善は小さい。

---

### B-16 【P2 / S】Prisma ループ内 await / 直列パターン

**before**:
- `src/server/actions/reviews.ts:315-322` `batchAnalyzeVenueReviews` — reviews ループ内で `analyzeVenueReviews` を逐次 await。各 Claude API 15 s タイムアウトで 10 件 = 最大 150 s
- `src/server/actions/ratings.ts:31-47` — `$transaction(async tx)` 内で 14 dimension を逐次 upsert
- `src/server/actions/visits.ts:60-70` `completeVisit` — visit.update / venue.update 直列
- `src/server/actions/rating-comparison.ts:22-38` — venue.findFirst と projectMember.findMany 直列

**改善案**:
```ts
// reviews.ts (sketch) — venues.ts の limitedAll を再利用
import { limitedAll } from "./venues";
const results = await limitedAll(
  reviews.map(r => () => analyzeVenueReviews(r)), 2
);

// ratings.ts (sketch) — batched transaction に
const upserts = Object.entries(parsed.data.ratings).map(([dim, score]) =>
  prisma.visitRating.upsert({ /* ... */ })
);
await prisma.$transaction(upserts);
```

**after**: レビュー一括分析 150 s → 60 s、14 dim upsert 14 round-trip → 1 batch。

---

### B-17 【P2 / S】next-intl 未使用で bundle 残留

**before**: `package.json:36` に `next-intl: ^4.9.1` があるが `src` 内で `from "next-intl"` 参照は 0 件。next.config は `withNextIntl` を wrap している (`next.config.ts:97`) ため実体ロードされている。

**改善案**: 本当に未使用なら `npm uninstall next-intl` + `next.config.ts` の wrap 解除。多言語対応ロードマップにある場合は保留。

**after**: 未使用なら First Load JS -10 KB gzip。

---

## 3. Quick Wins (半日〜1 日で削れる遅延)

> 工数 S のみ。リスクが極小で即着手できる 12 項目。

| # | 作業 | 対象 file | 工数 | 期待効果 |
|---|------|----------|------|----------|
| QW-01 | `(app)/loading.tsx` を汎用 spinner に置換 | `src/app/(app)/loading.tsx` | 0.25 h | 重複 skeleton 排除 |
| QW-02 | middleware matcher を拡張 | `src/middleware.ts:27` | 0.5 h | middleware 実行 -30% |
| QW-03 | middleware を `runtime = "edge"` に | `src/middleware.ts` | 0.5 h | auth RTT -30〜80 ms |
| QW-04 | 誤用 `prefetch={false}` 6 箇所を default に | B-12 表参照 | 0.5 h | 主要動線 -200 ms |
| QW-05 | BottomNav の motion を CSS に置換 | `src/components/layout/bottom-nav.tsx:140-153` | 0.5 h | ナビ遷移 INP -20〜40 ms |
| QW-06 | LoadingDots を `animate-pulse` に | `src/components/landing/demo-sequence.tsx:262` | 0.1 h | rAF 3 本常駐解消 |
| QW-07 | PostHog import を動的化 | `src/components/providers/posthog-provider.tsx:5` | 0.5 h | First Load JS -40 KB |
| QW-08 | Sentry `replaysOnErrorSampleRate: 0` | `sentry.client.config.ts:9` | 0.1 h | First Load JS -50 KB |
| QW-09 | Shippori weight を 1 に / preload false | `src/app/layout.tsx:37-44` | 0.25 h | 日本語 FOIT 緩和 |
| QW-10 | fill Image に `sizes` 追加 (3 箇所) | B-13 表参照 | 0.25 h | Supabase egress -10% |
| QW-11 | `toggleFavorite` の余剰 revalidatePath 削除 | `src/server/actions/favorites.ts:24-38` | 0.25 h | 全画面再生成抑止 |
| QW-12 | `SkyChip` / `NightQuestionCard` から `"use client"` 削除 | `src/components/home/sky-chip.tsx:1`, `src/components/coach/night-question-card.tsx:1` | 0.25 h | First Load JS -4〜5 KB |

**1 日工数合計想定**: 3.75 h (半日以内)。**累積効果**: Mobile 4G で LCP -150〜300 ms / INP -30〜60 ms / First Load JS -90〜100 KB gzip。

---

## 4. 構造的改善 (中長期、M〜L 工数)

### 4.1 Next.js 16 Cache Components (`use cache`) の全面展開

- `getVenueHeader` / `getVenueEstimates` / `getVenueVisits` / `getPartnerRatings` / `getVenueReviews` / `getVenuePlans` / `getMoneyReality` / `listCoachSessions` / `getMatrixData` / `getUnifiedComparisonData` / `listSavedSearches` に `"use cache"` + `cacheTag("venue:${id}" or "project:${id}")` 追加
- 対応する mutation SA で `revalidateTag` に置換
- タグ粒度: `project:${pid}` (global) / `venue:${vid}` / `estimates:${vid}` / `scores:${vid}` / `coach-sessions:${pid}` / `reviews:${vid}` / `checklist-answers:${vid}`

**期待**: `/venues/[id]` TTFB 500〜800 ms → 150 ms。LCP 2.8 → 2.0 s。

### 4.2 EditorialHero / Landing / DecisionMatrix の Server Component 化

- `"use client"` 境界を「motion / useState / useEffect が本当に要る 5〜20 行」に圧縮
- 親は Server Component に戻し、データ取得 / stageOf 計算 / metrics カード生成を SSR で完結
- landing-page 全域の whileInView を CSS `animation-timeline: view()` + IntersectionObserver fallback に

**期待**: framer-motion を home / landing ルートの First Load JS から排除 (−30〜50 KB gzip)、LCP テキスト表示を hydration 前に完了。

### 4.3 楽観的更新 (useOptimistic) 導入

- B-05 の TOP 10 アクション全てに `useOptimistic` + `useTransition` 適用
- 楽観反映 → Server Action → 失敗時は Sonner toast で rollback
- checklist yes/no (63 項目) は最もコスパが高い — プロトタイプはここから

**期待**: タップ→反応が視覚的に 0 ms。problems_01.md 共通 #1 の主訴に直接効く。

### 4.4 Segment Error Boundary の整備

- `src/components/errors/segment-error-card.tsx` に共通 UI 抽出
- home / explore / candidates / coach / compare / checklist / mypage の 7 segment に error.tsx を追加
- SA 失敗時も bottom-nav と WebSocket を維持

### 4.5 Supabase RLS + auth.getUser() の分散

- middleware で `getUser` を呼ばず、cookie 有効期限のみチェック
- Server Component の `requireUser` で 1 回だけ呼び、React.cache でメモ化
- expired JWT は Server Component が redirect

**期待**: 全 route の TTFB -100 ms。

### 4.6 BottomNav / decision-matrix / plan-editor-sheet の再分割

- `decision-matrix.tsx` (742 行) 内の `PriorityWeights` サブコンポーネントを別 dynamic import
- `plan-editor-sheet.tsx` (523 行) を sheet が実際に開かれた時のみ dynamic import

### 4.7 View Transitions (将来) — 現状は無効化が正解

`next.config.ts:32` で `viewTransition: false` 済み。Next 16 + Chrome 126+ で両 page DOM coexistence が mobile で body thrash を起こす既知の問題。将来 Chrome 側が修正 or `@view-transition` CSS-only API に移行可能になれば再検討。**このフェーズではさわらない**。

---

## 5. 回帰防止

### 5.1 Lighthouse CI on PR

```yaml
# .github/workflows/lighthouse.yml (sketch)
name: Lighthouse CI
on: pull_request
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 24 }
      - run: npm ci && npm run build
      - run: npx --yes @lhci/cli@0.15 autorun
```

`lighthouserc.json`:
```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/home",
        "http://localhost:3000/explore",
        "http://localhost:3000/coach",
        "http://localhost:3000/candidates",
        "http://localhost:3000/compare"
      ],
      "numberOfRuns": 3,
      "settings": { "preset": "mobile" }
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift":  ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time":      ["warn",  { "maxNumericValue": 200 }]
      }
    }
  }
}
```

### 5.2 Vercel Speed Insights の Web Vitals budget

- `@vercel/speed-insights` は既に搭載済 (`src/app/layout.tsx:5`)
- Vercel dashboard で route 別 P75 LCP / INP / CLS を週次監視
- Slack alert: LCP > 2.5 s / INP > 200 ms / CLS > 0.1 が 2 日連続で P75 超えたら通知

### 5.3 Bundle size budget

```js
// next.config.ts に size limit を追加
experimental: {
  optimizePackageImports: [/* 既存 */],
  // 将来: serverActions.bodySizeLimit など
},
```
- `npx next build` の route size を CI で diff 表示 (例: `size-limit` または GitHub Action `bundle-stats-action`)
- しきい値: home < 180 KB / explore < 200 KB / venues/[id] < 220 KB (First Load JS, gzip)

### 5.4 Playwright Trace for INP

既存 E2E (Mobile Chrome) に下記を追加:
```ts
// tests/e2e/perf.spec.ts (sketch)
test("INP budget on explore filter tap", async ({ page }) => {
  await page.goto("/explore");
  const start = performance.now();
  await page.click('[data-testid="filter-chip-area"]');
  await page.waitForSelector('[data-testid="venue-card"]', { state: "visible" });
  expect(performance.now() - start).toBeLessThan(200);
});
```

---

## 6. 計測手順書

### 6.1 Chrome DevTools Performance (Mobile 4G emulation)

```bash
# 1) 本番ビルド起動
npm run build && npm run start
# 別ターミナルで:
open -a "Google Chrome" --args --user-data-dir=/tmp/chrome-perf \
  --disable-extensions --incognito http://localhost:3000/home
```
DevTools 操作:
1. **DevTools → Performance タブ → ⚙ 歯車**
2. CPU: **4× slowdown** / Network: **Fast 4G** / Device: **Mobile**
3. 録画開始 → `/home → /explore → /venues/[id] → /compare → /coach` を順に遷移
4. 録画停止 → **Web Vitals lane** で LCP / INP / CLS を確認
5. 録画ファイルを `.json` エクスポートし PR に添付

### 6.2 Lighthouse (一発計測)

```bash
npx --yes lighthouse http://localhost:3000/home \
  --preset=mobile --throttling-method=devtools \
  --output=html --output-path=./lh-home.html
# 他 4 route も同様
for r in explore coach candidates compare; do
  npx lighthouse "http://localhost:3000/$r" --preset=mobile \
    --output=html --output-path="./lh-$r.html"
done
```

### 6.3 Playwright trace (ローカル INP 測定)

```bash
# 既存の playwright.config.ts に "Mobile Chrome" project あり
npx playwright test --project="Mobile Chrome" --trace=on tests/e2e/perf.spec.ts
npx playwright show-trace test-results/.../trace.zip
```
trace viewer の "Performance" タブで main thread blocking を確認。

### 6.4 Prisma クエリ計測

```ts
// src/server/db.ts に一時的に追加
const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "warn" },
    { emit: "stdout", level: "error" },
  ],
});
prisma.$on("query", (e) => {
  if (e.duration > 100) console.warn(`[SLOW] ${e.duration}ms | ${e.query}`);
});
```
ローカル `npm run dev` 下で `/venues/[id]` を叩き、遅いクエリを標準出力から拾う。

### 6.5 Vercel Agent / Speed Insights (本番)

- Vercel dashboard → Project → Speed Insights → Mobile フィルタ
- 主要 5 route を選択 → P75 LCP / INP / CLS の 7 日トレンド確認
- 悪化検知時は Vercel Agent (beta) に「Why did INP regress on /explore this week?」と質問し、自動インシデント解析

### 6.6 Bundle visualization

```bash
# next-bundle-analyzer 導入
npm i -D @next/bundle-analyzer
# next.config.ts で wrap (本 audit スコープ外の実装)
ANALYZE=true npm run build
# client.html / nodejs.html が出力される
```

---

## 付録 A. Sub-agent 別生報告 (Appendix)

### A.1 Sub-B1 クライアント境界 (performance-optimizer)
- 過剰 `"use client"` TOP5: sky-chip / night-question-card / editorial-hero / duel-client / chat-history
- PostHog top-level import / Sentry Replay が全 bundle
- next-intl 未使用のまま残留
- decision-matrix (742) の内部 dynamic 分割余地

### A.2 Sub-B2 データ取得 (database-reviewer)
- N+1: `batchAnalyzeVenueReviews` ループ await、`saveRatings` 内 14 dim シリアル upsert
- include 肥大化: `getVenue` / `getVenueVisits` / `insights` / `vibe-search`
- missing index 6 件 (B-10 参照)
- revalidatePath 乱用 (coach / venues / visits / decisions / favorites)
- useOptimistic TOP10

### A.3 Sub-B3 ナビゲーション (vercel:performance-optimizer)
- middleware auth が全リクエストで発火 + matcher 穴 (`.css/.woff2/monitoring/.../manifest`)
- `(app)/loading.tsx` が home/loading.tsx と重複
- prefetch={false} 誤用 6 箇所 (B-12)
- error.tsx 不在 segment 7 箇所
- venue detail 9 並列クエリ未 cache

### A.4 Sub-B4 アニメ / レンダリング (typescript-reviewer)
- framer-motion 213 箇所中 約 90 箇所が CSS 代替可能
- AnimatePresence single-child 不要: decision-matrix / candidates-view / rating-section / add-venue-sheet × 4
- next/image sizes 漏れ 6 件
- Shippori Mincho weight × 3 / preload true 問題
- `/coach` chat stream の INP / CLS ホットスポット
- React 19 compiler 有効化時の useMemo / useCallback 冗長化

---

## 実装着手順序 (推奨)

1. **Sprint 1 (半日)** — Quick Wins QW-01〜QW-12 一括
2. **Sprint 2 (1 週間)** — B-01 middleware / B-02 venue cache / B-05 useOptimistic TOP3 / B-11 error.tsx
3. **Sprint 3 (1 週間)** — B-03 framer 削減 / B-04 explore / B-06 coach / B-09 Prisma select
4. **Sprint 4 (1 週間)** — B-08 revalidateTag 細分化 / B-10 index / 回帰防止 CI 導入

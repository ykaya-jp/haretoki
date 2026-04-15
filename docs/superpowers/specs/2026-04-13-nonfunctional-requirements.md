# VenueLens v2 非機能要件書 + パフォーマンス技術設計

> ユーザー要求: 「サクサク動くことはマスト。もっさりしていると全然ダメ」
> ターゲット: 20-30代カップル、モバイルファースト (375px)
> 技術スタック: Next.js 16 (App Router) + Prisma + Supabase + Tailwind + shadcn/ui + framer-motion
> 参照: [DESIGN.md](../../../DESIGN.md) / [Release 1 技術仕様](./2026-04-13-release1-technical-spec.md) / [v2 画面仕様](./2026-04-13-venuelens-v2-redesign.md) / [UXガイドライン](../../ux-guidelines.md)
> 作成日: 2026-04-13

---

## 1. パフォーマンス予算（Release 1 から必達）

### Core Web Vitals（モバイル 3G 回線基準）

| 指標 | 目標 | Good 閾値 (Google) | 測定方法 |
|------|------|-------------------|---------|
| **LCP** (Largest Contentful Paint) | **< 2.5秒** | < 2.5秒 | Lighthouse CI + Vercel Speed Insights |
| **INP** (Interaction to Next Paint) | **< 200ms** | < 200ms | Chrome UX Report + Vercel Analytics |
| **CLS** (Cumulative Layout Shift) | **< 0.1** | < 0.1 | Lighthouse CI + `<Image>` の width/height 必須 |

### アプリ固有指標

| 指標 | 目標 | 実現方法 | 検証方法 |
|------|------|---------|---------|
| 初回ロード (TTI) | **< 3秒**（4G回線） | Streaming SSR + コード分割 + Image placeholder | Lighthouse CI (`interactive` metric) |
| ページ遷移 | **< 300ms**（体感） | `<Link prefetch>` + `loading.tsx` スケルトン + framer-motion 200ms transition | Playwright `page.goto()` の timing |
| タップフィードバック | **< 100ms** | CSS `active:` pseudo-class。JS 実行を待たない | Chrome DevTools Performance タブ |
| Server Action 応答 | **< 1秒**（p95） | Prisma `include` 一括取得 + DB インデックス | Server Action 実行時間ログ (後述) |
| AI 応答 (URL 抽出) | **< 10秒** | プログレスバー表示 + Streaming | 手動テスト + タイムアウト表示確認 |
| 写真カルーセルのスワイプ | **60fps 維持** | `transform` + `opacity` のみ。Embla Carousel 使用 | Chrome DevTools → Performance → Frames |
| JS 初期ロード (gzip) | **< 150KB** | `next/dynamic` 遅延読み込み + tree shaking | `@next/bundle-analyzer` |

### 予算超過時のエスカレーション

1. `@next/bundle-analyzer` で原因特定
2. PR レビューでブロック（CI ゲート）
3. 動的インポート化 or ライブラリ代替を検討
4. 2回連続超過は Slack アラート（将来の CI/CD 拡張時）

---

## 2. タッチ・インタラクション応答性

「サクサク感」の正体は **入力→視覚フィードバックの遅延が 100ms 以内** であること。

### 2.1 即時タップフィードバック（CSS レイヤー）

既に `globals.css` に設定済みの基盤:

```css
/* globals.css — 既に実装済み */
* { -webkit-tap-highlight-color: transparent; }
html { touch-action: manipulation; }
```

各コンポーネントに適用する CSS フィードバック:

| 要素 | CSS クラス | 効果 |
|------|-----------|------|
| カード | `active:scale-[0.98] transition-transform duration-150` | 押し込み感 |
| ボタン | `active:scale-95 transition-transform duration-150` | 押し込み感 |
| ナビリンク | `active:bg-muted transition-colors duration-150` | 背景色変化 |
| 星評価 | `active:scale-90 transition-transform duration-120` | 縮小 |
| ハートアイコン | `active:scale-110` + framer-motion で 1→1.2→1.0 (200ms) | 拡大アニメーション |

**原則**: CSS `active:` は JS ハンドラの実行完了を待たずに発火する。ユーザーの指が触れた瞬間にフィードバックが見えることが最重要。

### 2.2 300ms タップ遅延の排除

- `touch-action: manipulation` を `html` 要素に適用（実装済み）
- これにより、ダブルタップによるズームが無効化され、ブラウザの 300ms 待機が不要になる
- **検証**: Chrome DevTools → Performance → Event Timing で `pointerdown` → `click` の間隔が 100ms 以内であること

### 2.3 楽観的更新（Optimistic Updates）

サーバー応答を待たずに UI を即時更新し、失敗時にロールバックする。

**対象インタラクション**:

| 操作 | 更新方式 | ロールバック |
|------|---------|------------|
| ハートタップ (お気に入り) | 即時トグル | Server Action 失敗時に元に戻す + エラートースト |
| 星評価 | debounce 500ms 後にサーバー送信。UI は即時反映 | 失敗時にトースト「保存に失敗しました」+ 「取り消し」ボタン |
| パートナーリアクション (👍/🤔/👎) | 即時反映 | 失敗時にロールバック |

**ハートタップの楽観的更新 — 実装パターン**:

```typescript
// src/components/venues/heart-button.tsx
"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/server/actions/favorites";
import { Heart } from "lucide-react";
import { toast } from "sonner";

interface HeartButtonProps {
  venueId: string;
  initialFavorite: boolean;
}

export function HeartButton({ venueId, initialFavorite }: HeartButtonProps) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(initialFavorite);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      // Optimistically update UI immediately
      setOptimisticFavorite(!optimisticFavorite);

      try {
        await toggleFavorite(venueId);
      } catch {
        // Rollback on failure — useOptimistic automatically reverts
        toast.error("保存に失敗しました", {
          action: { label: "リトライ", onClick: handleToggle },
        });
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={optimisticFavorite ? "候補から外す" : "候補に追加"}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 
                 active:scale-110 transition-transform duration-150"
    >
      <Heart
        className={`h-5 w-5 transition-colors duration-200 ${
          optimisticFavorite ? "fill-[#FF385C] text-[#FF385C]" : "text-white"
        }`}
      />
    </button>
  );
}
```

**星評価の楽観的更新 + デバウンス — 実装パターン**:

```typescript
// src/components/ratings/star-rating-input.tsx — debounce部分の概略
"use client";

import { useOptimistic, useTransition, useRef, useCallback } from "react";
import { saveRatings } from "@/server/actions/ratings";
import { toast } from "sonner";

// Debounce: 500ms 以内に連続タップした場合、最後の値だけサーバーに送信
function useDebouncedSave(delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  
  return useCallback((saveFn: () => Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveFn(), delay);
  }, [delay]);
}

// 星タップ: UI は即時更新、サーバー送信は 500ms debounce
// handleStarTap → setOptimisticRating(newValue) → debouncedSave(saveToServer)
```

### 2.4 デバウンス/即時の使い分け

| 操作 | 方式 | 理由 |
|------|------|------|
| ハートタップ | **即時** (0ms) | 1回のトグル。連打防止は `isPending` で制御 |
| 星評価 | **debounce 500ms** | 連続タップで複数回変更する可能性が高い |
| フィルタチップ | **debounce 300ms** | 複数フィルタを連続選択するケース |
| チャット送信 | **即時** (0ms) | Enter で送信。UI は即時反映 |
| 検索入力 | **debounce 300ms** | キーストロークごとの再描画を防止 |

---

## 3. ページ遷移・ナビゲーション性能

### 3.1 プリフェッチ

```typescript
// src/components/layout/bottom-nav.tsx
import Link from "next/link";

// Next.js <Link> はデフォルトで prefetch={true} (production)
// ボトムナビの4タブは全て prefetch される
const tabs = [
  { href: "/", icon: Home, label: "ホーム" },
  { href: "/explore", icon: Search, label: "探す" },
  { href: "/candidates", icon: Heart, label: "候補" },
  { href: "/coach", icon: MessageSquare, label: "コーチ" },
];
```

- ボトムナビの4タブは `<Link prefetch>` で RSC ペイロードを先読み
- 式場カードの `<Link>` も prefetch 有効（デフォルト）
- **検証**: Chrome DevTools → Network タブで、タブ表示後にプリフェッチリクエストが飛んでいることを確認

### 3.2 Streaming SSR + Suspense

各ページの Server Component で `<Suspense>` を活用し、上部コンテンツを先に表示:

```typescript
// src/app/(app)/page.tsx (Home)
import { Suspense } from "react";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/home/ai-insight-card";
import { RecentVenuesSkeleton } from "@/components/home/recent-venues-skeleton";
import { RecentVenues } from "@/components/home/recent-venues";

export default async function HomePage() {
  const { userName, progress } = await getBasicHomeData(); // lightweight query

  return (
    <>
      {/* Greeting renders immediately — no data dependency */}
      <Greeting userName={userName} />

      {/* AI Insight + Recent Venues stream in as data resolves */}
      <Suspense fallback={<AIInsightSkeleton />}>
        <AIInsightCard />
      </Suspense>

      <Suspense fallback={<RecentVenuesSkeleton />}>
        <RecentVenues />
      </Suspense>
    </>
  );
}
```

**原則**: 各 `<Suspense>` 境界は画面の上→下の順に解決する。ユーザーは上部コンテンツを先に見ながら下部のデータロードを待てる。

### 3.3 スケルトン UI（CLSゼロ）

各ページの `loading.tsx` でレイアウトシフトゼロのスケルトンを配置:

| ページ | loading.tsx スケルトン構造 | CLS 対策 |
|--------|------------------------|---------|
| Home | BentoGrid 枠 (2/3+1/3) + 横スクロールカード枠 x3 | 固定高さの `aspect-ratio` |
| Explore | FilterChips 枠 (横線 x4) + VenueCard 枠 x3 (4:3 写真 + 3行テキスト) | `aspect-[4/3]` で写真領域確保 |
| Candidates | セグメントコントロール + カード枠 x2 | セグメント高さ固定 |
| Coach | InsightCard 枠 x3 (3px 左ボーダー + 3行テキスト) | カード高さ `min-h-[120px]` |
| Onboarding | プログレスバー + チャットバブル枠 x2 | バブル高さ固定 |
| VenueDetail | 写真枠 (4:3) + テキスト 3行 + 星 6行 | `aspect-[4/3]` + 行高さ固定 |

スケルトン共通スタイル: `bg-muted animate-pulse rounded-lg`

**検証**: Lighthouse CI の CLS スコアが 0.1 未満であること

### 3.4 ルート遷移アニメーション

```typescript
// src/app/(app)/layout.tsx 内で AnimatePresence を使用
// タブ切替時に framer-motion でスムーズなフェード + スライド (200ms)
import { AnimatePresence, motion } from "framer-motion";

// 各ページを motion.div でラップ
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  {children}
</motion.div>
```

- 遷移時間: **200ms 以内**
- プロパティ: `opacity` + `transform(translateY)` のみ（GPU アクセラレーション対象）
- `will-change: transform` は遷移中のみ付与（常時付与は避ける）

### 3.5 スクロール位置保持

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    scrollRestoration: true, // タブ間遷移時にスクロール位置を記憶
  },
  // ... other config
};
```

- ボトムナビでタブ切替 → 戻った時にスクロール位置が復元される
- **検証**: Explore で下にスクロール → Coach タブ → Explore に戻る → 同じ位置に戻ること

---

## 4. ネットワーク耐性

遅い回線 (3G) や不安定な接続でも使えるための設計。

### 4.1 エラーリトライ（指数バックオフ）

```typescript
// src/lib/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}
```

- Server Action 失敗時に自動リトライ（最大 3回、1s → 2s → 4s）
- ユーザーに見える形: スピナー表示 → リトライ中 → 成功 or エラートースト + リトライボタン

### 4.2 タイムアウト表示

| 経過時間 | 表示 |
|---------|------|
| 0-3秒 | ボタンスピナー or スケルトン |
| 3秒 | スピナー + 「読み込み中...」テキスト |
| 10秒 | タイムアウトメッセージ + **[リトライ]** ボタン |
| AI 処理 (URL 抽出) | 0秒からプログレスバー表示。10秒でタイムアウトメッセージ |

**実装**: `AbortController` + `setTimeout(10000)` でタイムアウトを制御

### 4.3 オフライン検知

```typescript
// src/hooks/use-online-status.ts
"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,     // client
    () => true                  // server (SSR)
  );
}
```

- オフライン時: 画面上部に持続バナー「インターネット接続がありません」（自動 dismiss しない）
- オンライン復帰時: バナー消去 + 必要に応じて revalidate
- `aria-live="assertive"` でスクリーンリーダーにも通知

### 4.4 画像の遅延読み込み

- ファーストビュー外の写真: `loading="lazy"` (Next.js `<Image>` のデフォルト)
- ファーストビュー内の写真: `priority={true}` で即座にロード（LCP 候補）
- カルーセル: 表示中の写真 + 次の 1枚のみプリロード（IntersectionObserver で制御）

### 4.5 低品質画像プレースホルダー (LQIP)

> **Release 1**: `placeholder="empty"` で対応（blurDataURL は生成しない）。手動入力の式場写真は URL を直接保存するため、blur 画像の事前生成パイプラインがない。CLS 防止は `width`/`height` 明示 + `aspect-[4/3]` で対応。
>
> **Release 2以降**: URL 自動抽出（`addVenueFromUrl`）実装時に、Supabase Storage アップロードと同時に 10x7px base64 blur 画像を生成し `blurDataUrl` カラムに保存。`placeholder="blur"` に切り替え。

```typescript
// Release 1: placeholder="empty"
<Image
  src={venue.photoUrls[0]}
  alt={venue.name}
  width={750}
  height={563}  // 4:3 ratio
  placeholder="empty"
  className="aspect-[4/3] object-cover"
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>

// Release 2+: placeholder="blur" with blurDataURL
<Image
  src={venue.photoUrls[0]}
  alt={venue.name}
  width={750}
  height={563}  // 4:3 ratio
  placeholder="blur"
  blurDataURL={venue.blurDataUrl} // base64, 10x7px — アップロード時に生成
  className="aspect-[4/3] object-cover"
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

- `blurDataURL`: 10x7px の base64 画像を Supabase Storage アップロード時に生成（Release 2+）
- 式場写真の読み込み中にぼかし画像が表示され、CLS を防止
- **検証**: Slow 3G プリセットで式場カードを表示し、ぼかし→鮮明の遷移を確認

---

## 5. レンダリング性能

### 5.1 React Server Components（デフォルト）

**原則**: データフェッチを含むコンポーネントは全て Server Component。`"use client"` は最小限。

| レイヤー | Server / Client | 理由 |
|---------|----------------|------|
| ページ (`page.tsx`) | **Server** | データフェッチ + 初期レンダリング |
| レイアウト (`layout.tsx`) | **Server** | 認証チェック + リダイレクト |
| `loading.tsx` | **Server** | スケルトン（静的 HTML） |
| BottomNav | **Client** | `usePathname()` でアクティブタブ判定 |
| HeartButton | **Client** | `useOptimistic` + `useTransition` |
| StarRatingInput | **Client** | ユーザー入力 + debounce |
| FilterChips | **Client** | クライアントサイドフィルタ |
| ChatBar | **Client** | テキスト入力 + 送信 |
| ProgressRing | **Client** | SVG アニメーション |
| PhotoCarousel | **Client** | Embla Carousel (スワイプ操作) |
| ComparisonBoard | **Client** | インタラクティブな比較 UI |
| DecisionCeremony | **Client** | canvas-confetti + アニメーション |

### 5.2 Client Component の分離

`"use client"` コンポーネントはインタラクティブな「葉」のコンポーネントに限定:

```
// GOOD: Server Component がデータを取得し、Client に props で渡す
// page.tsx (Server)
export default async function ExplorePage() {
  const venues = await getVenues();
  const favorites = await getUserFavorites();
  
  return (
    <>
      <FilterChips />              {/* Client: フィルタ操作 */}
      {venues.map((v) => (
        <VenueCard key={v.id} venue={v}>
          <HeartButton              {/* Client: 楽観的更新 */}
            venueId={v.id}
            initialFavorite={favorites.includes(v.id)}
          />
        </VenueCard>
      ))}
    </>
  );
}
```

```
// BAD: ページ全体を "use client" にしない
"use client";
export default function ExplorePage() { // Server Component であるべき
  const [venues, setVenues] = useState([]);
  useEffect(() => { fetchVenues()... }, []);
}
```

### 5.3 バーチャルスクロール

- **Release 1**: 式場リストは 10件ページネーション（`take: 10` + 「もっと見る」ボタン）
- **Release 2 以降**: 20件以上で `@tanstack/react-virtual` によるバーチャルスクロールを導入検討
- 判断基準: 実際のユーザーデータで平均式場数が 15件を超えた場合

### 5.4 メモ化

重いコンポーネントには `React.memo` + `useMemo` を適用:

| コンポーネント | メモ化対象 | 理由 |
|--------------|----------|------|
| ComparisonBoard | `React.memo` + `useMemo` (スコア計算) | recharts の再描画が重い |
| DimensionBar (レーダーチャート相当) | `useMemo` (スコア正規化) | 複数式場のスコア計算 |
| VenueCard | `React.memo` | リスト内で頻繁に再描画されうる |
| ProgressRing | `useMemo` (SVG パス計算) | 不要な再計算を防止 |

### 5.5 framer-motion ルール

| 許可 | 禁止 |
|------|------|
| `transform` (translate, scale, rotate) | `width` / `height` のアニメーション |
| `opacity` | `top` / `left` / `right` / `bottom` |
| `will-change: transform` (遷移中のみ) | `margin` / `padding` のアニメーション |

**理由**: `transform` と `opacity` は GPU コンポジターで処理されレイアウト再計算が不要。それ以外はメインスレッドでレイアウト再計算が走り、60fps を維持できない。

```typescript
// GOOD
<motion.div animate={{ x: 100, opacity: 1 }} />

// BAD — layout thrashing
<motion.div animate={{ width: "100%", top: 50 }} />
```

---

## 6. バンドルサイズ管理

### 6.1 動的インポート

```typescript
// recharts — Candidates ページでのみ使用
const ComparisonBoard = dynamic(
  () => import("@/components/candidates/comparison-board"),
  { loading: () => <ComparisonBoardSkeleton /> }
);

// canvas-confetti — Decision Ceremony でのみ使用
const DecisionCeremony = dynamic(
  () => import("@/components/decision/decision-ceremony"),
  { ssr: false }  // canvas API はサーバーで不要
);

// framer-motion の AnimatePresence — ページ遷移でのみ使用
// NOTE: framer-motion 自体は tree-shakeable なので個別インポートで対応
import { motion } from "framer-motion"; // OK — tree shaking で必要分のみ
```

### 6.2 Tree shaking

```typescript
// lucide-react — 個別インポート（tree shaking 対応済み）
import { Heart } from "lucide-react";      // OK — named export で tree shake
import { Search } from "lucide-react";     // OK
// import * as Icons from "lucide-react";  // BAD — 全アイコンがバンドルされる
```

lucide-react v1.8+ は ES モジュールで tree shaking に対応済み。`import { Heart } from 'lucide-react'` で個別アイコンのみバンドルされる（確認済み）。

### 6.3 分析ツール

```bash
# devDependencies に追加（Release 1 バックポート）
npm install -D @next/bundle-analyzer
```

```typescript
// next.config.ts
import type { NextConfig } from "next";

const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  // ... existing config
};

export default withBundleAnalyzer(nextConfig);
```

```bash
# バンドル分析の実行
ANALYZE=true npm run build
```

- CI (GitHub Actions) で PR ごとにバンドルサイズ差分を表示
- 閾値超過で警告コメントを PR に自動投稿

### 6.4 各ルートのバンドル予算

| ルート | JS 上限 (gzip) | 主要ライブラリ | 備考 |
|--------|---------------|---------------|------|
| Home (`/`) | **80KB** | framer-motion (部分) | ProgressRing アニメーション |
| Explore (`/explore`) | **60KB** | embla-carousel-react (~13KB) | カルーセル |
| Candidates (`/candidates`) | **100KB** | recharts (~45KB gzip) | ComparisonBoard のスコアバー |
| Coach (`/coach`) | **50KB** | — | テキスト中心 |
| VenueDetail (`/venues/[id]`) | **80KB** | embla-carousel + framer-motion (部分) | PhotoGallery |
| Onboarding (`/onboarding`) | **40KB** | framer-motion (部分) | チャットバブルアニメーション |

**合計初期ロード (shared chunks)**: < 150KB gzip

---

## 7. 画像最適化（Release 1 から）

### 7.1 Next.js Image コンポーネント

全ての式場写真に `<Image>` コンポーネントを使用。`width` / `height` 必須（CLS 防止）。

```typescript
import Image from "next/image";

// 式場カード写真 (Release 1: placeholder="empty", Release 2+: placeholder="blur")
<Image
  src={photoUrl}
  alt={`${venue.name}の写真`}
  width={750}
  height={563}           // 4:3 aspect ratio
  sizes="(max-width: 768px) 100vw, 50vw"
  placeholder="empty"    // Release 1。Release 2+ で "blur" + blurDataURL に切替
  className="aspect-[4/3] object-cover"
/>
```

### 7.2 フォーマットとサイズ

- **フォーマット**: WebP 自動変換（Next.js Image のデフォルト動作）
- **srcset**: `375w` / `750w` / `1080w` を `sizes` 属性で生成
- **品質**: `quality={80}` (デフォルト 75 から微増、ウェディング写真の品質維持)

### 7.3 Supabase Storage 設定

```typescript
// next.config.ts — Release 1 バックポート
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // ... other config
};
```

### 7.4 プレースホルダー生成

```typescript
// src/lib/image-utils.ts
// Supabase Storage にアップロード時に blurDataURL を生成
// 方法: sharp ライブラリで 10x7px にリサイズ → base64 エンコード
// 生成した blurDataURL は Venue.blurDataUrl (新フィールド案) or photoUrls と同じ配列構造で管理
```

### 7.5 カルーセルの画像プリロード

```typescript
// Embla Carousel の onSelect イベントで次の1枚をプリロード
const onSelect = useCallback(() => {
  const currentIndex = emblaApi.selectedScrollSnap();
  const nextIndex = currentIndex + 1;
  if (nextIndex < photos.length) {
    const img = new window.Image();
    img.src = photos[nextIndex]; // ブラウザキャッシュにプリロード
  }
}, [emblaApi, photos]);
```

- 表示中の写真 + 次の 1枚のみプリロード
- 全写真の一括プリロードは禁止（帯域浪費）
- **検証**: Chrome DevTools → Network で、カルーセルスワイプ時に次の写真のみリクエストされていること

---

## 8. データベースクエリ性能

### 8.1 N+1 問題防止

```typescript
// GOOD: Prisma include で一括取得
const venues = await prisma.venue.findMany({
  where: { projectId },
  include: {
    scores: true,
    favorites: { where: { userId } },
    visits: { orderBy: { visitDate: "desc" }, take: 1 },
  },
  take: 10,
  orderBy: { createdAt: "desc" },
});

// BAD: N+1 クエリ
const venues = await prisma.venue.findMany({ where: { projectId } });
for (const v of venues) {
  v.scores = await prisma.venueScore.findMany({ where: { venueId: v.id } }); // N回
}
```

### 8.2 Release 1 で追加するインデックス

| テーブル | インデックス | 用途 |
|---------|------------|------|
| `venues` | `(project_id, status)` | Explore 画面のステータスフィルタ |
| `venue_favorites` | `(venue_id, user_id)` UNIQUE | お気に入りトグルの存在チェック |
| `venue_favorites` | `(user_id)` | ユーザー別お気に入り一覧 |
| `partner_reactions` | `(venue_id, visitor_token)` UNIQUE | リアクション upsert |
| `partner_reactions` | `(project_id)` | プロジェクト別リアクション一覧 |
| `venue_scores` | `(venue_id, dimension, source)` UNIQUE | スコア重複防止（既存） |

### 8.3 ページネーション

```typescript
// Cursor-based pagination for venue list
const venues = await prisma.venue.findMany({
  where: { projectId },
  take: 10,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: "desc" },
});
```

- Release 1: `take: 10` + 「もっと見る」ボタン（cursor ベース）
- Offset ベースは使わない（大量データでパフォーマンス劣化）

### 8.4 クエリキャッシュ

```typescript
import { cache } from "react";

// React.cache でリクエスト内キャッシュ（同一リクエスト内で複数回呼ばれても1回だけ実行）
export const getVenueById = cache(async (venueId: string) => {
  return prisma.venue.findUnique({
    where: { id: venueId },
    include: { scores: true, visits: true, estimates: true },
  });
});
```

- `React.cache`: 同一リクエスト内の重複クエリを排除
- `unstable_cache` / Next.js 16 の `"use cache"`: 将来的にクロスリクエストキャッシュを検討（Release 2 以降）
- **注意**: Prisma クエリの結果に個人データが含まれるため、クロスリクエストキャッシュは慎重に導入

---

## 9. アクセシビリティ性能

### 9.1 フォーカス管理

```typescript
// ページ遷移後にメインコンテンツにフォーカス移動
// src/app/(app)/layout.tsx
<main id="main-content" tabIndex={-1} className="...">
  {children}
</main>

// ページ遷移時 (framer-motion の onAnimationComplete)
<motion.div
  onAnimationComplete={() => {
    document.getElementById("main-content")?.focus();
  }}
>
```

### 9.2 aria-live

```typescript
// Sonner トースト — aria-live は Sonner が自動設定
// ux-guidelines.md に記載: role="status" + aria-live="polite"
<Toaster
  position="bottom-center"
  toastOptions={{
    role: "status",
    // Sonner v2 は aria-live="polite" をデフォルトで設定
  }}
/>
```

- トースト通知: `aria-live="polite"` — 現在のスクリーンリーダー読み上げを中断しない
- オフラインバナー: `aria-live="assertive"` — 即座に通知
- 楽観的更新のロールバック: `aria-live="polite"` でエラーを通知

### 9.3 prefers-reduced-motion

DESIGN.md に定義済みのルール: 「`prefers-reduced-motion`: all animations disabled」

```typescript
// framer-motion の useReducedMotion hook
import { useReducedMotion } from "framer-motion";

export function VenueCard({ ... }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
    >
      ...
    </motion.div>
  );
}
```

```css
/* globals.css — CSS レイヤーのモーション無効化 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**テストで検証する具体的方法**:

1. Chrome DevTools → Rendering → Emulate CSS media → `prefers-reduced-motion: reduce`
2. 全画面を操作し、アニメーションが無効化されていることを目視確認
3. Playwright テストで `page.emulateMedia({ reducedMotion: 'reduce' })` を設定し、モーション関連の CSS プロパティが `0.01ms` であることをアサート
4. Decision Ceremony: コンフェッティが表示されず、テキストのみ表示されることを確認

### 9.4 Dynamic Type

- 最小フォントサイズ: **16px** (`--text-fluid-base: clamp(1rem, ...)`)
- ユーザーがブラウザのフォントサイズを拡大しても崩れないレイアウト:
  - 固定高さ (`h-[XXpx]`) を避け、`min-h-[XXpx]` を使用
  - テキストの `overflow: hidden; text-overflow: ellipsis` で溢れ対策
  - フレックスレイアウトで自動伸縮
- **検証**: Chrome DevTools → Settings → Appearance → Font size を「Very Large」に設定し、全画面でレイアウト崩れがないことを確認

---

## 10. 監視・計測

Release 1 から仕込む計測基盤。

### 10.1 Vercel Analytics + Speed Insights

```bash
# 依存追加
npm install @vercel/analytics @vercel/speed-insights
```

```typescript
// src/app/layout.tsx (root layout)
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />        {/* Core Web Vitals リアルユーザーモニタリング */}
        <SpeedInsights />    {/* ページ別パフォーマンスデータ */}
      </body>
    </html>
  );
}
```

- **Vercel Analytics**: LCP, INP, CLS のリアルユーザーデータを収集
- **Vercel Speed Insights**: ページ別のパフォーマンススコア + 改善提案

### 10.2 Server Action 実行時間ログ

```typescript
// src/server/middleware/timing.ts
export function withTiming<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    console.log(`[ServerAction] ${name}: ${duration.toFixed(0)}ms`);
    // NOTE: 将来的に Vercel Observability / OpenTelemetry に送信
    if (duration > 1000) {
      console.warn(`[ServerAction] SLOW: ${name} took ${duration.toFixed(0)}ms (>1s)`);
    }
  });
}

// 使用例
export async function getHomeData(): Promise<HomeData> {
  return withTiming("getHomeData", async () => {
    // ... implementation
  });
}
```

- 全 Server Action に `withTiming` ラッパーを適用（Release 1 バックポート）
- 1秒超の Server Action は `console.warn` で警告
- Vercel Functions のログで確認可能

### 10.3 エラーレポート

| レイヤー | ハンドリング | UI |
|---------|------------|-----|
| Server Action 失敗 | try/catch + Sonner トースト | リトライボタン付きトースト |
| ページレベルエラー | `error.tsx` Error Boundary | 「エラーが発生しました」+ リトライ + ホームに戻る |
| 未ハンドルエラー | `global-error.tsx` | フルページエラー画面 |
| クライアントエラー | `window.addEventListener("error")` (将来) | 現時点は Error Boundary でキャッチ |

---

## 11. テスト・検証計画

### 11.0 CI/CD パイプライン基本設計

```yaml
# .github/workflows/ci.yml (Release 1 で追加)
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm test -- --coverage
      - name: Check coverage threshold
        run: |
          # Vitest coverage threshold is configured in vitest.config.ts
          echo "Coverage report generated"

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build

  lighthouse:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci && npm run build
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:3000/
            http://localhost:3000/explore
            http://localhost:3000/candidates
            http://localhost:3000/coach
          budgetPath: ./lighthouse-budget.json
```

**パイプライン順序**: lint → test → build → lighthouse（PR のみ）

**Vercel デプロイ時の Prisma マイグレーション**:

Vercel の Build Command に以下を設定:

```
npx prisma migrate deploy && next build
```

- `prisma migrate deploy` は既存のマイグレーションファイルを本番 DB に適用（`migrate dev` と異なり対話なし）
- Vercel の Preview / Production 両方で自動実行される
- マイグレーションファイルは `prisma/migrations/` にコミット済みであること

### 11.1 Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml (Release 1 で追加)
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:3000/
            http://localhost:3000/explore
            http://localhost:3000/candidates
            http://localhost:3000/coach
          budgetPath: ./lighthouse-budget.json
```

```json
// lighthouse-budget.json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "interactive", "budget": 3000 },
      { "metric": "largest-contentful-paint", "budget": 2500 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 150 }
    ]
  }
]
```

- PR ごとに自動計測。**パフォーマンススコア 90 以上** を必達
- 予算超過時は PR にコメントで警告

### 11.2 Bundle 分析

```yaml
# .github/workflows/bundle.yml
name: Bundle Analysis
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: ANALYZE=true npm run build
      # バンドルサイズ差分をPRコメントに表示
```

### 11.3 E2E パフォーマンス (Playwright)

```typescript
// tests/e2e/performance.spec.ts
import { test, expect } from "@playwright/test";

test("Home page LCP < 2.5s on mobile", async ({ page }) => {
  // Emulate mobile
  await page.setViewportSize({ width: 375, height: 812 });

  const startTime = Date.now();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const loadTime = Date.now() - startTime;

  // NOTE: Playwright metrics for more accurate measurement
  const metrics = await page.evaluate(() =>
    JSON.stringify(performance.getEntriesByType("paint"))
  );
  const paintEntries = JSON.parse(metrics);
  
  expect(loadTime).toBeLessThan(5000); // generous for CI
  
  // Check CLS via Layout Shift entries
  const clsEntries = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries.reduce((sum: number, e: any) => sum + e.value, 0));
      }).observe({ type: "layout-shift", buffered: true });
      setTimeout(() => resolve(0), 3000);
    });
  });
  
  expect(clsEntries).toBeLessThan(0.1);
});

test("Carousel maintains 60fps", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/explore");
  
  // Swipe gesture on carousel
  const card = page.locator("[data-testid='venue-card-carousel']").first();
  await card.hover();
  
  // Start tracing for frame analysis
  await page.tracing.start({ screenshots: false });
  await card.evaluate((el) => {
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [new Touch({ identifier: 0, target: el, clientX: 300, clientY: 200 })] }));
    el.dispatchEvent(new TouchEvent("touchmove", { touches: [new Touch({ identifier: 0, target: el, clientX: 100, clientY: 200 })] }));
    el.dispatchEvent(new TouchEvent("touchend", {}));
  });
  const trace = await page.tracing.stop();
  // Trace analysis for frame drops would be done in CI post-processing
});
```

### 11.4 手動テスト チェックリスト

| チェック項目 | ツール | 合格基準 |
|------------|--------|---------|
| 60fps カルーセルスワイプ | Chrome DevTools → Performance → Frames | ドロップフレーム 0 |
| 60fps ページ遷移 | Chrome DevTools → Performance → Frames | ドロップフレーム 0 |
| Slow 3G で全画面操作 | Chrome DevTools → Network → Slow 3G | 10秒以内に操作可能 |
| タップフィードバック < 100ms | Chrome DevTools → Performance → Event Timing | input delay < 100ms |
| `prefers-reduced-motion` | DevTools → Rendering → Emulate | アニメーション全停止 |
| フォントサイズ拡大 | DevTools → Settings → Font size: Very Large | レイアウト崩れなし |

### 11.5 継続的計測

| 頻度 | 計測 | ツール |
|------|------|--------|
| PR ごと | Lighthouse スコア, バンドルサイズ | GitHub Actions |
| デプロイごと | Core Web Vitals | Vercel Analytics |
| 週次 | ページ別パフォーマンス推移 | Vercel Speed Insights |
| 月次 | Chrome UX Report (CrUX) | PageSpeed Insights |

---

## 12. Release 1 バックポート要件（R2-4 を見据えて）

Release 1 の実装開始時に、パフォーマンス基盤として以下を必ず含める:

### 12.1 devDependencies 追加

```bash
npm install -D @next/bundle-analyzer
npm install @vercel/analytics @vercel/speed-insights
```

### 12.2 next.config.ts 更新

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    scrollRestoration: true,
  },
  async redirects() {
    return [
      // ... existing redirects from Release 1 tech spec
    ];
  },
};

export default nextConfig;
```

### 12.3 globals.css 確認（実装済み）

以下は既に `globals.css` に実装済みであることを確認:

```css
/* 既に実装済み */
* { -webkit-tap-highlight-color: transparent; }
html { touch-action: manipulation; }
```

追加が必要:

```css
/* prefers-reduced-motion 対応 — 追加 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 12.4 Server Action タイミングログ

全 Server Action に `withTiming` ラッパーを適用:

```typescript
// src/server/middleware/timing.ts — 新規作成
// 全 Server Action の実行時間を計測し、1秒超で警告
```

対象 Server Action (Release 1):
- `getHomeData()`
- `getVenues()` / `createVenue()`
- `toggleFavorite()`
- `getFavorites()` / `getComparisonData()`
- `saveRatings()` / `getPartnerRatings()`
- `sendCoachMessage()`
- `saveOnboardingAnswers()`
- `submitPartnerReaction()`

### 12.5 Root Layout への計測コンポーネント追加

```typescript
// src/app/layout.tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// <body> の末尾に追加
<Analytics />
<SpeedInsights />
```

### 12.6 バックポートチェックリスト

- [ ] `@next/bundle-analyzer` を devDependencies に追加
- [ ] `@vercel/analytics` + `@vercel/speed-insights` を dependencies に追加
- [ ] `next.config.ts` に `images.remotePatterns` (Supabase Storage) を設定
- [ ] `next.config.ts` に `experimental.scrollRestoration` を設定
- [ ] `globals.css` に `prefers-reduced-motion` メディアクエリを追加
- [ ] `globals.css` の `touch-action: manipulation` と `-webkit-tap-highlight-color: transparent` が存在することを確認
- [ ] `src/server/middleware/timing.ts` を作成し、全 Server Action に適用
- [ ] `src/app/layout.tsx` に `<Analytics />` + `<SpeedInsights />` を追加
- [ ] `src/hooks/use-online-status.ts` を作成
- [ ] `src/lib/retry.ts` を作成
- [ ] `lighthouse-budget.json` を作成
- [ ] `global-error.tsx` が存在することを確認（Lessons に記載済み）

---

## 13. 環境変数管理

全リリースで必要な環境変数の一覧。`.env.example` に変数名のみ記載し、実際の値は `.env.local` (ローカル) / Vercel Environment Variables (本番) で管理する。

| 変数名 | 用途 | 必須Release | `.env.example` 記載内容 |
|--------|------|------------|------------------------|
| `DATABASE_URL` | PostgreSQL 接続文字列 (Prisma) | R1 | `DATABASE_URL=` |
| `DIRECT_URL` | PostgreSQL 直接接続 (マイグレーション用) | R1 | `DIRECT_URL=` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | R1 | `NEXT_PUBLIC_SUPABASE_URL=` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー (クライアント用) | R1 | `NEXT_PUBLIC_SUPABASE_ANON_KEY=` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー (サーバー用) | R1 | `SUPABASE_SERVICE_ROLE_KEY=` |
| `NEXT_PUBLIC_APP_URL` | アプリケーション URL (パートナー招待リンク等) | R1 | `NEXT_PUBLIC_APP_URL=http://localhost:3000` |
| `ANTHROPIC_API_KEY` | Claude API キー (AI機能) | R2 | `# AI (Release 2)`<br>`ANTHROPIC_API_KEY=` |
| `GOOGLE_PLACES_API_KEY` | Google Places API (口コミ取得) | R3 | `# Reviews (Release 3)`<br>`GOOGLE_PLACES_API_KEY=` |

**IMPORTANT**: 秘密情報（`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` 等）は絶対にコミットしない。`NEXT_PUBLIC_` プレフィックス付きの変数のみクライアントバンドルに含まれる。

**Vercel 環境変数設定**:
- Production / Preview / Development の3環境で個別に設定
- `DATABASE_URL` は Supabase Integration で自動設定される（Vercel Marketplace 経由）
- `ANTHROPIC_API_KEY` は R2 デプロイ時に手動追加

---

## 付録: パフォーマンス予算サマリ

```
┌─────────────────────────────────────────────────────┐
│                  VenueLens v2 Performance Budget     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Core Web Vitals (3G mobile)                        │
│  ├── LCP  < 2.5s  ████████████████████░░░░░         │
│  ├── INP  < 200ms ████████████████████░░░░░         │
│  └── CLS  < 0.1   ████████████████████░░░░░         │
│                                                     │
│  App Metrics                                        │
│  ├── TTI         < 3s   (4G)                        │
│  ├── Page Nav    < 300ms (perceived)                │
│  ├── Tap FB      < 100ms (CSS active:)              │
│  ├── Server Act  < 1s   (p95)                       │
│  ├── AI Response < 10s  (with progress)             │
│  ├── Carousel    = 60fps (transform only)           │
│  └── JS Bundle   < 150KB (gzip, initial)            │
│                                                     │
│  Route Budgets (JS gzip)                            │
│  ├── Home        80KB                               │
│  ├── Explore     60KB                               │
│  ├── Candidates  100KB (recharts)                   │
│  ├── Coach       50KB                               │
│  ├── VenueDetail 80KB                               │
│  └── Onboarding  40KB                               │
│                                                     │
│  Lighthouse Score: ≥ 90 (required for merge)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

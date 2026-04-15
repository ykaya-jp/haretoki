# VenueLens v2 Release 4 — Technical Specification (Polish & Scale)

> Release 1-3 で全機能が揃った状態からの仕上げと商用化準備。
> 参照: [roadmap.md](../../roadmap.md) / [DESIGN.md](../../../DESIGN.md) / [Release 1 技術設計書](./2026-04-13-release1-technical-spec.md)
> 作成日: 2026-04-13

---

## 目次

- [a) ダークモード設計](#a-ダークモード設計)
- [b) PWA + オフライン設計](#b-pwa--オフライン設計)
- [c) スワイプ比較設計](#c-スワイプ比較設計)
- [d) 通知システム設計](#d-通知システム設計)
- [e) AIコスト最適化](#e-aiコスト最適化)
- [f) OGP画像生成](#f-ogp画像生成)
- [g) Google OAuth追加](#g-google-oauth追加)
- [h) パフォーマンス最適化](#h-パフォーマンス最適化)
- [i) テスト計画](#i-テスト計画)
- [j) Release 1-3 への先行要件（バックポート）](#j-release-1-3-への先行要件バックポート)

---

## a) ダークモード設計

### 概要

DESIGN.md Phase 5 に定義済みのダークモードCSS変数を実装する。`globals.css` には既にライトモード（`:root`）とダークモード（`.dark`）の oklch カラー変数が定義済みのため、テーマ切替の仕組みとコンポーネント対応が主な作業となる。

### テーマ切替ライブラリ: `next-themes`

**選定理由**: `next-themes` を採用する。

| 候補 | メリット | デメリット | 判定 |
|------|---------|-----------|------|
| `next-themes` | Next.js App Router対応済み、FOUC防止（script injection）、system preference対応、SSR互換 | 外部依存1つ追加 | **採用** |
| カスタム実装 | 依存なし | FOUC防止のscript injection自前実装が必要、edge caseが多い | 不採用 |

```bash
npm install next-themes
```

### 実装構成

#### 1. ThemeProvider 設置

```typescript
// src/app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**`attribute="class"`**: `globals.css` の `.dark` セレクタと連動。`next-themes` が `<html>` に `class="dark"` を付与する。

**`disableTransitionOnChange`**: テーマ切替時にtransitionによるちらつきを防止。

#### 2. テーマ切替UIコンポーネント

```typescript
// src/components/settings/theme-switcher.tsx
"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

// 3モード切替: ライト / ダーク / システム
// 設定画面またはプロフィールメニュー内に配置
// SegmentedControl（Release 1 で candidates に実装済み）を再利用
```

配置場所: ホームタブの右上プロフィールアイコン → 設定シート内。

#### 3. oklch カラースペースでのダークモード変数

`globals.css` に既に定義済みの `.dark` ブロックがダークモード変数を提供する。現行定義:

| Token | Light (`:root`) | Dark (`.dark`) | 設計意図 |
|-------|-----------------|----------------|---------|
| `--background` | `oklch(0.98 0.003 250)` | `oklch(0.145 0.02 260)` | 深いネイビー。DESIGN.md の `#0D1B2A` 相当 |
| `--foreground` | `oklch(0.17 0.03 260)` | `oklch(0.985 0 0)` | ほぼ白 |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0.02 260)` | DESIGN.md の `#1C2E45` 相当 |
| `--card-foreground` | `oklch(0.17 0.03 260)` | `oklch(0.985 0 0)` | カード内テキスト |
| `--primary` | `oklch(0.45 0.15 260)` | `oklch(0.6 0.18 260)` | ダークでは明度を上げて視認性確保 |
| `--accent` | `oklch(0.68 0.12 80)` | `oklch(0.6 0.14 75)` | ゴールド。暗背景向けに調整済み |
| `--border` | `oklch(0.9 0.02 260)` | `oklch(1 0 0 / 10%)` | 半透明白ボーダー |
| `--input` | `oklch(0.9 0.02 260)` | `oklch(1 0 0 / 15%)` | 入力フィールド背景 |
| `--muted` | `oklch(0.94 0.01 260)` | `oklch(0.269 0.02 260)` | サブ背景 |
| `--muted-foreground` | `oklch(0.5 0.03 250)` | `oklch(0.708 0 0)` | 補助テキスト |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | エラー。ダークでは明度UP |
| `--success` | `oklch(0.52 0.17 155)` | `oklch(0.62 0.17 155)` | 成功。ダークでは明度UP |

#### 4. ダークモード追加変数（不足分）

`globals.css` の `.dark` に以下を追加する:

```css
.dark {
  /* existing variables... */

  /* Shadow adjustments for dark mode */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.3), 0 20px 40px rgba(0,0,0,0.4);
  --shadow-modal: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3);
  --shadow-gold: 0 0 20px rgba(201,168,76,0.25); /* brighter on dark bg */

  /* Gold variants for dark mode */
  --gold-warm: oklch(0.72 0.14 80);
  --gold-light: oklch(0.82 0.12 80);
  --gold-subtle: oklch(0.72 0.14 80 / 0.2);
}
```

### 全コンポーネントの対応箇所

#### semantic token で自動切替されるもの（対応不要）

Tailwind の `bg-background`, `text-foreground`, `bg-card`, `border-border` 等の semantic token を使用しているコンポーネントは **自動的にダークモード対応**。Release 1 で semantic token を徹底していれば、以下は対応不要:

- `Card`, `Button`, `Input`, `Label` (shadcn/ui)
- `BottomNav` (`bg-background`, `border-border`)
- `VenueCard` (`bg-card`, `text-card-foreground`)
- `InsightCard` (`bg-gold-subtle`, `border-l-gold-warm`)
- `ProgressRing` (`text-primary`)

#### 個別対応が必要なコンポーネント

| コンポーネント | 対応内容 | 具体的な変更 |
|--------------|---------|-------------|
| `PhotoCarousel` | 写真上のオーバーレイ | グラデーションの opacity 調整。ダーク時は `from-black/60` → `from-black/40` |
| `EstimateWaterfallChart` (Recharts) | チャートの色 | Recharts の `fill`, `stroke` を CSS 変数参照に変更 |
| `StarRatingInput` | 星の色 | `fill-gold-warm` は CSS 変数なので自動対応。ただし `stroke` が直値の場合は修正 |
| `DecisionCeremony` | コンフェッティの背景 | `canvas-confetti` の背景は透過なので対応不要。ただしサマリカードの背景確認 |
| `ChatBubble` | AI/ユーザーの背景色 | AI: `bg-muted`（自動対応）。ユーザー: `bg-primary`（自動対応） |
| `FilterChips` | 選択/非選択状態 | `bg-primary/10` のアルファ値をダークで `bg-primary/20` に |
| `VenueStatusBadge` | バッジ背景 | 白背景 → `bg-card` に変更 |

#### 画像・メディアの対応

- Supabase Storage の式場写真: 対応不要（写真自体は変更しない）
- アイコン (lucide-react): `currentColor` ベースなので自動対応
- ロゴ: ダーク用バリアントを用意するか、SVG の `fill` を `currentColor` に

### コントラスト比 4.5:1 確認方法

#### 自動テスト

```typescript
// tests/dark-mode-contrast.test.ts
import { oklchToHex } from "@/lib/color-utils";

// oklch 値からコントラスト比を計算するユーティリティ
function getContrastRatio(fg: string, bg: string): number {
  // WCAG 2.1 relative luminance formula
  // ...
}

describe("Dark mode contrast ratios (WCAG AA)", () => {
  it("foreground on background >= 4.5:1", () => {
    // oklch(0.985 0 0) on oklch(0.145 0.02 260) → ~15.5:1
    expect(getContrastRatio("oklch(0.985 0 0)", "oklch(0.145 0.02 260)"))
      .toBeGreaterThanOrEqual(4.5);
  });

  it("muted-foreground on card >= 4.5:1", () => {
    // oklch(0.708 0 0) on oklch(0.205 0.02 260) → ~5.8:1
    expect(getContrastRatio("oklch(0.708 0 0)", "oklch(0.205 0.02 260)"))
      .toBeGreaterThanOrEqual(4.5);
  });

  it("primary on background >= 4.5:1", () => {
    // oklch(0.6 0.18 260) on oklch(0.145 0.02 260) → ~4.7:1
    expect(getContrastRatio("oklch(0.6 0.18 260)", "oklch(0.145 0.02 260)"))
      .toBeGreaterThanOrEqual(4.5);
  });

  // ... all semantic token combinations
});
```

#### 手動検証ツール

- Chrome DevTools: Rendering → Emulate CSS media feature `prefers-color-scheme: dark`
- axe DevTools 拡張: 自動コントラスト比チェック
- Playwright E2E: `page.emulateMedia({ colorScheme: "dark" })` でダークモードでのスクリーンショット比較

### Release 1 で仕込んでおくべきCSS設計

詳細は [j) Release 1-3 への先行要件](#j-release-1-3-への先行要件バックポート) を参照。

---

## b) PWA + オフライン設計

### ライブラリ選定: `@serwist/next`

| 候補 | メリット | デメリット | 判定 |
|------|---------|-----------|------|
| `next-pwa` | 実績あり | メンテ停滞（last update 2023）、Next.js 16 未対応の可能性 | 不採用 |
| `@serwist/next` | Workbox後継、Next.js App Router対応、活発メンテ、TypeScript-first | next-pwaより若い | **採用** |
| カスタム SW | 完全制御 | 実装量が膨大 | 不採用 |

```bash
npm install @serwist/next serwist
npm install dexie dexie-react-hooks
```

### ServiceWorker キャッシュ戦略

#### ルーティング別戦略

| リソース | 戦略 | TTL | 理由 |
|---------|------|-----|------|
| HTML ページ (`/`, `/explore`, `/candidates`, `/coach`) | NetworkFirst | — | 最新データを優先。オフライン時はキャッシュ |
| Next.js 静的アセット (`/_next/static/`) | CacheFirst | 365日 | ハッシュ付きファイル名で immutable |
| フォント (Noto Serif JP, Noto Sans JP) | CacheFirst | 365日 | 変更されない |
| 画像 (Supabase Storage) | StaleWhileRevalidate | 30日 | 式場写真は変更頻度低 |
| API Routes / Server Actions | NetworkFirst | — | 常に最新データを取得。オフライン時はIndexedDBフォールバック |
| `manifest.json` | NetworkFirst | — | PWA設定 |

#### ServiceWorker 構成

```typescript
// src/sw.ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist, CacheFirst, NetworkFirst, StaleWhileRevalidate } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase Storage images
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\//,
      handler: new StaleWhileRevalidate({
        cacheName: "venue-images",
        plugins: [
          { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
        ],
      }),
    },
    // Google Fonts
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
        ],
      }),
    },
    // Default
    ...defaultCache,
  ],
});

serwist.addEventListeners();
```

#### next.config.ts 設定

```typescript
import withSerwist from "@serwist/next";

const nextConfig = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})({
  // existing next config...
});
```

### IndexedDB (Dexie.js) オフラインデータ

#### スキーマ定義

```typescript
// src/lib/offline/db.ts
import Dexie, { type EntityTable } from "dexie";

interface OfflineVenue {
  id: string;            // server UUID or local temp ID
  serverId?: string;     // null if not yet synced
  projectId: string;
  name: string;
  location: string | null;
  photoUrls: string[];
  status: string;
  ceremonyStyles: string[];
  capacityMin: number | null;
  capacityMax: number | null;
  updatedAt: number;     // timestamp for sync ordering
  syncStatus: "synced" | "pending" | "conflict";
}

interface OfflineScore {
  id: string;
  venueId: string;
  dimension: string;
  score: number;
  source: string;
  updatedAt: number;
  syncStatus: "synced" | "pending" | "conflict";
}

interface OfflineMemo {
  id: string;
  venueId: string;
  content: string;
  tags: string[];
  createdAt: number;
  syncStatus: "synced" | "pending" | "conflict";
}

interface OfflinePhoto {
  id: string;
  venueId: string;
  blob: Blob;            // local photo data
  thumbnailBlob: Blob;   // compressed thumbnail
  uploadedUrl?: string;  // Supabase Storage URL after sync
  createdAt: number;
  syncStatus: "synced" | "pending" | "conflict";
}

interface SyncQueue {
  id: string;            // auto-increment
  action: "create" | "update" | "delete";
  table: string;
  entityId: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
}

const db = new Dexie("VenueLensOffline") as Dexie & {
  venues: EntityTable<OfflineVenue, "id">;
  scores: EntityTable<OfflineScore, "id">;
  memos: EntityTable<OfflineMemo, "id">;
  photos: EntityTable<OfflinePhoto, "id">;
  syncQueue: EntityTable<SyncQueue, "id">;
};

db.version(1).stores({
  venues: "id, projectId, syncStatus, updatedAt",
  scores: "id, venueId, syncStatus",
  memos: "id, venueId, syncStatus",
  photos: "id, venueId, syncStatus",
  syncQueue: "++id, table, syncStatus, createdAt",
});

export { db };
export type { OfflineVenue, OfflineScore, OfflineMemo, OfflinePhoto, SyncQueue };
```

### 同期戦略

#### 基本方針: 楽観的更新 + Last-Write-Wins

```
[オフライン操作]
  1. IndexedDB に即時書き込み → UI に即反映（楽観的更新）
  2. SyncQueue にアクションを追加

[オンライン復帰時]
  3. SyncQueue を createdAt 昇順で処理
  4. 各エントリを Server Action 経由で送信
  5. 成功 → syncStatus = "synced"、SyncQueue からエントリ削除
  6. 失敗（409 Conflict）→ syncStatus = "conflict"、ユーザーに通知
  7. 失敗（その他）→ retryCount++、3回まで再試行
```

#### コンフリクト解決

```typescript
// src/lib/offline/sync.ts

type ConflictResolution = "local" | "server" | "merge";

interface ConflictInfo {
  entityType: string;
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
}

/**
 * コンフリクト解決戦略:
 *
 * 1. 評価 (scores): Last-Write-Wins（updatedAt が新しい方を採用）
 *    - 理由: ユーザーの最新の意思を反映すべき
 *
 * 2. メモ (memos): 両方保持（マージ）
 *    - 理由: メモは追記型。データ損失を避ける
 *
 * 3. 式場 (venues): サーバー優先
 *    - 理由: 式場データは共有リソース。パートナーの変更を尊重
 *
 * 4. 写真 (photos): ローカル優先（アップロード）
 *    - 理由: 写真は追加のみで競合しにくい
 */
```

#### オンライン/オフライン検知 Hook

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

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // SSR では常にオンライン
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

#### Supabase との offline/online 切替

```typescript
// src/lib/offline/data-layer.ts

/**
 * データ取得レイヤー:
 *
 * [オンライン時]
 *   Server Action → Prisma → PostgreSQL
 *   ↓ (取得後)
 *   IndexedDB にキャッシュ保存
 *
 * [オフライン時]
 *   IndexedDB から直接読み取り
 *   書き込みは IndexedDB + SyncQueue
 *
 * [復帰時]
 *   SyncQueue → Server Action → PostgreSQL
 *   PostgreSQL → IndexedDB 全体同期（差分更新）
 */

export async function getVenuesWithOfflineFallback(projectId: string) {
  if (navigator.onLine) {
    try {
      const venues = await getVenues(); // Server Action
      await db.venues.bulkPut(
        venues.map((v) => ({ ...v, syncStatus: "synced", updatedAt: Date.now() }))
      );
      return venues;
    } catch {
      // Network error — fall through to offline
    }
  }

  // Offline fallback
  return db.venues.where("projectId").equals(projectId).toArray();
}
```

### Install Prompt の UX

#### タイミング

1. **初回訪問**: 表示しない（まずサービスを体験させる）
2. **式場3件追加後**: BottomSheet で PWA インストール促進
3. **2回目以降の訪問**: バナー表示（ホームタブ上部、dismissible）
4. **見学直前**: 「オフラインでも使えます」の文脈で促進

#### 実装

```typescript
// src/components/pwa/install-prompt.tsx
"use client";

import { useEffect, useState } from "react";

// beforeinstallprompt イベントをキャプチャ
// 条件を満たしたらBottomSheetを表示
// "インストール" → deferredPrompt.prompt()
// "あとで" → localStorage に dismiss timestamp 保存（7日後に再表示）
```

### manifest.json

```json
{
  "name": "VenueLens - 式場選びのパートナー",
  "short_name": "VenueLens",
  "description": "二人で自然に、迷わず、後悔なく式場を選べるアプリ",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1C2A4A",
  "background_color": "#F8F9FC",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## c) スワイプ比較設計

### 概要

5式場以上がお気に入りに登録されている場合に表示される、Tinder風のスワイプUIで式場を素早く絞り込む機能。

### 表示条件

```typescript
// Candidates タブ内、ショートリストビューの上部に表示
const showSwipeMode = favorites.length >= 5;
```

5件未満の場合はスワイプモードの起動ボタンを非表示。起動は明示的（「スワイプで絞り込む」ボタンタップ）。

### コンポーネント設計

```
SwipeCompare (フルスクリーンオーバーレイ)
├── SwipeCard (draggable)
│   ├── PhotoCarousel (既存コンポーネント再利用)
│   ├── VenueQuickInfo (名前、場所、予算)
│   └── ScoreSummary (総合スコア + Top3強み)
├── SwipeActions (ボタン3つ: パス / 比較に追加 / いいね)
├── SwipeProgress ("3/8 残り5件")
└── SwipeResult (完了画面: 比較候補リスト)
```

#### SwipeCard コンポーネント

```typescript
// src/components/candidates/swipe-card.tsx
"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";

interface SwipeCardProps {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    totalScore: number;
    topStrengths: string[];
    latestEstimate: { total: number } | null;
  };
  onSwipe: (direction: "left" | "right" | "up") => void;
  isTop: boolean; // stack最上位のカードのみドラッグ可能
}
```

### framer-motion ドラッグジェスチャー

```typescript
// SwipeCard 内部
const x = useMotionValue(0);
const y = useMotionValue(0);

// 回転: 水平移動量に比例（最大15度）
const rotate = useTransform(x, [-200, 200], [-15, 15]);

// オーバーレイ色: 左=赤、右=緑
const leftOverlayOpacity = useTransform(x, [-150, 0], [0.5, 0]);
const rightOverlayOpacity = useTransform(x, [0, 150], [0, 0.5]);
const upOverlayOpacity = useTransform(y, [-150, 0], [0.5, 0]);

// ドラッグ終了時の判定
const SWIPE_THRESHOLD = 100; // px
const VELOCITY_THRESHOLD = 500; // px/s

function handleDragEnd(event, info) {
  const { offset, velocity } = info;

  if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > VELOCITY_THRESHOLD) {
    // 水平スワイプ
    if (offset.x > 0) onSwipe("right");  // いいね
    else onSwipe("left");                  // パス
  } else if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
    // 上スワイプ
    onSwipe("up");                          // 比較に追加
  } else {
    // 閾値未達 → 元の位置に戻す（spring animation）
  }
}
```

### スワイプ方向の意味

| 方向 | アクション | 視覚フィードバック | アイコン |
|------|-----------|------------------|---------|
| 右 (→) | いいね（お気に入り維持） | 緑オーバーレイ + Heart | `<Heart className="text-green-500" />` |
| 左 (←) | パス（お気に入り解除） | 赤オーバーレイ + X | `<X className="text-red-500" />` |
| 上 (↑) | 比較に追加 | 青オーバーレイ + Scale | `<Scale className="text-blue-500" />` |

下スワイプは無効（誤操作防止）。

### ボタンでの操作

スワイプが苦手なユーザー向けに、カード下部に3つのボタンを配置:

```
[✕ パス]  [⬆ 比較]  [♥ いいね]
```

各ボタンはプログラマティックにカードのスワイプアニメーションをトリガーする。

### パフォーマンス: 写真のプリロード

```typescript
// src/hooks/use-preload-images.ts
"use client";

import { useEffect } from "react";

/**
 * 現在のカード + 次の2枚のカードの先頭写真をプリロード。
 * スワイプ時にちらつきを防止する。
 */
export function usePreloadImages(venues: { photoUrls: string[] }[], currentIndex: number) {
  useEffect(() => {
    const toPreload = venues.slice(currentIndex + 1, currentIndex + 3);
    toPreload.forEach((v) => {
      if (v.photoUrls[0]) {
        const img = new Image();
        img.src = v.photoUrls[0];
      }
    });
  }, [venues, currentIndex]);
}
```

### 完了時のフロー

```
スワイプ完了
  ↓
SwipeResult 画面表示
  - "いいね" した式場リスト
  - "比較に追加" した式場リスト（2-3件）
  - [比較ボードを開く] ボタン → /candidates の比較モードへ
  ↓
自動で ComparisonBoard に遷移（比較追加が2件以上の場合）
```

---

## d) 通知システム設計

### 通知チャンネル

| チャンネル | 実装 | 用途 |
|-----------|------|------|
| アプリ内（インサイトカード） | Release 1 既存の `getAIInsights()` を拡張 | メイン。全ユーザーに必ず届く |
| プッシュ通知 (Web Push) | Web Push API + VAPID | バックグラウンド通知。見学リマインダー等 |
| メール | Supabase Edge Functions + Resend | 週次サマリ、パートナーアクション通知 |

### 頻度モード

| モード | アプリ内 | プッシュ | メール |
|-------|---------|---------|-------|
| おまかせ | 全トリガー | 重要なもの（見学前日、パートナーリアクション） | 週1サマリ |
| 控えめ | 全トリガー | 見学前日のみ | 月1サマリ |
| オフ | 全トリガー | 無効 | 無効 |

アプリ内通知は全モードで有効（インサイトカードはユーザーがアクセスしたときのみ表示されるため、過剰にならない）。

### トリガーイベント

| イベント | トリガー条件 | チャンネル | 優先度 |
|---------|-------------|-----------|--------|
| 見学リマインダー | Visit.scheduledAt の前日 18:00 | プッシュ + アプリ内 | 高 |
| パートナーリアクション | PartnerReaction 新規作成 | プッシュ + アプリ内 | 高 |
| パートナー評価完了 | VisitRating がパートナーから追加 | プッシュ + アプリ内 | 中 |
| AI分析完了 | AiAnalysis 新規作成 | アプリ内のみ | 中 |
| 週次サマリ | 毎週月曜 10:00 | メール | 低 |
| 見学後リマインダー | Visit.completedAt から3日後 | プッシュ + アプリ内 | 中 |
| 候補式場の空き状況 | 外部連携（将来） | プッシュ | 高 |

### Prisma スキーマ: NotificationPreference

```prisma
enum NotificationFrequency {
  auto      // おまかせ
  quiet     // 控えめ
  off       // オフ
}

model NotificationPreference {
  id             String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String                @unique @map("user_id") @db.Uuid
  frequency      NotificationFrequency @default(auto)
  pushEnabled    Boolean               @default(false) @map("push_enabled")
  emailEnabled   Boolean               @default(true) @map("email_enabled")
  pushSubscription Json?               @map("push_subscription")  // PushSubscription JSON
  createdAt      DateTime              @default(now()) @map("created_at")
  updatedAt      DateTime              @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_preferences")
}

model Notification {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  type       String    // "visit_reminder" | "partner_reaction" | "ai_complete" | etc.
  title      String
  body       String
  href       String?   // deep link
  read       Boolean   @default(false)
  readAt     DateTime? @map("read_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([userId, read])
  @@index([userId, createdAt])
  @@map("notifications")
}
```

User モデルへのリレーション追加:

```prisma
model User {
  // ... existing fields ...
  notificationPreference NotificationPreference?
  notifications          Notification[]
}
```

### Web Push API 実装

#### VAPID キー生成

```bash
npx web-push generate-vapid-keys
# 結果を環境変数に設定:
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
# VAPID_EMAIL=mailto:contact@venuelens.app
```

#### プッシュ登録フロー

```typescript
// src/lib/push/register.ts
"use client";

export async function registerPush(): Promise<PushSubscription | null> {
  if (!("PushManager" in window)) return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  // Server Action で subscription を DB に保存
  await savePushSubscription(subscription.toJSON());

  return subscription;
}
```

#### プッシュ送信 (Server-side)

```typescript
// src/server/push/send.ts
import webPush from "web-push";

webPush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushNotification(userId: string, payload: {
  title: string;
  body: string;
  href?: string;
}) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref?.pushEnabled || !pref.pushSubscription) return;
  if (pref.frequency === "off") return;

  await webPush.sendNotification(
    pref.pushSubscription as webPush.PushSubscription,
    JSON.stringify(payload),
  );

  // Notification レコード作成
  await prisma.notification.create({
    data: {
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      href: payload.href,
    },
  });
}
```

#### ServiceWorker でのプッシュ受信

```typescript
// src/sw.ts に追加
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "VenueLens", body: "新しいお知らせがあります" };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { href: data.href },
      tag: data.type, // same tag = replace previous
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? "/";
  event.waitUntil(clients.openWindow(href));
});
```

---

## e) AIコスト最適化

### input_hash キャッシュの TTL 設計

既存の `AiAnalysis.inputHash` フィールドを活用し、同一入力に対する重複API呼び出しを排除する。

#### TTL ポリシー

| 分析タイプ | TTL | 理由 |
|-----------|-----|------|
| `review_summary` | 30日 | 口コミデータは頻繁に変わらない |
| `estimate_prediction` | 7日 | 見積もりバージョン追加で無効化されるべき |
| `comparison` | 3日 | 式場スコアの変更に追従 |
| `visit_prep` | 1日 | 見学日が近いので最新情報が重要 |
| `coach_chat` | キャッシュなし | 会話コンテキストに依存 |

#### キャッシュ判定ロジック

```typescript
// src/server/ai/cache.ts
import crypto from "crypto";

export function computeInputHash(input: Record<string, unknown>): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export async function getCachedAnalysis(
  projectId: string,
  type: AiAnalysisType,
  inputHash: string,
  ttlDays: number,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      projectId,
      type,
      inputHash,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return cached?.output ?? null;
}
```

### レスポンスキャッシュ（同じ式場の分析再利用）

#### 戦略

1. **見積もり分析**: 同じ Estimate.id + version に対するキャッシュ。Estimate更新時に自動無効化
2. **口コミ要約**: 同じ sourceUrls セットに対するキャッシュ。30日間有効
3. **比較分析**: 同じ venueIds セット（ソート済み）に対するキャッシュ。スコア変更で無効化

#### 無効化トリガー

```typescript
// src/server/ai/invalidate.ts

/**
 * キャッシュ無効化ルール:
 *
 * 1. 見積もり更新 → estimate_prediction の該当 venueId キャッシュ削除
 * 2. スコア変更 → comparison の関連 venueIds キャッシュ削除
 * 3. 口コミURL追加 → review_summary の該当 venueId キャッシュ削除
 * 4. 手動全削除（管理者用）
 */
export async function invalidateAiCache(
  venueId: string,
  types: AiAnalysisType[],
): Promise<number> {
  const result = await prisma.aiAnalysis.deleteMany({
    where: {
      venueId,
      type: { in: types },
    },
  });
  return result.count;
}
```

### トークン消費量のモニタリング

#### Anthropic Dashboard

Anthropic Console のUsageページで全体的なトークン消費量を確認（API key 単位）。

#### カスタムログ

```typescript
// src/server/ai/client.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface AiUsageLog {
  type: AiAnalysisType;
  inputTokens: number;
  outputTokens: number;
  model: string;
  userId: string;
  projectId: string;
  cached: boolean;
  durationMs: number;
  cost: number; // estimated USD
}

export async function callClaude(params: {
  type: AiAnalysisType;
  messages: Anthropic.Messages.MessageParam[];
  userId: string;
  projectId: string;
}) {
  const start = Date.now();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: params.messages,
  });

  const usage: AiUsageLog = {
    type: params.type,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
    userId: params.userId,
    projectId: params.projectId,
    cached: false,
    durationMs: Date.now() - start,
    cost: estimateCost(response.usage),
  };

  // ログ保存（Supabase の analytics テーブル or console.log for MVP）
  await logAiUsage(usage);

  return response;
}

function estimateCost(usage: { input_tokens: number; output_tokens: number }): number {
  // Sonnet 4 pricing: $3/M input, $15/M output
  return (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
}
```

### ユーザー別の月間制限と課金モデル設計

#### フリーミアムモデル

| プラン | AI呼び出し/月 | 機能 | 価格 |
|-------|-------------|------|------|
| Free | 20回 | 基本AI機能（コーチチャット、見積もりX線、比較分析） | 無料 |
| Pro | 100回 | 全AI機能 + PDF解析 + 口コミ分析 + 優先処理 | 月額980円 |
| Unlimited | 無制限 | Pro + パートナーフル機能 + OGPカスタマイズ | 月額1,980円 |

#### 制限の実装

```prisma
model UserUsage {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  yearMonth      String   @map("year_month")  // "2026-04"
  aiCallCount    Int      @default(0) @map("ai_call_count")
  inputTokens    Int      @default(0) @map("input_tokens")
  outputTokens   Int      @default(0) @map("output_tokens")
  estimatedCost  Decimal  @default(0) @map("estimated_cost") @db.Decimal(8, 4)
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([userId, yearMonth])
  @@map("user_usage")
}
```

```typescript
// src/server/ai/rate-limit.ts

const PLAN_LIMITS = {
  free: 20,
  pro: 100,
  unlimited: Infinity,
} as const;

export async function checkAiLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  plan: string;
}> {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const usage = await prisma.userUsage.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
  });

  const plan = await getUserPlan(userId); // Stripe or manual
  const limit = PLAN_LIMITS[plan];
  const current = usage?.aiCallCount ?? 0;

  return {
    allowed: current < limit,
    remaining: Math.max(0, limit - current),
    plan,
  };
}
```

---

## f) OGP画像生成

### 技術選定: `@vercel/og` (Satori)

**選定理由**: `@vercel/og` は Vercel Edge Runtime で動作し、JSX → SVG → PNG の変換を行う。Next.js App Router の `opengraph-image.tsx` ファイル規約と統合可能。

```bash
# @vercel/og は next に含まれているため追加インストール不要
# Next.js 16 には ImageResponse が組み込み済み
```

### 決定セレモニーのシェアカード

#### OGP画像のデザイン

```
┌──────────────────────────────────┐  1200x630px
│                                  │
│  VenueLens                       │  ← ロゴ (左上)
│                                  │
│  ┌────────────┐                  │
│  │   📷       │  ○○○○○          │  ← 式場写真 (280x210) + 式場名 (Noto Serif JP)
│  │  式場写真   │  エリア名        │
│  │            │                  │
│  └────────────┘  ここに決めました  │  ← 決定メッセージ (Gold, 大文字)
│                                  │
│  ✨ ○○さん & ○○さん              │  ← カップル名
│     2026.04.13 決定              │  ← 決定日
│                                  │
│  ──────────────────────────────  │
│  venuelens.app                   │  ← フッター
└──────────────────────────────────┘
```

#### 実装

```typescript
// src/app/api/og/decision/route.tsx
import { ImageResponse } from "next/og";
import { prisma } from "@/server/db";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const decisionId = searchParams.get("id");

  if (!decisionId) {
    return new Response("Missing decision ID", { status: 400 });
  }

  // Fetch decision data
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: {
      venue: true,
      project: { include: { members: { include: { user: true } } } },
    },
  });

  if (!decision) {
    return new Response("Decision not found", { status: 404 });
  }

  // Load fonts
  const notoSerifJP = await fetch(
    new URL("../../../../assets/fonts/NotoSerifJP-Light.otf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const notoSansJP = await fetch(
    new URL("../../../../assets/fonts/NotoSansJP-Regular.otf", import.meta.url)
  ).then((res) => res.arrayBuffer());

  const venueName = decision.venue.name;
  const members = decision.project.members.map((m) => m.user.name).filter(Boolean);
  const decidedAt = decision.decidedAt.toISOString().split("T")[0];
  const venuePhoto = decision.venue.photoUrls?.[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1C2A4A 0%, #0D1B2A 100%)",
          color: "white",
          fontFamily: "Noto Sans JP",
          padding: 60,
        }}
      >
        {/* VenueLens logo */}
        <div style={{ fontSize: 20, opacity: 0.7, marginBottom: 40 }}>VenueLens</div>

        <div style={{ display: "flex", flex: 1, gap: 40 }}>
          {/* Venue photo */}
          {venuePhoto && (
            <img
              src={venuePhoto}
              width={280}
              height={210}
              style={{ borderRadius: 16, objectFit: "cover" }}
            />
          )}

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "Noto Serif JP", fontSize: 36, letterSpacing: "0.1em" }}>
              {venueName}
            </div>
            <div style={{ fontSize: 48, color: "#C9A84C", marginTop: 16, fontWeight: 300 }}>
              ここに決めました
            </div>
          </div>
        </div>

        {/* Couple info */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 20 }}>
            {members.join(" & ")}
          </div>
          <div style={{ fontSize: 16, opacity: 0.6, marginTop: 8 }}>
            {decidedAt} 決定
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16, marginTop: 20, fontSize: 14, opacity: 0.5 }}>
          venuelens.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Serif JP", data: notoSerifJP, weight: 300 },
        { name: "Noto Sans JP", data: notoSansJP, weight: 400 },
      ],
    }
  );
}
```

### Open Graph meta tags の動的生成

```typescript
// src/app/(app)/candidates/share/[decisionId]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }): Promise<Metadata> {
  const decision = await prisma.decision.findUnique({
    where: { id: params.decisionId },
    include: { venue: true, project: { include: { members: { include: { user: true } } } } },
  });

  if (!decision) return {};

  const members = decision.project.members.map((m) => m.user.name).filter(Boolean);
  const title = `${members.join("&")} - ${decision.venue.name}に決めました`;
  const description = `VenueLensで式場を比較・検討した結果、${decision.venue.name}に決めました。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `/api/og/decision?id=${decision.id}`,
          width: 1200,
          height: 630,
          alt: `${decision.venue.name} - 決定シェアカード`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og/decision?id=${decision.id}`],
    },
  };
}

// Share page: 決定内容のプレビュー + SNSシェアボタン
export default async function DecisionSharePage({ params }) {
  // ... render share page with LINE, X (Twitter), Instagram story share buttons
}
```

### シェアボタン

```typescript
// src/components/decision/share-buttons.tsx
"use client";

// LINE: https://social-plugins.line.me/lineit/share?url={url}
// X (Twitter): https://twitter.com/intent/tweet?url={url}&text={text}
// コピー: navigator.clipboard.writeText(url)
// Instagram Story: Web Share API (navigator.share) for supported platforms
```

---

## g) Google OAuth追加

### Supabase Auth の Google Provider 設定

#### 1. Google Cloud Console 設定

```
1. Google Cloud Console → APIs & Services → Credentials
2. OAuth 2.0 Client ID 作成
   - Application type: Web application
   - Authorized redirect URIs: https://<project-ref>.supabase.co/auth/v1/callback
3. Client ID と Client Secret を取得
```

#### 2. Supabase Dashboard 設定

```
1. Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Client ID と Client Secret を入力
4. Authorized redirect URIs が正しいことを確認
```

#### 3. 環境変数

```env
# .env.local に追加（既存の SUPABASE_URL, SUPABASE_ANON_KEY に追加）
# Google OAuth の認証情報は Supabase 側に設定するため、
# アプリケーション側の環境変数追加は不要
```

### 既存 Email 認証との共存

#### ユーザーマッチング戦略

```
[新規ユーザー]
  Google OAuth → Supabase Auth が自動的に users テーブルに追加
  → syncUser() (既存) で VenueLens users テーブルにも同期

[既存 Email ユーザーが Google でログイン]
  同じメールアドレスの場合:
  → Supabase Auth の "Automatically link" 設定が有効なら自動リンク
  → 同じ User レコードでアクセス可能

[Google ユーザーが後から Email+Password を追加]
  → Supabase Auth の identity linking で対応
```

#### Supabase Auth 設定

Supabase Dashboard → Authentication → General:
- **Enable automatic linking**: ON（同じメールアドレスのアカウントを自動リンク）

### ログインUI の変更

```typescript
// src/app/(auth)/login/page.tsx — 変更箇所

// 現行: Email + Password のみ
// 変更後: Google OAuth ボタン + セパレータ + Email/Password

// Google OAuth ボタン追加
async function signInWithGoogle() {
  const supabase = createBrowserClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}
```

#### ログインUI構成

```
┌─────────────────────────────────┐
│                                 │
│  VenueLens                      │
│  式場選びのパートナー              │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🔵 Googleでログイン      │   │  ← Google OAuth ボタン
│  └─────────────────────────┘   │
│                                 │
│  ──────── または ────────        │  ← セパレータ
│                                 │
│  メールアドレス                   │
│  ┌─────────────────────────┐   │
│  │ email@example.com        │   │
│  └─────────────────────────┘   │
│  パスワード                      │
│  ┌─────────────────────────┐   │
│  │ ••••••••                 │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ ログイン                  │   │
│  └─────────────────────────┘   │
│                                 │
│  アカウントをお持ちでない方 →     │
│                                 │
└─────────────────────────────────┘
```

サインアップ画面にも同様に Google OAuth ボタンを追加。

### syncUser() の対応

```typescript
// src/server/actions/auth.ts — syncUser() の変更

// 現行: Supabase Auth の user.email と user.user_metadata.full_name を使用
// Google OAuth でも同じフィールドが提供されるため、変更不要。
// user.user_metadata.full_name → Google アカウント名が入る
// user.email → Google アカウントのメールアドレスが入る
```

`syncUser()` はログインプロバイダに関係なく動作するため、**コード変更は不要**。

---

## h) パフォーマンス最適化

### バーチャルスクロール（50+ 式場のリスト）

#### 対象画面

- Explore タブ: 式場カードリスト
- Candidates タブ: お気に入りリスト

#### ライブラリ選定: `@tanstack/react-virtual`

```bash
npm install @tanstack/react-virtual
```

**選定理由**: React 19対応、lightweight（~3KB gzip）、vertical/horizontal/grid対応、SSR互換。

#### 実装

```typescript
// src/components/explore/venue-list-virtual.tsx
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

interface VenueListVirtualProps {
  venues: VenueCardData[];
}

export function VenueListVirtual({ venues }: VenueListVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: venues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // VenueCard の推定高さ (px)
    overscan: 3,             // 画面外に3枚分プリレンダー
  });

  return (
    <div ref={parentRef} className="h-[calc(100dvh-200px)] overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            className="absolute left-0 top-0 w-full"
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <VenueCard venue={venues[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 適用閾値

- 20件以下: 通常レンダリング（バーチャルスクロール不使用）
- 20件超: バーチャルスクロール自動適用

### Next.js Image 最適化

#### Supabase Storage からの配信設定

```typescript
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [375, 640, 768, 1024, 1280],
    imageSizes: [128, 256, 384],
  },
};
```

#### 画像サイズ戦略

| コンテキスト | サイズ | `sizes` prop |
|-------------|--------|-------------|
| VenueCard (カルーセル) | 4:3, max-width: 100% | `(max-width: 768px) 100vw, 50vw` |
| VenueCardSmall (横スクロール) | 280x210 | `280px` |
| VenueDetail ヒーロー | full-width, 16:9 | `100vw` |
| OGP (シェアカード) | 1200x630 | N/A (API route) |

#### lazy loading

```typescript
// 全ての式場写真に loading="lazy" + placeholder="blur" を適用
<Image
  src={photoUrl}
  alt={venueName}
  width={560}
  height={420}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."  // 低解像度プレースホルダー
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

### バンドルサイズ分析と削減

#### 分析ツール

```bash
# next build で自動的にバンドル分析
ANALYZE=true npm run build

# @next/bundle-analyzer での詳細分析
npm install -D @next/bundle-analyzer
```

#### 削減戦略

| 対策 | 効果 | 実装方法 |
|------|------|---------|
| Dynamic import (Recharts) | ~200KB gzip削減 | `dynamic(() => import("recharts"), { ssr: false })` |
| Dynamic import (framer-motion) | ~80KB gzip削減 | スワイプ比較画面のみで読み込み |
| Dynamic import (canvas-confetti) | ~10KB gzip削減 | 決定セレモニーのみで読み込み |
| Tree shaking (lucide-react) | 自動 | named import で必要アイコンのみ |
| Dexie.js lazy load | ~30KB gzip削減 | オフラインモード初回使用時に動的読み込み |

```typescript
// 例: Recharts の dynamic import
const WaterfallChart = dynamic(
  () => import("@/components/estimates/estimate-waterfall-chart"),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" />,
  }
);
```

### Core Web Vitals 目標値

| 指標 | 目標 | 測定方法 | 対策 |
|------|------|---------|------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse / Web Vitals | フォント preload、hero image の priority 属性 |
| INP (Interaction to Next Paint) | < 200ms | Web Vitals | useTransition による Server Action の非ブロッキング化 |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse / Web Vitals | 画像の width/height 明示、loading.tsx スケルトンの正確なサイズ |
| FCP (First Contentful Paint) | < 1.8s | Lighthouse | フォントの font-display: swap |
| TTFB (Time to First Byte) | < 800ms | Web Vitals | Vercel Edge Network、Server Component のストリーミング |

#### モニタリング

```typescript
// src/app/layout.tsx
import { SpeedInsightsProvider } from "@vercel/speed-insights/next";

// Vercel Speed Insights で本番環境のリアルユーザーメトリクスを自動収集
<SpeedInsightsProvider />
```

---

## i) テスト計画

### テスト対象とカバレッジ目標

| 機能 | テスト種別 | カバレッジ目標 | テストファイル |
|------|-----------|-------------|-------------|
| ダークモード | Unit + E2E | 80% | `tests/dark-mode-contrast.test.ts`, `tests/e2e/dark-mode.spec.ts` |
| PWA + オフライン | Unit + Integration | 70% | `tests/offline/dexie-sync.test.ts`, `tests/offline/service-worker.test.ts` |
| スワイプ比較 | Unit + E2E | 80% | `tests/swipe-compare.test.ts`, `tests/e2e/swipe.spec.ts` |
| 通知システム | Unit + Integration | 80% | `tests/notifications.test.ts`, `tests/push/web-push.test.ts` |
| AIコスト最適化 | Unit | 90% | `tests/ai/cache.test.ts`, `tests/ai/rate-limit.test.ts` |
| OGP画像生成 | E2E (screenshot) | — | `tests/e2e/ogp.spec.ts` |
| Google OAuth | Integration + E2E | 70% | `tests/auth/google-oauth.test.ts`, `tests/e2e/login.spec.ts` |
| パフォーマンス | E2E (Lighthouse) | — | `tests/e2e/performance.spec.ts` |

### ユニットテスト

#### ダークモード

```typescript
// tests/dark-mode-contrast.test.ts
describe("Dark mode CSS variables", () => {
  it("all text/background combinations meet WCAG AA (4.5:1)", () => {
    // foreground on background
    // muted-foreground on card
    // primary on background
    // accent on background
    // card-foreground on card
  });

  it("dark mode gold values are brighter than light mode", () => {
    // oklch(0.72 0.14 80) > oklch(0.68 0.12 80) in lightness
  });
});
```

#### AIキャッシュ

```typescript
// tests/ai/cache.test.ts
describe("AI cache", () => {
  it("returns cached analysis within TTL", async () => {});
  it("returns null for expired cache", async () => {});
  it("generates consistent input hash for same input", () => {});
  it("generates different hash for different input", () => {});
});

// tests/ai/rate-limit.test.ts
describe("AI rate limit", () => {
  it("allows calls under limit", async () => {});
  it("blocks calls at limit for free plan", async () => {});
  it("allows unlimited calls for unlimited plan", async () => {});
  it("resets count at month boundary", async () => {});
});
```

#### オフライン同期

```typescript
// tests/offline/dexie-sync.test.ts
describe("Offline sync", () => {
  it("queues operations when offline", async () => {});
  it("processes sync queue on reconnect", async () => {});
  it("handles conflict with last-write-wins for scores", async () => {});
  it("merges memos without data loss", async () => {});
  it("retries failed syncs up to 3 times", async () => {});
});
```

### E2E テスト

#### ダークモード

```typescript
// tests/e2e/dark-mode.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dark mode", () => {
  test("toggles between light and dark mode", async ({ page }) => {
    await page.goto("/");
    // Open settings
    // Click dark mode toggle
    // Verify html has class "dark"
    // Screenshot comparison
  });

  test("respects system preference", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    // Verify dark mode is active
  });

  test("all pages render correctly in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    for (const path of ["/", "/explore", "/candidates", "/coach"]) {
      await page.goto(path);
      await expect(page).toHaveScreenshot(`dark-${path.replace("/", "")}.png`);
    }
  });
});
```

#### スワイプ

```typescript
// tests/e2e/swipe.spec.ts
test.describe("Swipe compare", () => {
  test("shows swipe mode when 5+ favorites", async ({ page }) => {});
  test("right swipe keeps venue in favorites", async ({ page }) => {});
  test("left swipe removes from favorites", async ({ page }) => {});
  test("up swipe adds to comparison", async ({ page }) => {});
  test("completes swipe flow and shows results", async ({ page }) => {});
});
```

#### パフォーマンス

```typescript
// tests/e2e/performance.spec.ts
test.describe("Performance", () => {
  test("Home page LCP < 2.5s", async ({ page }) => {
    // Use Performance Observer API
  });

  test("Explore page with 100 venues scrolls smoothly", async ({ page }) => {
    // Measure FPS during scroll
  });

  test("Bundle size stays under budget", async () => {
    // Check .next/analyze output
    // JS total < 300KB gzip
  });
});
```

### OGP テスト

```typescript
// tests/e2e/ogp.spec.ts
test.describe("OGP image generation", () => {
  test("generates valid OGP image for decision", async ({ request }) => {
    const response = await request.get("/api/og/decision?id=test-decision-id");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("returns 400 for missing decision ID", async ({ request }) => {
    const response = await request.get("/api/og/decision");
    expect(response.status()).toBe(400);
  });
});
```

---

## j) Release 1-3 への先行要件（バックポート）

Release 4 の機能をスムーズに実装するため、Release 1-3 の段階で先行的に仕込んでおくべき項目。

### Release 1 への先行要件

#### 1. ダークモード: semantic token の徹底

**最優先**。Release 1 の全コンポーネントで以下を徹底する:

| NG（ハードコード） | OK（semantic token） |
|-------------------|---------------------|
| `bg-white` | `bg-background` or `bg-card` |
| `text-black` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `border-gray-200` | `border-border` |
| `bg-gray-100` | `bg-muted` |
| `text-blue-500` | `text-primary` |
| `bg-[#C9A84C]` | `bg-accent` or CSS variable `gold-warm` |
| `shadow-lg` (直値) | CSS variable `shadow-card` |
| `rgba(0,0,0,0.1)` (inline) | CSS variable 経由 |

**検証方法**: ESLint ルール or grep で Tailwind のカラー直値を検出。

```bash
# Release 1 完了後に実行するチェックスクリプト
grep -rn "bg-white\|bg-black\|text-white\|text-black\|text-gray-\|bg-gray-\|border-gray-" \
  src/components/ src/app/ --include="*.tsx" --include="*.ts"
# ヒットが 0 であること
```

#### 2. PWA: manifest.json を仕込む

Release 1 で `public/manifest.json` を配置する。ServiceWorker はまだ不要だが、manifest だけは先行配置。

```json
{
  "name": "VenueLens - 式場選びのパートナー",
  "short_name": "VenueLens",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#1C2A4A",
  "background_color": "#F8F9FC",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```html
<!-- src/app/layout.tsx の <head> に追加 -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1C2A4A" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

#### 3. CSS変数: ダークモード用シャドウ・ゴールド変数の `.dark` 事前定義

`globals.css` の `.dark` ブロックに以下を Release 1 で追加しておく（使用はR4から）:

```css
.dark {
  /* ... existing R1 variables ... */

  --shadow-card: 0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.3), 0 20px 40px rgba(0,0,0,0.4);
  --shadow-modal: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3);
  --shadow-gold: 0 0 20px rgba(201,168,76,0.25);
  --gold-warm: oklch(0.72 0.14 80);
  --gold-light: oklch(0.82 0.12 80);
  --gold-subtle: oklch(0.72 0.14 80 / 0.2);
}
```

#### 4. next-themes の ThemeProvider を Release 1 で設置

ただし UI 上のトグルは R4 まで非表示。defaultTheme を `"light"` に固定しておく。

```typescript
// Release 1 の layout.tsx
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
```

Release 4 で `defaultTheme="system"` に変更し、`enableSystem={true}` に切替。

### Release 2 への先行要件

#### 1. AIコスト最適化: inputHash の一貫した生成

Release 2 で Claude API を接続する際、全ての AI 呼び出しで `computeInputHash()` を使用し、`AiAnalysis.inputHash` に保存する設計を初めから組み込む。

```typescript
// Release 2 の全 AI Server Action で以下のパターンを徹底:
const inputHash = computeInputHash({ venueId, type, ...relevantInput });
const cached = await getCachedAnalysis(projectId, type, inputHash, TTL_DAYS[type]);
if (cached) return cached;
// ... API call ...
```

#### 2. UserUsage モデルの先行追加

Release 2 のマイグレーション時に `UserUsage` テーブルを追加しておく（課金は R4 だがトークン計測は R2 から）。

### Release 3 への先行要件

#### 1. 通知: NotificationPreference スキーマの先行追加

**推奨: Release 3 で先行追加**。見学リマインダー機能と合わせて通知基盤を用意する。

```
Release 3 で追加:
- NotificationPreference モデル（スキーマのみ）
- Notification モデル（スキーマのみ）
- 見学リマインダーの通知ロジック（アプリ内のみ。プッシュは R4）

Release 4 で有効化:
- Web Push API
- メール通知
- 頻度モード切替UI
```

#### 2. ServiceWorker 対応準備

Release 3 の見学クイックキャプチャ（写真撮影）でオフライン対応が部分的に必要になる可能性がある。`@serwist/next` のインストールと基本設定を Release 3 で行い、キャッシュ戦略の本格実装は Release 4 とする。

---

## 依存パッケージまとめ

Release 4 で新規追加するパッケージ:

| パッケージ | バージョン | 用途 | gzip サイズ |
|-----------|----------|------|------------|
| `next-themes` | ^0.4 | ダークモード | ~2KB |
| `@serwist/next` | ^9 | ServiceWorker / PWA | ~15KB |
| `serwist` | ^9 | ServiceWorker runtime | ~20KB |
| `dexie` | ^4 | IndexedDB wrapper | ~25KB |
| `dexie-react-hooks` | ^1 | Dexie React bindings | ~2KB |
| `@tanstack/react-virtual` | ^3 | バーチャルスクロール | ~3KB |
| `web-push` | ^3 | Web Push (server-side) | N/A (server) |

Release 1-3 で既にインストール済みのパッケージ:

- `framer-motion` (スワイプ比較で使用。既存)
- `@vercel/og` (Next.js 16に内蔵。追加不要)

---

## 実装順序

```
Phase 1: 基盤 (Week 1)
├── a) ダークモード（next-themes + 全コンポーネント確認）
├── g) Google OAuth（Supabase設定 + ログインUI）
└── h) バンドルサイズ分析・最適化

Phase 2: オフライン + 通知 (Week 1-2)
├── b) PWA + オフライン（@serwist/next + Dexie.js + 同期ロジック）
└── d) 通知システム（NotificationPreference + Web Push + メール）

Phase 3: 機能 (Week 2)
├── c) スワイプ比較（framer-motion ドラッグ）
├── f) OGP画像生成（@vercel/og + シェアページ）
└── e) AIコスト最適化（キャッシュ + レート制限 + モニタリング）

Phase 4: 仕上げ (Week 2)
├── h) バーチャルスクロール + Image最適化
├── i) テスト（全機能のUnit + E2E）
└── Core Web Vitals 最終チューニング
```

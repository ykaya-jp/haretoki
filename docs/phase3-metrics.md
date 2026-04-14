# Phase 3 Metrics — 計測テンプレート & 運用ルール

> Phase 1 〜 Phase 3 の改善効果を定量的に追跡するためのテンプレート。
> 実計測は本番稼働後に収集するため、このドキュメントはフォーマット定義と初期ベースライン推定値を記録する。
>
> 関連文書:
> - [docs/myreview/remediation-master-plan.md](./myreview/remediation-master-plan.md) — Phase 0-4 改善計画
> - [docs/myreview/ui-ux-remediation-plan.md](./myreview/ui-ux-remediation-plan.md) — UI/UX 詳細仕様（§5.7 パフォーマンス予算）
> - [docs/phase3-plan.md](./phase3-plan.md) — Phase 3 統合実装計画（ワークストリーム D）

---

## 目次

1. [計測ソース一覧](#1-計測ソース一覧)
2. [Core Web Vitals — ページ別](#2-core-web-vitals--ページ別)
3. [タブ切替体感時間](#3-タブ切替体感時間)
4. [Server Action レイテンシ](#4-server-action-レイテンシ)
5. [エラーレート](#5-エラーレート)
6. [バンドルサイズ](#6-バンドルサイズ)
7. [記録フォーマット（スプレッドシート用）](#7-記録フォーマットスプレッドシート用)
8. [運用ルール](#8-運用ルール)
9. [Vercel Analytics 設定状況](#9-vercel-analytics-設定状況)

---

## 1. 計測ソース一覧

| ソース | 用途 | 取得場所 |
|---|---|---|
| **Vercel Analytics** (Web Vitals) | LCP / FID / CLS / INP を Real User Monitoring で収集 | Vercel Dashboard → Analytics → Web Vitals |
| **Vercel Speed Insights** | ページごとの p75 スコア | Vercel Dashboard → Speed Insights |
| **Sentry** | JS エラー件数 / エラーレート / 未捕捉例外 | Sentry Dashboard → Issues |
| **Lighthouse (手動)** | 実機相当スロットルでのスナップショット計測 | Chrome DevTools → Lighthouse (Mobile preset) |
| **Chrome DevTools Performance** | タブ切替・ナビゲーション時間の手動計測 | DevTools → Performance タブ |

---

## 2. Core Web Vitals — ページ別

### 計測対象ページ

| ページ | パス | 優先度 |
|---|---|---|
| ランディング | `/` | High |
| ホーム | `/home` | High |
| 探す | `/explore` | High |
| 式場詳細 | `/venues/[id]` | High |
| 候補一覧 | `/candidates` | High |
| 横比較 | `/candidates/compare` | Medium |
| コーチ | `/coach` | Medium |

### メトリクス定義

| 指標 | 目標値（予算） | 測定単位 | 計測方法 |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | < 1.5s | p75, 秒 | Vercel Analytics / Lighthouse |
| **FID** (First Input Delay) | < 50ms | p75, ms | Vercel Analytics |
| **CLS** (Cumulative Layout Shift) | < 0.05 | スコア | Vercel Analytics / Lighthouse |
| **INP** (Interaction to Next Paint) | < 200ms | p75, ms | Vercel Analytics |

> ベースライン推定値の出典: `docs/myreview/ui-ux-remediation-plan.md` §5.7 パフォーマンス予算

---

## 3. タブ切替体感時間

タブバー（ホーム / 探す / 候補 / コーチ）のタップから描画完了までの時間。

| 計測方法 | 手順 |
|---|---|
| Chrome DevTools Performance | タップ直前から `Paint` イベントまでの duration を計測 |
| 実機確認 | iPhone 12 相当 + 3G throttle でスクロールが止まらないことを目視確認 |

| 指標 | 目標値 |
|---|---|
| タブ切替 p75 | < 500ms |

---

## 4. Server Action レイテンシ

主要 Server Action の p95 を Vercel Function Logs から収集する。

| Server Action | ファイル | 目標 p95 |
|---|---|---|
| `getHomeData` | `src/server/actions/home.ts` | < 800ms |
| `getFavorites` | `src/server/actions/favorites.ts` | < 600ms |
| `getVenues` | `src/server/actions/venues.ts` | < 600ms |
| `saveDirectRatings` | `src/server/actions/ratings.ts` | < 1000ms |
| `getMatrixData` | `src/server/actions/compare.ts` | < 1000ms |

> Vercel Dashboard → Functions → 対象の function name でフィルタリングして p95 Duration を確認。

---

## 5. エラーレート

| 指標 | 目標値 | 計測ソース |
|---|---|---|
| Sentry エラー件数（週次） | < 10 件 | Sentry → Issues → This Week |
| 未捕捉例外（JS） | 0 件 | Sentry → Issues → Unhandled |
| Server Action エラー率 | < 1% | Sentry → Performance |
| HTTP 5xx 率 | < 0.1% | Vercel Analytics → Errors |

---

## 6. バンドルサイズ

| 対象 | 目標値 | 計測方法 |
|---|---|---|
| First Load JS (共通) | < 150 kB gzip | `npm run build` → `.next/build-manifest.json` |
| `/home` チャンク | < 80 kB gzip | `@next/bundle-analyzer` または build output |
| `/candidates/compare` チャンク | < 100 kB gzip | build output |

---

## 7. 記録フォーマット（スプレッドシート用）

各 Phase リリース後 48h 以内に以下の行を追記する。

```
| 計測日       | Phase | ページ       | LCP p75 | FID p75 | CLS   | INP p75 | Bundle JS | Tab切替 p75 | コメント        |
|-------------|-------|-------------|---------|---------|-------|---------|-----------|------------|----------------|
| YYYY-MM-DD  | 0     | /home       | 2.1s    | 80ms    | 0.08  | 280ms   | 160 kB    | 650ms      | Phase 0前ベースライン（推定）|
| YYYY-MM-DD  | 1     | /home       |         |         |       |         |           |            |                |
| YYYY-MM-DD  | 2     | /home       |         |         |       |         |           |            |                |
| YYYY-MM-DD  | 3     | /home       |         |         |       |         |           |            |                |
```

### ベースライン推定値（Phase 0 前、実計測前）

Phase 1 実装前の推定値。`ui-ux-remediation-plan.md` §5.7 の予算目標を「改善後目標」、その 1.5〜2 倍を「改善前推定」として記録する。

| Phase | LCP p75 | FID p75 | CLS   | INP p75 | Bundle JS | Tab切替 |
|-------|---------|---------|-------|---------|-----------|--------|
| 0前（推定）| ~2.0s | ~80ms | ~0.08 | ~280ms | ~160 kB  | ~650ms |
| 目標   | 1.5s   | 50ms   | 0.05  | 200ms  | 150 kB   | 500ms  |

---

## 8. 運用ルール

### 計測タイミング

1. **各 Phase リリース後 48h 以内** に一度計測し、記録フォーマットに追記する
2. **実機環境**（iPhone 12 相当 + Moto G Power 相当）で計測することを推奨
3. Lighthouse 計測は **3G throttle** (`Fast 3G` プリセット) で実行する

### Lighthouse 実行手順

```bash
# Chrome DevTools を開く
# DevTools → Lighthouse タブ → 設定:
#   Categories: Performance
#   Device: Mobile
#   Throttling: Simulated throttling (Fast 3G相当)
# "Analyze page load" を実行
# LCP / TBT / CLS を記録
```

### Vercel Analytics での確認手順

```
1. https://vercel.com/dashboard → プロジェクト選択
2. Analytics タブ → Web Vitals
3. 期間: 過去 7 日 / フィルタ: ページ別
4. p75 列の値を記録フォーマットに転記
```

### アラート基準

| 状態 | 基準 | アクション |
|---|---|---|
| **良好** | LCP < 1.5s / CLS < 0.05 / INP < 200ms | 継続監視 |
| **要注意** | LCP 1.5-2.5s / CLS 0.05-0.1 / INP 200-500ms | 次 Phase で優先対処 |
| **要即対応** | LCP > 2.5s / CLS > 0.1 / INP > 500ms | その Phase 内で修正 |

---

## 9. Vercel Analytics 設定状況

`src/app/layout.tsx` (2026-04-14 確認済み) に以下が含まれていることを確認:

```tsx
// line 5-6
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// line 115-116 (body 末尾)
<Analytics />
<SpeedInsights />
```

**状態: 設定済み** — `@vercel/analytics` と `@vercel/speed-insights` の両コンポーネントが root layout に組み込まれている。Vercel Dashboard で Web Vitals データが収集されている状態。

> PostHog も `PostHogProvider` として組み込まれており (`src/components/providers/posthog-provider.tsx`)、イベントトラッキングとセッションリプレイが併用可能。

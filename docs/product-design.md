# VenueLens Product Design Specification

> 3エージェントのデザインリサーチ（Awards/Trends、Mobile Patterns、Japanese Luxury）を統合したプロダクトデザイン仕様。実装時に必ず参照すること。

---

## Design Philosophy

**「上質な体験のキュレーション」** — 式場比較ツールではなく、人生の大切な決断を支えるプレミアム体験として設計する。

参考にすべきサービス:
- **Aman Tokyo** — 余白の贅沢さ、削ぎ落としの美学
- **Linear** — キビキビした操作感、1pxボーダーの洗練
- **Apple Liquid Glass** — 素材感のある透明度
- **Airbnb** — 写真ファーストのカードデザイン

---

## 1. Color System（改訂）

現行の oklch 値を維持しつつ、ネイビーの温度を上げ、ゴールドをくすませてプレミアム感を強化。

### Light Mode

| Token | Current | Revised | Rationale |
|-------|---------|---------|-----------|
| `--navy-deep` | — | `#0D1B2A` | 褐色寄りネイビー、冷たさ排除 |
| `--navy-mid` | — | `#1C2E45` | カード背景（ダークモード時） |
| `--gold-warm` | `#A16207` | `#C9A84C` | くすんだ暖系ゴールド、高級感 |
| `--gold-light` | — | `#E8C97A` | ホバー・ハイライト |
| `--gold-subtle` | — | `rgba(201,168,76,0.15)` | グラデーション用 |
| Background | `#F8FAFC` | `#FAFBFC` | わずかに温かみを追加 |
| Foreground | `#0F172A` | `#0D1B2A` | navy-deep と統一 |

**ゴールドの使い方の鉄則**: ボーダー・アイコン・アンダーライン・星評価の小面積のみ。背景色やボタン塗りには使わない。

### Dark Mode（Phase 5 で実装）

| Token | Value |
|-------|-------|
| Background | `#0D1B2A` (navy-deep) |
| Card | `#1C2E45` (navy-mid) |
| Foreground | `#F0F4F8` |
| Border | `rgba(201,168,76,0.2)` (gold subtle border) |

---

## 2. Typography（改訂）

### Heading Treatment — Luxury Style

```css
.heading-luxury {
  font-family: 'Noto Serif JP', serif;
  font-weight: 300; /* Light — NOT Bold for luxury */
  letter-spacing: 0.15em;
  line-height: 1.8;
}

.heading-section {
  font-family: 'Noto Serif JP', serif;
  font-weight: 400;
  letter-spacing: 0.1em;
  line-height: 1.6;
}
```

**Key change**: 見出しの font-weight を 700(Bold) → 300-400(Light-Regular) に変更。ラグジュアリーブランドは細い書体で格調を出す。

### Fluid Typography

```css
:root {
  --text-xs:  clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
  --text-sm:  clamp(0.875rem, 0.8rem + 0.3vw, 1rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg:  clamp(1.125rem, 1rem + 0.75vw, 1.375rem);
  --text-xl:  clamp(1.25rem, 1rem + 1.5vw, 2rem);
  --text-3xl: clamp(1.75rem, 1.25rem + 2.5vw, 3rem);
}
```

### Tabular Numbers

数値（価格、スコア、人数）には `font-variant-numeric: tabular-nums` を適用し、桁揃えする。

---

## 3. Card Design — Venue Cards

### Photo-First Card（Airbnb + Aman 融合）

```
┌──────────────────────────┐
│  [4:3 Photo]              │ ← aspect-ratio: 4/3
│  ┌─────────────────────┐ │
│  │ gradient overlay     │ │ ← from-transparent to-black/60
│  │  ★ 4.5  ❤           │ │ ← score + heart on overlay
│  └─────────────────────┘ │
├──────────────────────────┤
│  アニヴェルセル表参道       │ ← Noto Serif JP, 400, tracking
│  表参道 · 40〜120名        │ ← muted text
│  ¥380万〜                  │ ← gold-warm color
│  [調査中] [チャペル]       │ ← status + style tags
└──────────────────────────┘
```

### CSS Implementation

```css
.venue-card {
  border-radius: 16px;
  overflow: hidden;
  background: white;
  border: 1px solid rgba(0,0,0,0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.venue-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.12);
}

.venue-card__image {
  aspect-ratio: 4/3;
  width: 100%;
  object-fit: cover;
}

.venue-card__overlay {
  background: linear-gradient(transparent 40%, rgba(0,0,0,0.08) 70%, rgba(0,0,0,0.6) 100%);
  position: absolute;
  inset: 0;
}
```

### Framer Motion Animation

```tsx
<motion.div
  whileHover={{ y: -6, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
```

---

## 4. Glassmorphism — Limited Use

フィルターパネル、フローティングUI、比較オーバーレイにのみ使用。カード本体には使わない。

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
}
```

Tailwind: `bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl`

**パフォーマンス制限**: 同時に3〜5要素まで。

---

## 5. Shadow System — Premium Layering

フラットな単一シャドウではなく、多層シャドウで奥行きを表現。

```css
/* Level 1: Cards at rest */
--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06);

/* Level 2: Cards on hover */
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.1);

/* Level 3: Modals, bottom sheets */
--shadow-modal: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);

/* Gold glow (for selected/featured items only) */
--shadow-gold: 0 0 20px rgba(201,168,76,0.15);
```

---

## 6. Motion Design — Luxury Feel

### Spring Configuration

```typescript
// Standard (buttons, small elements)
const springStandard = { type: "spring", stiffness: 400, damping: 30 };

// Premium (cards, page transitions)
const springPremium = { type: "spring", stiffness: 300, damping: 25 };

// Slow luxury (hero sections, celebrations)
const springLuxury = { type: "spring", stiffness: 200, damping: 20 };

// Page enter
const enterTransition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] };
```

### Motion Principles
- 入る動き: ease-out-expo `[0.16, 1, 0.3, 1]`
- 出る動き: ease-in `[0.4, 0, 1, 1]`（入りより短く、70%の duration）
- カードホバー: `y: -6` + shadow intensify
- カードタップ: `scale: 0.98`（即時フィードバック）
- ページ遷移: fade + slide-up（`y: 20 → 0, opacity: 0 → 1`）
- `prefers-reduced-motion` 時: 全アニメーション無効化

---

## 7. Layout — Bento Grid for Venue List

### Desktop (4 columns)

```
┌─────────┬──────────┬──────────┐
│         │  Venue 2 │  Venue 3 │
│ Venue 1 │  (1x1)   │  (1x1)   │
│ (2x2)   ├──────────┼──────────┤
│ Hero     │  Venue 4 │  Venue 5 │
│         │  (1x1)   │  (1x1)   │
└─────────┴──────────┴──────────┘
```

### Mobile (2 columns)

```
┌────────────────────┐
│ Venue 1 (2x1 Hero) │
├─────────┬──────────┤
│ Venue 2 │ Venue 3  │
│ (1x1)   │ (1x1)    │
├─────────┼──────────┤
│ Venue 4 │ Venue 5  │
└─────────┴──────────┘
```

Hero card (最高スコアの式場) は `col-span-2 row-span-2` で大きく表示。

---

## 8. Comparison Page — Redesign

### Mobile Structure
1. **Venue selector chips** (top, horizontal scroll)
2. **Score overview** — horizontal progress bars (NOT radar chart as primary)
3. **Radar chart** — secondary, collapsible section
4. **Comparison table** — 2 columns max, sticky header + sticky left column
5. **Estimate bar chart** — horizontal grouped bars
6. **AI analysis card** — gold left border, inline

### Score Display: Progress Bars > Radar Chart

```
雰囲気       ████████████░░░  4.2
ホスピタリティ ██████████████░  4.8
料理         ██████████░░░░░  3.5
```

Progress bars are more scannable on mobile than radar charts. Show radar chart as a collapsible "詳細チャート" section.

---

## 9. Dashboard — Bento Layout

```
┌──────────┬──────────┬──────────┐
│ 見つけた  │ 印象記録 │ お気に入り │  ← stat cards
│ 式場 4   │  2/4    │    1     │
├──────────┴──────────┴──────────┤
│ [AI Insight Card - gold border] │  ← next action
│ "素敵な式場が見つかりましたね..."  │
├─────────────────────┬──────────┤
│ 式場を見つける        │ 比較する  │  ← quick actions
├─────────────────────┴──────────┤
│ Recent venues (compact list)    │
└────────────────────────────────┘
```

---

## 10. Gradient Border — Gold Accent

For featured or selected items:

```jsx
<div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-[#C9A84C]/60 via-transparent to-[#C9A84C]/60">
  <div className="bg-card rounded-2xl p-6">
    {/* content */}
  </div>
</div>
```

---

## Implementation Priority

| Priority | What | Impact | Effort |
|----------|------|--------|--------|
| 1 | **Venue card redesign** (photo-first, overlay, spring hover) | Massive visual upgrade | Medium |
| 2 | **Typography overhaul** (light weight headings, letter-spacing, fluid sizes) | Premium feel across all pages | Low |
| 3 | **Shadow system** (multi-layer, hover elevation) | Depth and polish | Low |
| 4 | **Dashboard bento layout** | Modern, information-dense | Medium |
| 5 | **Comparison: progress bars > radar as primary** | Mobile usability | Medium |
| 6 | **Motion design** (spring animations, page transitions) | "Feels expensive" | Medium |
| 7 | **Gold accent refinement** (gradient borders, subtle glow) | Luxury detail | Low |
| 8 | **Glassmorphism** (filter panel only) | Modern touch | Low |

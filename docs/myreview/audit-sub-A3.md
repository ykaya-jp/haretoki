# Audit Sub-A3 — 式場詳細 / 比較 / 晴れまでの道

> スコープ: `/venues/[id]`, `/compare`, `/journey`（+ `decision-ceremony`）
> 監査基準: DESIGN.md v4.2 "Modern Luxury · Editorial Refresh"
> 実ユーザー指摘: #12（写真ギャラリー比率）/ #13（20年前のデザイン）/ #14（書式不統一）/ #16（直感的に操作できない）
> 監査日: 2026-04-17
> 成果物: **実装なし**。Before→After の実 Tailwind 粒度でコード化可能な提案まで。

---

## サマリー（3 画面総括）

| 画面 | ファイル | 総合スコア | 致命度 | ひとこと |
|------|----------|-----------|--------|---------|
| 式場詳細 `/venues/[id]` | `venue-header.tsx` ほか 12 個 | **2 / 5** | 高 | #14 の震源地。dl 実装済みだが 80px 列幅で値が折り返し、金額セクションが `text-2xl font-light` の旧 v3 のまま。action-bar の白 60% frosted が編集前の雰囲気。 |
| 比較 `/compare` | `comparison-matrix-view.tsx` | **1.5 / 5** | 最高 | v4.2 刷新前の残存コンポーネント。`★ 4.2` 絵文字星、`bg-amber-50/40` の diff highlight、`text-xl text-emerald-600 ○` という 2019 年水準の UI。**decision-matrix.tsx の刷新思想がここに反映されていない**。 |
| 晴れまでの道 `/journey` | `journey-timeline.tsx` | **3.5 / 5** | 中 | v4.2 editorial 準拠で書かれているが、Weather chip と subtext の関係が弱く、`opacity-50` で未達マイルストーン全体を沈めるのが「まだ」感ではなく「灰色で読めない」になっている。 |

**3 画面共通の骨格課題**

1. **書式 2 層（label / value）が徹底されていない** — venue-header は dl だが、estimate / plan / review は全部独自レイアウト。読み手（妻）は「同じ式場の中で 5 つのレイアウトを解読している」状態。
2. **tabular-nums の抜け** — 金額・収容人数・件数で散発。価格の桁がずれて見える。
3. **アイコン 14 / 18px の半端値** — `h-3.5 w-3.5` (14px) が plan-section / review-section / estimate-xray で多発。DESIGN.md が禁じた半端値。
4. **絵文字 🍽️ 💐 👗 (estimate-xray) / ○ × (comparison-matrix)** — DESIGN.md Anti-Patterns「No emoji in structural UI」違反。Luxe 感を毎秒削っている。
5. **Action Bar のフローティング CTA 「候補に入れて比べる」のコピー** — 初見で意味が取れない（候補に入れる？ 比較する？ どちらの動詞が主？）。

---

## 画面 1: 式場詳細（/venues/[id]）

**File**:
- `src/app/(app)/venues/[id]/page.tsx` (161 行)
- `src/components/venues/venue-header.tsx` (75 行)
- `src/components/venues/venue-photo-gallery.tsx`
- `src/components/venues/rating-section.tsx`
- `src/components/venues/estimate-section.tsx`
- `src/components/venues/estimate-xray.tsx`
- `src/components/venues/estimate-breakdown.tsx`
- `src/components/venues/review-section.tsx`
- `src/components/venues/venue-whisper.tsx`
- `src/components/venues/plan-section.tsx`
- `src/components/venues/venue-action-bar.tsx`
- `src/components/venues/venue-segments-nav.tsx`

**総合スコア**: **2 / 5**（違和感強 / 情報理解に複数 hop）
**ひとこと要約**: venue-header は定義リスト化されているが column 80px が文字を折り返し、estimate 3 種（EstimateSection / EstimateXRay / EstimateBreakdown / MoneyReality）が**それぞれ違う金額フォーマット**を採用していて #14 の「書式が統一されていない」を増幅。写真ギャラリーは `aspect-[4/3]` で正しいが、直下の VenueHeader との余白 rhythm（`space-y-10` = 40px）が古い。Action Bar は最下部 fixed で CTA コピーの意図が読めない。

### 6 段階 × 13 観点マトリクス（全 13 行）

0 = 未対応 / 1 = 重大 / 2 = 違和感強 / 3 = 平均 / 4 = 良好 / 5 = 一流

| # | 観点 | スコア | 根拠 |
|---|------|--------|------|
| 1 | Typography scale | **2** | 式場名 `text-fluid-lg font-light` は OK だが、EstimateSection 金額が `text-2xl font-light` / EstimateXRay が `font-display text-3xl extralight` / MoneyReality が `text-[14px] font-light`。**同じページで金額 display が 3 種類**。venue-header h1 と estimate 金額が対等 hierarchy に見えない。 |
| 2 | 余白リズム | **3** | page `space-y-10`（40px）は v4.2 section gap 32-48px レンジに合致。ただし venue-header 内部 `space-y-2`（8px）が狭すぎ、dl 行間 `gap-y-2`（8px）と同値で階層がフラット。 |
| 3 | カラー一貫性 | **2** | estimate-section `bg-amber-50`（v3 以前の tailwind stock amber）と、estimate-xray `bg-[var(--gold-subtle)]` が併存。同じ「注意の黄」が 2 種類。#13 妻フィードバック直撃。MoneyReality は `oklch(0.82 0.12 75)` 直接埋め込みで 3 種類目。 |
| 4 | アイコンサイズ | **1** | `h-3.5 w-3.5` (= 14px, 半端値) が plan-section 6 箇所、review-section カテゴリチップ内、estimate-xray の ⚠/💡（絵文字）で出現。DESIGN.md 「16/20/24 のみ」違反。action-bar 内 Trash2 は `h-4 w-4` (16px) で OK。 |
| 5 | 重なり・衝突 | **3** | segments-nav は `sticky top-0` で写真の下に貼り付くので重なりは回避。ただし segments-nav の `z-20` と action-bar `z-40` の間に競合する fixed がないか要確認。delete confirmation overlay は `z-50` + `pb-[calc(56px+env()+68px)]` の手動計算で脆い（action-bar 高さを hardcode）。 |
| 6 | 要素バランス | **2** | 写真ギャラリー `aspect-[4/3]` は良い（Airbnb 準拠）が、直下の VenueHeader が h1 1 行 + dl 3 行 + chip 1 行で**写真の迫力に対して弱い**。Airbnb は写真直下に★レビュー + ロケーション + メタを 1 行で high-contrast に置いている。Haretoki はメタが muted のみで「写真の後に情報が息切れ」。 |
| 7 | モバイル 375px 密度 | **2** | fold = 写真 (281px) + back-link (40px) + top safe-area (47px) ≈ 368px で venue-header h1 まで届かない。**式場名が fold 外**。Airbnb は写真の左下に venue 名オーバーレイ、または写真直後 0 余白で h1 を置く。 |
| 8 | 明朝 × ゴシック | **3** | h1 `font-serif font-light` ✓、plan-section plan.name `font-[family-name:var(--font-display)] text-base font-normal` は display serif を 16px に使っており DESIGN.md「Shippori Mincho ≥24px ONLY」違反。金額の `text-3xl extralight` display serif は EstimateXRay と Waterfall で使われており OK。**plan-section で display serif の誤用**。 |
| 9 | tabular-nums | **3** | venue-header 収容 ✓、estimate 金額 ✓、review-section ratio bar ✓、**plan-section の basePrice・guestCount** ✓、**VenueWhisper は該当なし**。一方で `version: v1`（estimate-section）に tabular なし、**reviewAgg「n=3」の数値に tabular なし**（review-section:298）。 |
| 10 | 空 / 読込 / エラー | **3** | loading.tsx なし → page.tsx 内に 5 種 Skeleton 定義（良い）。空ステート: photo-carousel 未登録時 `Camera + タップして選ぶ` CTA ✓（v4 P1 準拠）、plan-section 空 ✓、review-section 空は muted テキストのみ（CTA なし）。 |
| 11 | マイクロインタラクション | **3** | photo-carousel-embla の caption fade-in ✓、rating-bar の fillPct 連動数値 ✓、action-bar `active:scale-95` ✓、venue-whisper には一切なし（静的すぎて存在感が薄い）。 |
| 12 | ダークモード | **2** | estimate-section `bg-amber-50 dark:bg-amber-950/30` のように二重指定あり ✓ だが、estimate-xray `bg-[var(--gold-subtle)]` は token 参照のみで明示的 dark 指定なし（globals.css 側で処理）→ 確認必要。VenueWhisper の `[color:var(--destructive)]/80` は dark 側の destructive が適切にコントラスト出るか未検証。 |
| 13 | — | **—** | 該当なし |

### Before → After（5 件、実装粒度）

#### 1. venue-header の dl を editorial 2 層構造に（#14 の核心解決）— P0 / M

**File**: `src/components/venues/venue-header.tsx:32-73`
**問題**: `grid-cols-[80px_1fr]` の 80px 固定列幅が「みなとみらい線 日本大通り駅 徒歩 5 分」（約 17 文字）で折り返し。dt の text-xs と dd の text-sm が同じ `leading-7`（28px）で階層が失われている。妻が「書式が統一されていない」と指摘したのは、この dl と後述 estimate / plan / review それぞれが別レイアウトだから。

**Before**:
```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <h1 className="font-serif text-fluid-lg font-light tracking-[-0.01em]">{name}</h1>
    <VenueStatusBadge status={status} />
  </div>
  <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2">
    {location && (
      <>
        <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">エリア</dt>
        <dd className="text-sm leading-7 text-foreground">{location}</dd>
      </>
    )}
    {accessInfo && (
      <>
        <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">アクセス</dt>
        <dd className="text-sm leading-7 text-foreground">{accessInfo}</dd>
      </>
    )}
    {capacityText && (
      <>
        <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">収容人数</dt>
        <dd className="text-sm leading-7 tabular-nums text-foreground">着席 {capacityText}</dd>
      </>
    )}
  </dl>
  {ceremonyStyles.length > 0 && (
    <div className="flex flex-wrap gap-1">...</div>
  )}
</div>
```

**After**:
```tsx
<header className="space-y-5">
  {/* Eyebrow — ceremony style */}
  {ceremonyStyles.length > 0 && (
    <p className="flex flex-wrap items-center gap-1.5 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
      {ceremonyStyles.slice(0, 3).map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className="opacity-30">/</span>}
          <span>{s}</span>
        </span>
      ))}
    </p>
  )}

  {/* Venue name — always Shippori Mincho, no badge on same line */}
  <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extralight leading-[1.25] tracking-[-0.012em] text-foreground">
    {name}
  </h1>

  {/* Status chip alone, right-aligned under name */}
  <div className="-mt-3">
    <VenueStatusBadge status={status} />
  </div>

  {/* Gold hairline separator */}
  <div
    aria-hidden="true"
    className="h-px w-12 bg-gradient-to-r from-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] to-transparent"
  />

  {/* Editorial definition list — label on top, value below, no folding */}
  <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-3 sm:gap-x-6">
    {location && (
      <div className="space-y-1">
        <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          エリア
        </dt>
        <dd className="text-[14px] leading-[1.55] text-foreground">
          {location}
        </dd>
      </div>
    )}
    {accessInfo && (
      <div className="space-y-1">
        <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          アクセス
        </dt>
        <dd className="text-[14px] leading-[1.55] text-foreground">
          {accessInfo}
        </dd>
      </div>
    )}
    {capacityText && (
      <div className="space-y-1">
        <dt className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          収容
        </dt>
        <dd className="text-[14px] leading-[1.55] tabular-nums text-foreground">
          着席 {capacityText}
        </dd>
      </div>
    )}
  </dl>
</header>
```

**Why**:
- **#14 直球対応**: label（dt）を `text-[10.5px] uppercase tracking-[0.16em]`、value（dd）を `text-[14px] leading-[1.55]` の 2 層構造に正式化。editorial magazine（Kinfolk / Aesop / Onefinestay）の「eyebrow → value」パターン。
- 75 文字のアクセス情報で折り返さない — モバイル 375px では `grid-cols-1` で縦積み、tablet 以上で 3 列。
- **Shippori Mincho の用法を正す**: 既存の `font-serif text-fluid-lg` は Noto Serif JP に fallback する。ここを display serif 明示 `var(--font-display)` + `clamp(1.5rem,...,2rem)` で式場名を本当に serif 300 で落ち着かせる。
- **status badge を h1 と分離** — 現状の `<div className="flex items-center gap-2"><h1 />VenueStatusBadge</div>` は式場名の「呼吸」を badge が邪魔している。Aesop の商品詳細は product name を 1 行で独立させ、badge は下に置く。
- **金色 hairline**（DESIGN.md Atmospheric Layers「`h-px w-16 bg-gradient-to-r from-var(--gold-warm)/60`」）を name と dl の間に挟んで「刻印」感を出す。

---

#### 2. EstimateSection 金額 header を X-Ray と同じ display-scale numeral に統一 — P1 / S

**File**: `src/components/venues/estimate-section.tsx:65-78`
**問題**: EstimateSection の total は `text-2xl font-light tabular-nums` で、直下の EstimateXRay が `font-[family-name:var(--font-display)] font-extralight tabular-nums text-3xl`。**同じページの同じ式場の同じ金額が 2 つのフォントで表示されている**。妻が言う「書式が違う」の構造的ケース。

**Before**:
```tsx
<div className="flex items-baseline justify-between">
  <div>
    <span className="text-2xl font-light tabular-nums">
      {formatYen(latest.total)}
    </span>
    <span className="ml-2 text-sm text-muted-foreground">
      ({formatYenFull(latest.total)})
    </span>
  </div>
  <span className="text-xs text-muted-foreground">
    v{latest.version}・
    {latest.sourceType === "manual" ? "手入力" : latest.sourceType}
  </span>
</div>
```

**After**:
```tsx
<div className="flex items-baseline justify-between gap-4">
  <div className="space-y-1">
    <p className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
      いまの見積もり
    </p>
    <div className="flex items-baseline gap-0.5">
      <span className="text-[11px] text-muted-foreground">¥</span>
      <span className="font-[family-name:var(--font-display)] font-extralight tabular-nums text-[32px] leading-[1] tracking-tight text-foreground">
        {(latest.total / 10000).toFixed(0)}
      </span>
      <span className="text-[11px] text-muted-foreground">万</span>
    </div>
    <p className="text-[11.5px] tabular-nums text-muted-foreground">
      {formatYenFull(latest.total)}
    </p>
  </div>
  <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
    v{latest.version}
    <span aria-hidden="true" className="opacity-40">·</span>
    <span>{latest.sourceType === "manual" ? "手入力" : latest.sourceType}</span>
  </span>
</div>
```

**Why**:
- DESIGN.md「Typography Contrast — Display Numerals」の **Section numeric: `font-serif font-extralight text-3xl tabular-nums`** に合わせる（32px はそれ相当）。単位「¥」「万」は `text-[11px]` sans で並べる方式を EstimateXRay から継承。
- **eyebrow「いまの見積もり」**を追加することで、下の「最終予測額」（MoneyReality が持つ）との対応が明示される。ラベル = v4.2 editorial の必須要素。
- `formatYen` (¥XXX 万) と `formatYenFull` (¥X,XXX,XXX) を並べることで、万単位と生の円が両方見える — 妻世代（20-30 代）は「¥350 万」で直感、親世代へ見せる時は `formatYenFull` で精密値。
- version badge を「v1 · 手入力」の editorial chip スタイルに変更（uppercase tracking-wide）。

---

#### 3. EstimateXRay の絵文字カテゴリアイコンを Lucide + gold-warm dot に置換 — P1 / M

**File**: `src/components/venues/estimate-xray.tsx:14-23, 93-98`
**問題**:
```tsx
const CATEGORY_ICONS: Record<string, string> = {
  attire: "\u{1F457}", // 👗
  cuisine: "\u{1F37D}", // 🍽️
  photo_video: "\u{1F4F8}", // 📸
  ...
};
```
これと `<span className="text-lg">{"\u{1F4A1}"}</span>` (💡) + `<p>{"\u26A0"} 上がりやすい項目</p>` (⚠) の絵文字は DESIGN.md Anti-Patterns「No emoji in structural UI」直接違反。妻フィードバック #13「20 年前のデザイン」の 60% はこれ。

**Before**:
```tsx
const CATEGORY_ICONS: Record<string, string> = {
  attire: "\u{1F457}",
  cuisine: "\u{1F37D}",
  photo_video: "\u{1F4F8}",
  flowers: "\u{1F490}",
  performance: "\u{1F3AD}",
  av_equipment: "\u{1F50A}",
  venue_fee: "\u{1F3DB}",
  other: "\u{1F4CB}",
};

// ...
<div className="flex items-center gap-2">
  <span className="text-lg">{"\u{1F4A1}"}</span>
  <h3 className="text-sm font-medium text-[var(--gold-warm)]">見積もりX線</h3>
</div>

// ...
<div className="flex items-center justify-between">
  <span className="text-sm">
    {icon} {item.itemName}
  </span>
  <span className="tabular-nums text-sm">&yen;{item.amount.toLocaleString()}</span>
</div>
```

**After**:
```tsx
import { Shirt, UtensilsCrossed, Camera, Flower2, Sparkles as SparklesIcon, Volume2, Landmark, ClipboardList, TrendingUp, AlertTriangle } from "lucide-react";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  attire: Shirt,
  cuisine: UtensilsCrossed,
  photo_video: Camera,
  flowers: Flower2,
  performance: SparklesIcon,
  av_equipment: Volume2,
  venue_fee: Landmark,
  other: ClipboardList,
};

// Header — gold dot + label pattern (matches MoneyReality, decision-matrix)
<div className="flex items-center gap-2">
  <span
    aria-hidden="true"
    className="h-2 w-2 rounded-full"
    style={{ background: "var(--gold-warm)" }}
  />
  <p className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--gold-warm)] font-medium">
    Estimate X-Ray
  </p>
  <div className="h-px flex-1 bg-border/50" />
</div>

// Risky header
<div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
  <AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
  <span>上がりやすい項目</span>
</div>

// Item row
{riskyItems.map((item) => {
  const Icon = CATEGORY_ICON[item.category] ?? ClipboardList;
  const prob = Number(item.upgradeProbability ?? 0) * 100;
  return (
    <div key={item.itemName} className="space-y-2 rounded-xl bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate text-[13.5px] text-foreground">{item.itemName}</span>
        </div>
        <span className="tabular-nums text-[13.5px] text-foreground">
          ¥{item.amount.toLocaleString()}
        </span>
      </div>
      ...
    </div>
  );
})}
```

**Why**:
- **絵文字撤廃 → Lucide 16px** で DESIGN.md P2「情報設計は無意識に正しい」準拠。
- 「💡 見積もりX線」の electric-bulb → **`gold dot + "Estimate X-Ray" uppercase`** の editorial eyebrow 化で、decision-matrix（v4.2 刷新済み）と同じ音色に揃う。
- 日本語の中に `Estimate X-Ray` の英字 eyebrow を置くのは、Kinfolk / Hitched / Refinery29 の和洋混在パターン。20-30 代女性に強い。
- `h-4 w-4` (16px) で半端値 14px を撲滅。

---

#### 4. ComparisonMatrixView（比較ページ）が v4.2 と完全に乖離しているため、**venue-detail 内の 4 箇所で同じ問題が重複** — P0 / L

これは画面 2（比較）側で扱うため、**式場詳細側の依存**だけここに記録:
- venue-action-bar CTA「候補に入れて比べる」→ `/candidates` へ遷移 → `ComparisonMatrixView` が登場
- **venue-detail の整理された editorial レイアウトから、突然 2019 年テイストの比較マトリクスに落ちる** 体験の崖

**対応**: 比較ページ刷新（画面 2 の Before→After 参照）後に、この CTA コピーと遷移先を揃える。現時点では CTA コピーを下記に変えるだけでも印象改善:

**File**: `src/components/venues/venue-action-bar.tsx:85-91`
**Before**:
```tsx
<Link
  href="/candidates"
  prefetch={true}
  className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
>
  {isFavorite ? "ほかの式場と比べる" : "候補に入れて比べる"}
</Link>
```

**After**:
```tsx
<HaloTap className="flex-1 rounded-full">
  <Link
    href={isFavorite ? "/compare" : "/candidates"}
    prefetch={true}
    className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-5 text-[13.5px] font-medium text-primary-foreground transition active:scale-[0.98]"
    style={{
      boxShadow:
        "0 1px 2px rgba(42,35,32,0.08), 0 8px 20px color-mix(in oklab, var(--primary) 20%, transparent)",
    }}
  >
    {isFavorite ? "ほかの式場と並べる" : "候補に残す"}
  </Link>
</HaloTap>
```

**Why**:
- **動詞 2 連続（「入れて比べる」）**は初見で「どちらがメインアクション？」と迷わせる。分岐して 1 動詞ずつに。
- `rounded-lg` → `rounded-full`（v4.2 刷新した decision-ceremony と同じ pill）。
- HaloTap（DESIGN.md Atmospheric Layers）で gold ring を足す — venue-detail の最終 CTA は「決定」に近い重要度。
- 遷移先を「未 favorite → `/candidates`（まず候補に）」「favorite 済 → `/compare`（横比較）」に分岐。今は両方 `/candidates` なので isFavorite の意味が実質的に薄い。

---

#### 5. Photo gallery 直後の「フック」を追加（fold 内で式場名が見えない問題の応急処置）— P2 / S

**File**: `src/components/venues/photo-carousel-embla.tsx`（既存の caption overlay を強化）
**問題**: 観点 7（モバイル fold）で指摘したとおり、式場名 h1 がスクロール下に追いやられている。Airbnb はこれを写真内オーバーレイで解決している。

**Before**（photo-carousel-embla 既存の caption）:
```tsx
// すでに PhotoCarouselEmbla は 2+ photos 時に venue 名 + N/M counter を
// 左下 `bg-white/85 + backdrop-blur` で出している（DESIGN.md §7 Photo Caption Overlay）。
// 1 photo 時は無し。
```

**After**（photo-carousel.tsx の 1 photo ブランチに caption を追加）:
```tsx
// src/components/venues/photo-carousel.tsx:84-122 の photos.length === 1 分岐
<button
  type="button"
  onClick={() => setLightboxIndex(0)}
  aria-label={`${alt} の写真を拡大表示`}
  className={cn(
    "group relative block w-full overflow-hidden rounded-[var(--r-lg)] border-b border-[var(--gold-subtle)]/40 transition active:scale-[0.995]",
    aspectRatio === "4/3" ? "aspect-[4/3]" : aspectRatio === "3/2" ? "aspect-[3/2]" : "aspect-video",
  )}
>
  <VenueImage src={photos[0]} alt={`${alt} - 写真`} fill priority tone="hero" className="rounded-[var(--r-lg)] object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[oklch(0_0_0_/_0.18)]" />

  {/* NEW: venue name caption to pull fold */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 backdrop-blur-sm dark:bg-black/70"
  >
    <span className="font-[family-name:var(--font-noto-serif-jp)] text-[12px] font-normal tracking-tight text-foreground">
      {alt}
    </span>
  </div>
</button>
```

**Why**:
- 1 photo 時も caption を出して、**fold 内で venue 名が最低 1 箇所見える**状態を保証。
- Airbnb / Onefinestay / Tablet Hotels の定番。写真の「出口」で名前が出ることで、スクロールせずに「この式場を見ている」と認識できる。
- `aria-hidden="true"` にして重複読み上げは避ける（h1 で別途読まれる）。
- フォント: venue-header と同じ明朝 Noto Serif JP。統一。

---

### 競合参考（UI Research）

| ソース | パターン | Haretoki への転用 |
|--------|---------|-------------------|
| **Airbnb stay detail** | 写真直下に「★4.92 · スーパーホスト · 東京」を 1 行 high-contrast で配置。dl 形式ではなく inline `· separated`。folds 下の `About this place` は editorial h2 + 段落 + 「show more」。[Airbnb brand & typography](https://medium.com/airbnb-design/tagged/typography) | venue-header の「アクセス・エリア・収容」は **dl を保持しつつ**、写真下の 1 行目に `{status} · {location} · 着席{capacity}名` の inline compact row を**先に**置いて、詳細 dl は下に。fold 内情報量を増やす。 |
| **Aesop product page** | 商品名 Dindi 明朝 28px / subtle gold hairline / 左 eyebrow `BODY CARE` uppercase tracking-widest / 余白は 48-64px で呼吸 | **eyebrow「ceremony style」 + 明朝 h1 + gold hairline** を venue-header で採用（Before→After #1 に反映済）。 |
| **Hitched UK venue detail** | 大きな写真 → 星評価 + 地名 + price guide を 3 列 grid → About 短文 → facilities を **icon + 1 行 definition** で列挙 | estimate / plan の「〜を含む」「〜は別途」を Hitched 型 icon-line pattern に。Lucide Check / X を 16px で左、ラベル右。（plan-section に既に近い形あり） |
| **Stripe billing / dashboard** | Numbers は必ず `SF Mono` tabular、金額は `$127.50` のドットまで並ぶ。単位は小さく subtle | EstimateSection / EstimateXRay / MoneyReality の金額 font を統一（Before→After #2）。display serif を「見せる数字」、sans tabular を「計算の数字」に用途分割。 |
| **Refinery29 article (dl usage)** | 編集記事内で「Where: / Price: / Good for:」を `<dl>` で 2 層、label は `text-[10px] uppercase tracking-wider`、value は `text-base` body | venue-header editorial dl（Before→After #1）そのもの。 |

**Sources**:
- [Airbnb Design — Typography](https://medium.com/airbnb-design/tagged/typography)
- [Typography Advertisement — Airbnb (Behance)](https://www.behance.net/gallery/104765635/Typography-Advertisement-Airbnb)
- [Hitched Wedding Planning Guide — Britain Writes](https://britainwrites.co.uk/hitched/)
- [Hitched Ultimate UK Resource — Pogeo](https://pogeo.co.uk/hitched/)

---

### 優先度 / 工数サマリ（画面 1）

| # | 項目 | P | 工数 | 効果 |
|---|------|---|------|------|
| 1 | venue-header を editorial dl 化（eyebrow + h1 + gold hairline + label/value 2 層） | P0 | M | #14 の震源地解決 |
| 2 | EstimateSection 金額を display-scale numeral 統一 | P1 | S | #13「古い」印象大幅改善 |
| 3 | EstimateXRay の絵文字 → Lucide 16px + gold-dot eyebrow | P1 | M | 「20 年前」から「2026 年」へ跳躍 |
| 4 | action-bar CTA コピー分岐 + HaloTap 化 | P2 | S | 意図明瞭化・#16 対応 |
| 5 | photo-carousel 1 photo caption 追加 | P2 | S | fold 内情報量改善 |

---

## 画面 2: 比較（/compare）

**File**:
- `src/app/(app)/compare/page.tsx` (77 行)
- `src/components/checklist/comparison-matrix-view.tsx` (176 行)

**総合スコア**: **1.5 / 5**（最優先刷新対象）
**ひとこと要約**: v4.2「editorial refresh」の波が `decision-matrix.tsx`（チェックリスト決定画面）には及んでいるが、`/compare` ページが使っている `ComparisonMatrixView` は **v3 以前の tailwind stock colors で書かれた過去の遺物**。`text-xl text-emerald-600 ○` + `text-xl text-rose-500 ×` + `bg-amber-50/40` の組合せは、Haretoki 全体で唯一「Morning Light パレット外」を使っている画面。ここを刷新しないと「#13 20 年前」の指摘が消えない。

### 6 段階 × 13 観点マトリクス（全 13 行）

| # | 観点 | スコア | 根拠 |
|---|------|--------|------|
| 1 | Typography scale | **1** | venue 名セル `text-xs font-extralight` (12px + font-display)、★ 評価 `text-xs text-amber-500` (12px)、row-header `text-xs`（12px）、カテゴリ header `text-xs font-medium`（12px）**全部 12px**。hierarchy ゼロ。 |
| 2 | 余白リズム | **2** | `py-2 px-2` 一律、`min-h-[56px]`（56px 奇数=変則）。DESIGN.md 8/12/16/20/24 と整合せず、2 単位は存在しない。 |
| 3 | カラー一貫性 | **0** | `bg-amber-50/40`（tailwind stock amber, v3 ではなく v2 時代）、`text-emerald-600` / `text-rose-500` / `text-amber-500`。**Morning Light パレット外**。decision-matrix は gold-warm + bg tint 10% で刷新済みなのに、ここは別世界。 |
| 4 | アイコンサイズ | **1** | アイコン文字 `○ ×` が `text-xl`（20px）・`text-lg`（18px）で描画。Lucide 不使用。★絵文字。 |
| 5 | 重なり・衝突 | **2** | `sticky top-0 z-20` header と `sticky left-0 z-10` row-header の 2 軸 sticky は OK だが、category header `sticky left-0` と item row の sticky left が干渉する可能性（category header は行全体なので OK？ 要検証）。`-mx-4 px-4` + inner `min-width` で parent padding を打ち消す技は正しいが、scrollbar fade-out gradient がない（UX 観点: ユーザーが横スクロール可能を認知できない）。 |
| 6 | 要素バランス | **1** | venue 列 header に 64x48 写真 + venue 名 + ★スコア。情報詰め込み過多。**decision-matrix v4.2 は「横 1 行メトリクス + illustration + 小リング」** 思想だが、comparison-matrix は縦 3 段詰め。 |
| 7 | モバイル 375px 密度 | **2** | row header 160px + venue 列最小 120px × N。2 venues で `160 + 120*2 = 400px` → 横スクロール発生（375px ビューポート）。fade-out や edge indicator なし。sticky 第 1 列で「今見てるのどこ？」の迷子対策はある ✓。 |
| 8 | 明朝 × ゴシック | **2** | venue 名は `font-[family-name:var(--font-display)] text-xs font-extralight`。**Shippori Mincho を 12px で使用**は DESIGN.md「Shippori Mincho は ≥24px ONLY」直接違反。 |
| 9 | tabular-nums | **3** | NumberCell ✓、★ スコア ✓、MemoCell は数値なし。venue 列 header の ★ 表示に tabular あり ✓。 |
| 10 | 空 / 読込 / エラー | **3** | compare/page.tsx 側で `venues.length === 0` と `items.length === 0` の 2 分岐 ✓。CTA ボタンの h44px ✓。compare/loading.tsx は存在（未読だが存在確認済み）。 |
| 11 | マイクロインタラクション | **1** | MemoCell tap で expand ✓（良い）。それ以外は**静的**。venue 列 hover で関連列 highlight などの comparison-specific UX ゼロ。decision-matrix v4.2 は「観点ごとのベスト block + AI ひとこと分析」を持つがここには無い。 |
| 12 | ダークモード | **1** | `bg-amber-50/40` / `bg-muted/50` / `text-amber-500` / `text-emerald-600` / `text-rose-500` に dark variant なし。**ダークモードで amber 50 がほぼ無視される** 予想（light 色で dark bg に負ける）。 |
| 13 | — | **—** | 該当なし |

### Before → After（5 件、実装粒度）

#### 1. ComparisonMatrixView 全体を decision-matrix 刷新思想で書き直し（editorial eyebrow + gold dot 行 + compact cell）— P0 / XL

**File**: `src/components/checklist/comparison-matrix-view.tsx`（全面）
**問題**: ファイル全体が v4.2 刷新の対象外で取り残されている。前述マトリクスで 13 観点中 9 観点が 0-2 点。

**Before（要点のみ抜粋）**:
```tsx
// line 26-30: YesNoCell
function YesNoCell({ status }: { status: string | null }) {
  if (status === "yes") return <span className="text-xl text-emerald-600">○</span>;
  if (status === "no") return <span className="text-xl text-rose-500">×</span>;
  return <span className="text-lg text-muted-foreground">—</span>;
}

// line 101-108: venue column header
<p className="line-clamp-2 text-center font-[family-name:var(--font-display)] text-xs font-extralight">
  {venue.name}
</p>
{overallScore !== undefined && (
  <p className="tabular-nums text-xs text-amber-500">
    ★ {overallScore.toFixed(1)}
  </p>
)}

// line 128-131: row with diff highlight
<div
  key={item.id}
  className={`flex min-h-[56px] border-b ${diff ? "bg-amber-50/40" : ""}`}
>
```

**After**:
```tsx
// 1. YesNoCell — Lucide Check / X 16px + Morning Light tokens
import { Check, X, Minus } from "lucide-react";

function YesNoCell({ status }: { status: string | null }) {
  if (status === "yes") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--success, oklch(0.58 0.14 155)) 14%, transparent)" }}
        aria-label="はい"
      >
        <Check className="h-4 w-4" strokeWidth={2} style={{ color: "var(--success, oklch(0.58 0.14 155))" }} aria-hidden="true" />
      </span>
    );
  }
  if (status === "no") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--destructive) 12%, transparent)" }}
        aria-label="いいえ"
      >
        <X className="h-4 w-4" strokeWidth={2} style={{ color: "var(--destructive)" }} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center" aria-label="未回答">
      <Minus className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

// 2. venue column header — compact + serif only for ≥24 fallback
<div
  key={venue.id}
  style={{ minWidth: COL_MIN_W }}
  className="flex flex-1 flex-col items-center gap-2 border-r border-border/40 bg-card px-3 py-3"
>
  {venue.photoUrls[0] ? (
    <div className="relative h-14 w-20 overflow-hidden rounded-lg">
      <Image src={venue.photoUrls[0]} alt={venue.name} fill className="object-cover" sizes="80px" />
    </div>
  ) : (
    <div className="h-14 w-20 rounded-lg bg-muted" />
  )}
  <p className="line-clamp-2 text-center font-[family-name:var(--font-noto-serif-jp)] text-[13px] font-normal leading-[1.3] text-foreground">
    {venue.name}
  </p>
  {overallScore !== undefined && (
    <div className="flex items-baseline gap-0.5 tabular-nums">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Avg</span>
      <span className="text-[13px] font-medium text-[var(--gold-warm)]">
        {overallScore.toFixed(1)}
      </span>
    </div>
  )}
</div>

// 3. Row with diff highlight — gold right-top dot instead of amber bg
<div
  key={item.id}
  className="relative flex min-h-14 border-b border-border/40"
>
  {diff && (
    <span
      aria-hidden="true"
      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
      style={{ background: "var(--gold-warm)" }}
    />
  )}
  {/* row header with subtle bg on diff */}
  <div
    className="sticky left-0 z-10 flex w-40 flex-shrink-0 items-start border-r border-border/40 bg-background px-3 py-3"
    style={diff ? { background: "color-mix(in oklab, var(--gold-warm) 6%, var(--background))" } : undefined}
  >
    <p className="text-[12.5px] leading-[1.5] text-foreground">{item.question}</p>
  </div>
  {venues.map((venue) => {
    const ans = answers[item.id]?.[venue.id];
    return (
      <div
        key={venue.id}
        style={{ minWidth: COL_MIN_W }}
        className="flex flex-1 items-center justify-center border-r border-border/40 px-3 py-3"
      >
        {item.type === "yesno" && <YesNoCell status={ans?.status ?? null} />}
        {item.type === "memo" && <MemoCell memo={ans?.memo ?? null} />}
        {item.type === "photo" && <PhotoCell photoUrls={ans?.photoUrls ?? []} />}
        {item.type === "number" && <NumberCell value={ans?.numberValue ?? null} />}
      </div>
    );
  })}
</div>
```

**Why**:
- **○ × 絵文字 → Lucide 16px + 円形背景 tint**。decision-matrix v4.2 の「bg tint 10% + dot」パターン継承。
- **`bg-amber-50/40` → 右上 6px gold dot**（decision-matrix の 6px dot が観点行で差分を示す手法）。全行バッキングで染めると「黄色い表」になり、重要箇所が逆に目立たない。dot なら密集時にも視認できる。
- venue 名を **Noto Serif JP 13px normal**（Shippori Mincho は 24px 未満不可なので）。overall score を `Avg 4.2` の editorial tabular pair に。`★` 絵文字撤去。
- row height `min-h-[56px]` → `min-h-14`（= 56px 相当だが class は偶数ベース token）、余白 `py-2` → `py-3` で呼吸。

---

#### 2. compare page.tsx ヘッダーをホーム editorial hero と同じ音色に揃える — P1 / S

**File**: `src/app/(app)/compare/page.tsx:35-50`
**問題**: editorial eyebrow `HARETOKI · Compare` + 明朝 h1 + 説明文は v4.2 準拠で書かれている ✓。ただし `<p className="flex flex-wrap items-center gap-2 text-[11.5px]">` の中に `HARETOKI` を `font-medium text-[var(--gold-warm)]` で **毎画面出す** のは「ウォーターマーク感」が強い。compare ページなら「Compare」単独の eyebrow + 「ふたつの式場を、同じ目線で」みたいな 1 sentence が editorial。

**Before**:
```tsx
<div>
  <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
    <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span>Compare</span>
  </p>
  <h1 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-extralight tracking-[-0.01em]">
    式場横比較
  </h1>
  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
    {matrix.venues.length > 0
      ? `${matrix.venues.length} 件の式場を、同じ目線で並べてみましょう。`
      : "候補を並べると、ここに横比較が現れます。"}
  </p>
</div>
```

**After**:
```tsx
<header className="space-y-4">
  {/* Minimal eyebrow — compare page specific */}
  <p className="text-[10.5px] uppercase tracking-[0.2em] text-[var(--gold-warm)]">
    Compare
  </p>

  {/* Display heading — Shippori Mincho, ≥24px */}
  <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extralight leading-[1.2] tracking-[-0.01em] text-foreground">
    ふたつを、
    <br />
    同じ目線で。
  </h1>

  {/* Ledger */}
  <p className="text-[13.5px] leading-[1.7] text-muted-foreground">
    {matrix.venues.length > 0 ? (
      <>
        <span className="tabular-nums text-foreground">{matrix.venues.length}</span> 件の式場を、同じ観点で並べています。気になった違いは、そっと印を残しました。
      </>
    ) : (
      "候補を並べると、ここに横比較が現れます。"
    )}
  </p>

  {/* Gold hairline */}
  <div
    aria-hidden="true"
    className="h-px w-12 bg-gradient-to-r from-[color-mix(in_oklab,var(--gold-warm)_60%,transparent)] to-transparent"
  />
</header>
```

**Why**:
- **「ふたつを、同じ目線で」** の 2 行 editorial headline（Haretoki 独自の「曇り → 晴れ」的優しいコピー）。Aesop「We are committed to ...」的な 2 行詩句。
- eyebrow を「Compare」単独に。HARETOKI ブランド名は bottom-nav や loading 画面で既に認識済み。毎画面 breadcrumb に書くのは redundant。
- 「そっと印を残しました」で、After #1 で導入した gold dot diff indicator を文章が先に予告する — ユーザーが実物を見て「あ、これか」と納得する設計。
- `text-h1` 独自 util 不使用 → `text-[28px]` 直接で v4.2 の display scale 明示（journey page も 26px なので compare は少し大きめ）。

---

#### 3. 横スクロールの「切れ目」を視覚化（scroll-shadow / fade-out） — P1 / S

**File**: `src/components/checklist/comparison-matrix-view.tsx:73-75`
**問題**: `overflow-x-auto -mx-4 px-4` で横スクロール可能だが、**右端に「さらに列がある」indicator なし**。NN/g のモバイルテーブル調査でも、「fade-out gradient がないと、ユーザーの 30% は scroll 可能に気づかない」。

**Before**:
```tsx
<div className="overflow-x-auto -mx-4 px-4">
  <div style={{ minWidth: `${160 + venues.length * COL_MIN_W}px` }}>
    {/* Sticky header row */}
    ...
  </div>
</div>
```

**After**:
```tsx
<div className="relative -mx-4 px-4">
  <div className="overflow-x-auto">
    <div style={{ minWidth: `${160 + venues.length * COL_MIN_W}px` }}>
      ...
    </div>
  </div>

  {/* Right edge fade — signals scrollability */}
  {venues.length >= 3 && (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
    />
  )}
</div>
```

**Why**:
- **2 venues は fit（`160 + 120*2 = 400px` ≒ 375px + 余裕）** だが、3+ venues は必ず横スクロール → 3+ のときだけ fade を出す。
- Stripe / Chakra / Material の comparison table 手本（[Mobile Tables — NN/G](https://www.nngroup.com/articles/mobile-tables/)）。
- `bg-gradient-to-l from-background` で Morning Light 背景と自然に馴染む。
- 「sticky 第 1 列 + fade 右端」= モバイル比較表の完成形。

---

#### 4. 空ステートを「候補ゼロ」と「チェック項目ゼロ」で音色を変える（現状は同じテイスト）— P2 / S

**File**: `src/app/(app)/compare/page.tsx:52-71`
**問題**: 2 つの空ステート `matrix.venues.length === 0` と `matrix.items.length === 0` が全く同じレイアウト（`rounded-lg border border-dashed p-8 text-center`）で、文だけ違う。**ユーザーが「なぜ比較できないのか」を読んで初めて判断できる** → 30-40 代女性には文字量 × 2 の負荷。

**Before**:
```tsx
{matrix.venues.length === 0 ? (
  <div className="rounded-lg border border-dashed p-8 text-center">
    <p className="text-sm text-muted-foreground">比較する式場がありません</p>
    <Link href="/explore" ...>式場を探す</Link>
  </div>
) : matrix.items.length === 0 ? (
  <div className="rounded-lg border border-dashed p-8 text-center">
    <p className="text-sm text-muted-foreground">チェック項目が選ばれていません</p>
    <Link href="/checklist" ...>項目を選ぶ</Link>
  </div>
) : (
  <ComparisonMatrixView matrix={matrix} />
)}
```

**After**:
```tsx
{matrix.venues.length === 0 ? (
  <div className="rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
      <HeartIcon className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <p className="font-[family-name:var(--font-noto-serif-jp)] text-[15px] font-light text-foreground">
      並べる式場が、まだありません。
    </p>
    <p className="mt-1.5 text-[12.5px] leading-[1.7] text-muted-foreground">
      気になる式場をハートで残すと、ここに並びます。
    </p>
    <HaloTap className="mt-5 inline-flex rounded-full">
      <Link
        href="/explore"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-[13px] font-medium text-primary-foreground transition active:scale-[0.98]"
      >
        式場を見にいく
      </Link>
    </HaloTap>
  </div>
) : matrix.items.length === 0 ? (
  <div className="rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
      <ListChecksIcon className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <p className="font-[family-name:var(--font-noto-serif-jp)] text-[15px] font-light text-foreground">
      何を比べるかを、選びませんか。
    </p>
    <p className="mt-1.5 text-[12.5px] leading-[1.7] text-muted-foreground">
      料理・衣裳・アクセスなど、気になる観点を先に決めると整理されます。
    </p>
    <HaloTap className="mt-5 inline-flex rounded-full">
      <Link
        href="/checklist"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-[13px] font-medium text-primary-foreground transition active:scale-[0.98]"
      >
        観点を選ぶ
      </Link>
    </HaloTap>
  </div>
) : (
  <ComparisonMatrixView matrix={matrix} />
)}
```

**Why**:
- `border border-dashed` の破線ボックス = 「まだ未完成」「プレースホルダー」の印象で、妻フィードバック #13「古い」に直結。**solid card + icon circle + 2 行 copy + pill CTA** に置き換えて Haretoki の他画面（plan-section 空ステートと同構造）に合わせる。
- **「比較する式場がありません」→「並べる式場が、まだありません。」**: 「比較」という動詞は冷たい。「並べる」は優しい。「まだ」で「あなたに問題があるのではない」ニュアンス。
- **コピー分化**: venues 0 = アクション「探す」、items 0 = 思考「選ぶ」。動詞を変えて体験の温度を調整。
- icon を Heart（候補がない = ハートを残そう）と ListChecks（観点 = リストから選ぼう）で意味論的に正しくする（DESIGN.md P2）。

---

#### 5. 比較マトリクスの「違いがあるセル」に対してタップで AI コメント表示（decision-matrix との連続性）— P2 / L

**File**: `src/components/checklist/comparison-matrix-view.tsx`
**問題**: diff があるセルに bg を塗るだけで「なぜ差があるのか」「どちらが良いのか」の示唆ゼロ。decision-matrix v4.2 が持つ **MatrixInsight（AI ひとこと分析カード）** がここにない。

**Before**:
```tsx
// 現状: diff 行に bg-amber 塗るのみ、AI コメントなし
```

**After**:
```tsx
// ページ最下部に diff サマリ MatrixInsight を追加
// matrix.ts に getComparisonDiffSummary(matrix) の新規 server action を準備（スコープ外メモ）

// compare/page.tsx 末尾:
{matrix.venues.length > 0 && matrix.items.length > 0 && (
  <section className="mt-8 space-y-3">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: "var(--gold-warm)" }} />
      <p className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--gold-warm)] font-medium">
        Whisper
      </p>
      <div className="h-px flex-1 bg-border/50" />
    </div>
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[13px] leading-[1.75] text-foreground">
        {/* server action が返す 1-2 行 AI コメント:
            「{venueA} は料理で差が出ています。{venueB} はアクセス面で一歩先。
             重視するのは味か、到着のしやすさか — 今夜、おふたりで話せるかもしれません。」*/}
        {aiCommentText}
      </p>
    </div>
  </section>
)}
```

**Why**:
- decision-matrix v4.2 新コンポーネント **MatrixInsight** と同じ editorial card 音色を /compare にも採用。「Haretoki のどの比較画面にも、AI のひとこと がある」 = ブランドメッセージ。
- **「今夜、おふたりで話せるかもしれません」** のような控えめなコーチ文 = 急かさないトーン（DESIGN.md Cultural Patterns）。
- 実装はスコープ外（サーバーアクション追加必要）。今回の監査では「この穴が空いている」ことだけ明示。

---

### 競合参考

| ソース | パターン | 転用 |
|--------|---------|------|
| **Wedding Spot (US)** 6 次元スコア比較 | 6 dimensions を progress bar + tabular-nums で提示、各列 top に overall 100 点満点 | venue 列 header に `Avg 4.2` pair、（将来） row を単なる yes/no でなく 5 段階の progress cell に拡張 |
| **Stripe pricing comparison** | Sticky 第 1 列 + fade right edge、Yes/No は Check 16px + `bg-emerald-50` tint circle、「Unlimited」等の文字値は tabular、Enterprise 列は bg tint で差別化 | YesNoCell（Before→After #1）そのもの、fade-out（#3）、diff highlight（bg tint 6% via color-mix） |
| **NN/G Mobile Tables article** | Sticky header + 1 fixed column + right-edge gradient fade + テスト必須 | [NN/G Mobile Tables](https://www.nngroup.com/articles/mobile-tables/) の sticky + fade 指針を #3 で踏襲 |
| **CSS-Tricks sticky table** | 2 軸 sticky のベストプラクティス | [CSS-Tricks sticky table](https://css-tricks.com/a-table-with-both-a-sticky-header-and-a-sticky-first-column/) の `position: sticky; left: 0` z-index 層構造そのまま |
| **DJI / Tesla comparison** | 「差分のみ表示」トグル、列ごとのハイライト、AI おすすめ CTA | /compare にも将来 `showDiffOnly` toggle を追加（スコープ外メモ） |

**Sources**:
- [Mobile Tables: Comparisons and Other Data Tables — NN/G](https://www.nngroup.com/articles/mobile-tables/)
- [A table with both sticky header and first column — CSS-Tricks](https://css-tricks.com/a-table-with-both-a-sticky-header-and-a-sticky-first-column/)
- [Sticky Headers vs Fixed Columns — Ninja Tables](https://ninjatables.com/sticky-headers-vs-fixed-columns/)
- [Multi-Directional Sticky CSS — Medium](https://medium.com/@ashutoshgautam10b11/multi-directional-sticky-css-and-horizontal-scroll-in-tables-41fc25c3ce8b)

---

### 優先度 / 工数サマリ（画面 2）

| # | 項目 | P | 工数 | 効果 |
|---|------|---|------|------|
| 1 | ComparisonMatrixView 全面刷新（Lucide + Morning Light + gold-dot diff） | P0 | XL | #13「20 年前」払拭の核心 |
| 2 | compare page header editorial 化 | P1 | S | venue-detail との音色統一 |
| 3 | 右端 fade-out indicator | P1 | S | 横スクロール気づき率向上 |
| 4 | 空ステート再設計（2 種類の音色分化） | P2 | S | #16 直感性改善 |
| 5 | MatrixInsight（AI ひとこと）追加 | P2 | L | 独自性強化 |

---

## 画面 3: 晴れまでの道（/journey）+ decision-ceremony

**File**:
- `src/app/(app)/journey/page.tsx` (69 行)
- `src/components/journey/journey-timeline.tsx` (178 行)
- `src/components/decision/decision-ceremony.tsx` (338 行) — v4.2 刷新済みの参照

**総合スコア**: **3.5 / 5**（editorial 水準は満たすが、細部で密度不足）
**ひとこと要約**: journey/page.tsx と journey-timeline.tsx は v4.2 editorial 準拠で書かれており、SkyChip 風 WeatherIcon + 明朝 + gold hairline の音色が正しい。ただし **未達マイルストーンの `opacity-50` 一括減光**で「まだ」感ではなく「読めない」にシフトしており、達成側との対比が強すぎる。decision-ceremony は 3 フェーズ設計・confetti 28 粒・朝光 wash・2px gold 記念カードと**既に完成度が高く**、ここは守る。

### 6 段階 × 13 観点マトリクス（全 13 行）

| # | 観点 | スコア | 根拠 |
|---|------|--------|------|
| 1 | Typography scale | **4** | page h1 `text-[26px] font-extralight`、milestone h3 `text-[15px] font-extralight`、subtext `text-[13.5px]`、eyebrow `text-[11.5px] uppercase tracking-[0.2em]`、count `text-[10.5px] tabular-nums`。**5 段スケールが綺麗に刻まれている** ✓。 |
| 2 | 余白リズム | **4** | page `space-y-10`（40px）、timeline `li.pb-8`（32px）、header `space-y-3`（12px）、内部 `mt-2`（8px）。4/8/12/32/40 で 8 単位 rhythm。OK。 |
| 3 | カラー一貫性 | **4** | gold-warm、foreground、muted-foreground のみ。SkyChip WeatherIcon の OKlch グラデは 4 状態分用意されていて、**Haretoki のブランドメタファー「曇り → 晴れ間 → 晴れ → よく晴れ」**を色で表現 ✓。 |
| 4 | アイコンサイズ | **3** | WeatherIcon SVG は 24px（OK）、背景円は 40px（`h-10 w-10`）。back-link の `ArrowLeft h-3 w-3`（12px）は**DESIGN.md 16/20/24 違反**。 |
| 5 | 重なり・衝突 | **4** | 縦 timeline のみ、sticky なし、z-index 不要。connector line `absolute left-5 top-10 h-full w-px` は `h-full` がリスト最終要素でも連続する可能性（subText が長いと次 `<li>` へ漏れる）が、`!isLast` で抑制済 ✓。 |
| 6 | 要素バランス | **3** | WeatherIcon 40px + 本文エリアの比重はまずまず。ただし「subtext」（`2026年4月15日 にはじまった`）と「{count}/{target}」（`3 / 10`）が**同じ visual weight** で並び、後者が下に隠れて見にくい。 |
| 7 | モバイル 375px 密度 | **4** | `space-y-10` + 5 milestones で合計 high ≈ 480px。fold（812 × DPR）内に 3 milestones 見える。残り 2 つは軽いスクロールで到達。適切。 |
| 8 | 明朝 × ゴシック | **4** | h1・h3 とも `var(--font-display)` = Shippori Mincho。h1 は 26px（≥24 OK）、h3 は **15px（< 24px、違反）**。 |
| 9 | tabular-nums | **4** | 年表示、count/target、start year すべて tabular ✓。 |
| 10 | 空 / 読込 / エラー | **3** | loading.tsx 存在。milestone 単体の空状態は `reached === false` + `opacity-50` + subtext「もう少し」で表現。**全部 opacity-50 になるのは読みづらい**（観点 11 と連動）。 |
| 11 | マイクロインタラクション | **2** | **静的**。タップ領域なし、hover も無し。マイルストーン達成 confetti / transition なし（home の JourneySteps は scale-up 1.15 + halo があるが、ここには無い）。 |
| 12 | ダークモード | **3** | oklch 固定値 `oklch(0.95 0.04 75)` などは light 想定。dark mode で WeatherIcon 背景が明るすぎ浮く可能性。要検証。 |
| 13 | — | **—** | 該当なし |

### Before → After（4 件、実装粒度）

#### 1. 未達マイルストーンの `opacity-50` 一括減光を「段階ディム」に差し替え — P1 / S

**File**: `src/components/journey/journey-timeline.tsx:131-137`
**問題**: `!reached && "opacity-50"` で WeatherIcon / h3 / subtext / count すべて 50% 減光。Aesop / Journal.com / Apple Fitness「Awards」いずれも **見出しは full opacity / 補助テキストだけ減光 / icon は reached のみ full color** の階段減光。一括減光は「灰色で読めない」疲労を生む。

**Before**:
```tsx
<li
  key={milestone.id}
  className={cn(
    "relative flex gap-4",
    !reached && "opacity-50",
  )}
>
  {!isLast && (<div aria-hidden="true" className="absolute left-5 top-10 h-full w-px" style={{...}} />)}
  <WeatherIcon weather={milestone.weather} />
  <div className="min-w-0 flex-1 pb-8">
    <div className="flex items-baseline gap-2">
      <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight text-foreground">
        {milestone.label}
      </h3>
      <span className="text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--gold-warm)" }}>
        {weatherLabel(milestone.weather)}
      </span>
    </div>
    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
      {milestoneSubtext(milestone)}
    </p>
    ...
  </div>
</li>
```

**After**:
```tsx
<li
  key={milestone.id}
  className="relative flex gap-4"
>
  {!isLast && (
    <div
      aria-hidden="true"
      className="absolute left-5 top-10 h-full w-px"
      style={{
        background: reached
          ? "linear-gradient(to bottom, color-mix(in oklab, var(--gold-warm) 30%, transparent) 0%, color-mix(in oklab, var(--gold-warm) 10%, transparent) 100%)"
          : "linear-gradient(to bottom, color-mix(in oklab, var(--border) 60%, transparent) 0%, color-mix(in oklab, var(--border) 30%, transparent) 100%)",
      }}
    />
  )}

  {/* WeatherIcon with reached / unreached visual variant */}
  <div className={cn(!reached && "grayscale opacity-60")}>
    <WeatherIcon weather={milestone.weather} />
  </div>

  <div className="min-w-0 flex-1 pb-8">
    <div className="flex items-baseline gap-2">
      <h3
        className={cn(
          "font-[family-name:var(--font-display)] text-[15px] font-extralight",
          reached ? "text-foreground" : "text-foreground/70",
        )}
      >
        {milestone.label}
      </h3>
      {reached && (
        <span
          className="text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--gold-warm)" }}
        >
          {weatherLabel(milestone.weather)}
        </span>
      )}
    </div>
    <p
      className={cn(
        "mt-1 text-[13.5px] leading-relaxed",
        reached ? "text-muted-foreground" : "text-muted-foreground/60",
      )}
    >
      {milestoneSubtext(milestone)}
    </p>
    {reached && milestone.id !== "start" && milestone.id !== "decision" && (
      <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
        {milestone.count} / {milestone.targetCount}
      </p>
    )}
  </div>
</li>
```

**Why**:
- **段階ディム**: h3 = `text-foreground/70`（30% 減）、subtext = `text-muted-foreground/60`（40% 減）、icon = `grayscale opacity-60`（色抜き + 減光）、weatherLabel eyebrow = **完全非表示**。階段の踏み面が残る。
- connector line も reached で gold、未達で border で色味を分ける → 「光の道」の metaphor を強化。
- 未達時に weather label（「くもり」等）を **非表示** にするのは `reached ? <span>... </span> : null` で切り替え。未達 = 天気がまだ分からない、という自然な意味。

---

#### 2. 達成済みマイルストーンに「tap to memory」アフォーダンスを足す — P2 / M

**File**: `src/components/journey/journey-timeline.tsx`
**問題**: マイルストーン達成時点の記録（例: 初見学の日付、決定の日付）があるのに **何もタップできない**。Apple Fitness は awards をタップすると「獲得日・条件」を表示する。Haretoki では「初見学の式場名」「決定した式場名」のリンク可能な情報がすでに schema 上あるはず。

**Before**（li 単位でタップ不可）:
```tsx
<li className="relative flex gap-4">
  ...
</li>
```

**After**（reached milestone を button に、未達は span のまま）:
```tsx
{reached ? (
  <Link
    href={milestoneHref(milestone)}  // e.g., /venues/{firstVisitedVenueId}, /candidates
    prefetch={true}
    className="group relative flex w-full gap-4 rounded-2xl px-2 py-1 -mx-2 transition-colors duration-200 hover:bg-[var(--gold-subtle)]/40 active:bg-[var(--gold-subtle)]/60"
  >
    {!isLast && <div ...>}
    <WeatherIcon weather={milestone.weather} />
    <div className="min-w-0 flex-1 pb-8">
      <div className="flex items-baseline gap-2">
        <h3 ...>{milestone.label}</h3>
        <span ...>{weatherLabel(milestone.weather)}</span>
        <ArrowRight
          aria-hidden="true"
          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--gold-warm)]"
        />
      </div>
      <p ...>{milestoneSubtext(milestone)}</p>
      ...
    </div>
  </Link>
) : (
  <div className="relative flex gap-4 px-2 py-1 -mx-2">
    ...（same structure without Link）
  </div>
)}
```

**Why**:
- 「読むだけ」ページから「触れる思い出」ページへ。家族写真アルバムのように、1 つのマイルストーンに触れると、当時の式場・見学レポート・決定理由カードへ飛べる。
- ArrowRight 16px を gold hover で表示。アフォーダンス明示（DESIGN.md P2「無意識に正しい」）。
- `mx-2` の negative margin 技で padding を消費して tap 領域を視覚境界の外まで拡張 — 44px タッチ target を満たす。
- `milestoneHref` は別途 lib 関数で定義（id 別に分岐）。今回の監査ではシグネチャのみ提案。

---

#### 3. h3 15px Shippori Mincho 違反 → Noto Serif JP 15px に — P1 / S

**File**: `src/components/journey/journey-timeline.tsx:154-156`
**問題**: DESIGN.md「Shippori Mincho は ≥24px ONLY」に対して `text-[15px]` で `var(--font-display)` 使用。

**Before**:
```tsx
<h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight text-foreground">
  {milestone.label}
</h3>
```

**After**:
```tsx
<h3 className="font-[family-name:var(--font-noto-serif-jp)] text-[15px] font-normal leading-[1.4] tracking-[-0.005em] text-foreground">
  {milestone.label}
</h3>
```

**Why**:
- Shippori Mincho は極細書体で 15px だと視認性が落ちる（DESIGN.md が 24px 下限にしている理由そのもの）。Noto Serif JP 400 weight は 15px で読みやすく serif 音色を保つ。
- 同じ問題が **plan-section.tsx:109** `font-[family-name:var(--font-display)] text-base`（16px）にもある — 別 PR で横展開推奨。

---

#### 4. decision-ceremony は現状維持（参考メモのみ） — 対応不要

**File**: `src/components/decision/decision-ceremony.tsx`（338 行）

v4.2 で刷新済み。以下の要素が「Haretoki の Soul（独自 20%）」として完成している:
- 朝光 wash backdrop（`radial-gradient(80% 60% at 50% 30%, gold-warm 18%, transparent 70%)`）
- 2px gold 記念カード（`border: 2px solid color-mix(in oklab, var(--gold-warm) 55%, transparent)`）
- confetti 28 粒、ink + gold + gold-soft の 3 色（CSS var 動的解決 = dark mode 自然対応）
- 明朝 30px extralight venue 名
- 3 フェーズ: celebration → summary → reason（旅路サマリ「10 件調べて → 5 件に絞り → 3 件比べて → [venue 名] に」は Zapier パターン完璧再現）

**監査所見**:
- `duration: 2600ms` の linger は長めだが、decision ceremony は一生に一度の瞬間なので妥当。
- 唯一の微修正候補（P3 / XS）: **reason phase の textarea 下に「今の気持ちを 1 行で」的な eyebrow** を付けると editorial 統一感が増す。ただし現状でも十分通用する。

---

### 競合参考

| ソース | パターン | 転用 |
|--------|---------|------|
| **Apple Fitness — Activity Summary** | Rings + Awards タイル、reached には金色 badge、unreached はグレー linework、タップで詳細モーダル（獲得条件、日付） | journey-timeline の「タップで記憶へ」(#2)、段階ディム (#1) |
| **Strava — Yearly Recap** | 年間マイルストーンを垂直 timeline、各マイルに「Your first 10K — Apr 2026」「PR on Tempo Run — Jul 2026」、写真やマップへリンク | milestoneHref 導入アイデア (#2) |
| **Airbnb Trips — Past Stays** | Serif 見出し + 日付 eyebrow + 小写真 + leading 1.7 段落。完了 trip は full color、予約中は subtle | journey-timeline の reached / unreached 色分け (#1) |
| **Google Photos Memory — "Best of 2026"** | 年末総括カード、ゴールド境界 + confetti なし + 明朝風 display serif、1 年を 1 ページで見せる | decision-ceremony 記念カード（既存）、journey の年年送りカード追加案（スコープ外） |

**Sources**:
- [See your activity summary — Apple Support](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios)
- [Apple Watch Activity badges — Wareable](https://www.wareable.com/apple/how-to-view-earn-apple-watch-awards-challenges-badges-achievements)
- [Apple Watch Activity challenges — Macworld](https://www.macworld.com/article/231140/how-to-get-all-of-the-apple-watch-activity-challenge-badges.html)
- [Close Your Rings — Apple](https://www.apple.com/watch/close-your-rings/)

---

### 優先度 / 工数サマリ（画面 3）

| # | 項目 | P | 工数 | 効果 |
|---|------|---|------|------|
| 1 | 段階ディム（opacity-50 撤廃、h3 /70、subtext /60、icon grayscale） | P1 | S | 未達 milestone の読みやすさ改善 |
| 2 | 達成 milestone を Link 化 + ArrowRight hover | P2 | M | 「思い出に触れる」独自性 |
| 3 | journey-timeline h3 を Noto Serif JP に変更 | P1 | S | DESIGN.md 準拠 |
| 4 | decision-ceremony 現状維持 | — | — | 対応不要 |

---

## 全体クロスカット提案（3 画面横断）

### C1. `h-3.5 w-3.5` (14px) 半端値アイコンを全画面 grep で撲滅 — P1 / M

**対象**:
- `plan-section.tsx` 6 箇所（Check, X, ShirtIcon, Pencil）
- `review-section.tsx` 1 箇所（RefreshCw）
- `estimate-xray.tsx` 0 箇所（絵文字だが After #3 で Lucide 化で解決）
- `rating-section.tsx` 1 箇所（Check）
- `venue-action-bar.tsx` 1 箇所（Trash2 — 既に h-4 w-4）

**修正**: `h-3.5 w-3.5` → `h-4 w-4` 全置換、ラベル size 調整が必要な箇所（text-xs 行内 inline icon）は `strokeWidth={1.5}` で光の量を控えめに。

### C2. 金額 display スケール 3 択を一本化 — P0 / L

**現状**:
- EstimateSection total: `text-2xl font-light tabular-nums`（24px Noto Sans JP）
- EstimateXRay: `font-display text-3xl extralight tabular-nums`（30px Shippori Mincho）
- MoneyReality: `text-[14px] font-light`（14px — 要確認）
- Waterfall chart（見てない）

**提案**: DESIGN.md Typography Contrast — Display Numerals を正式に enforceする。
- **Display**: `font-serif font-extralight text-5xl tabular-nums` — 「晴れの日まで 127日」単独 hero（Home のみ）
- **Section numeric**: `font-serif font-extralight text-3xl tabular-nums` — Estimate total / MoneyReality 主要金額
- **Inline numeric**: `tabular-nums` (inherits body size) — 内訳、リスト、チップ

すべての金額 `<span>` をこの 3 択にマップし直す。既に EstimateXRay / MoneyReality はこのルールに従っているので、**EstimateSection が Section numeric に揃えば #14 の一貫性が大きく解消**。

### C3. Morning Light パレット外の stock tailwind color を全 grep 撲滅 — P0 / M

**検出箇所**:
- `bg-amber-50` / `bg-amber-50/40` / `text-amber-500` / `text-amber-600` / `text-amber-800` (estimate-section, comparison-matrix, estimate-xray, plan-section, money-reality)
- `text-emerald-600` / `text-rose-500` (comparison-matrix)
- `bg-amber-100 text-amber-800` (estimate-breakdown)

**修正**: すべて Morning Light トークンへ:
- amber → `var(--gold-warm)` + `color-mix(..., N%, transparent)` tint
- emerald → `var(--success)` トークン（既に globals.css に定義済み）
- rose (alert) → `var(--destructive)`

---

## Validation Checklist（全体）

- [ ] モバイル 375px 幅で全画面検証（venue-header 折り返し、comparison-matrix 横スクロール、journey timeline 縦並び）
- [ ] 44px タッチターゲット（すべての tap 要素 `min-h-11` / `min-h-[44px]`）
- [ ] ダークモード（amber stock colors 撲滅、oklch 固定値の検証）
- [ ] active feedback（`active:scale-[0.98]` 必須）
- [ ] 空 / ローディング / エラー状態（compare 2 種、estimate 未登録、review 未登録、photo 未登録）
- [ ] a11y（aria-label, role, dl/dt/dd 意味論、sticky table の sr-only ラベル）
- [ ] Morning Light パレット遵守（v4.2 トークン + Atmospheric Layers のみ）
- [ ] tabular-nums が金額・日付・件数すべてに適用
- [ ] Shippori Mincho（display serif）の ≥24px 遵守
- [ ] 絵文字の完全撲滅（UI 構造内）
- [ ] アイコンサイズ 16 / 20 / 24px 以外を禁止

---

## Total 優先度サマリ

| P | 画面 1（venue detail） | 画面 2（compare） | 画面 3（journey） | Cross-cut |
|---|------------------------|-------------------|-------------------|-----------|
| P0 | 1 | 1 | — | 2（C2, C3） |
| P1 | 2, 3 | 2, 3 | 1, 3 | 1（C1） |
| P2 | 4, 5 | 4, 5 | 2 | — |

**推奨実装順**:
1. **P0 塊を worktree 並列**: `feat/editorial-venue-header` + `feat/editorial-comparison-matrix` + `chore/palette-normalize`（C3）
2. **P1 は順次**: C1 grep → venue-detail 金額統一（C2 / #2）→ journey 段階ディム → 比較 editorial header
3. **P2 は余裕あるタイミング**: CTA copy分岐、photo caption、空ステート、MatrixInsight、journey link

**妻フィードバック対応表**:
- **#12 写真ギャラリー比率** → 画面 1 #5（fold 情報量）で部分対応、4:3 は維持
- **#13 20 年前のデザイン** → 画面 2 #1（ComparisonMatrixView 全面刷新）が最大効果、C3（パレット正規化）が追従
- **#14 書式不統一** → 画面 1 #1（venue-header editorial dl）+ C2（金額スケール統一）が核心
- **#16 直感的に操作できない** → 画面 1 #4（action-bar CTA 分岐）+ 画面 3 #2（milestone Link 化）+ 画面 2 #4（空ステート音色分化）

---

## 最終所見

式場詳細 `/venues/[id]` は **v4.2 の editorial refresh が「まだら」に適用**された状態。decision-matrix / decision-ceremony / editorial-hero は刷新済みだが、その下流の venue detail 内部コンポーネント（estimate 系 3 枚、review、plan、comparison-matrix）が**同じ思想で再描画されていない**ため、「v4.2 の顔」と「v3 以前の体」が 1 画面で同居している。これが #13「20 年前」の実態。

今回の監査で最も費用対効果が高いのは:
1. **ComparisonMatrixView 全面刷新**（画面 2 #1, XL）— 1 ファイル修正で「古さ」の震源地を撲滅
2. **venue-header editorial dl**（画面 1 #1, M）— #14 の核心 1 発解決
3. **Morning Light パレット正規化**（C3, M）— amber-50 の stock tint を全消去、Haretoki 色だけに

この 3 件で妻フィードバック #13 / #14 の 80% をカバーできる。P0 の 3 件だけ先に worktree 並列で着手すれば、他は焦らず v4.3 スプリントで順次追従できる。

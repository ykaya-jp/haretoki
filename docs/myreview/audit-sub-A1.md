# UI/UX Aesthetic Audit — Sub-A1 (4 screens)

> **監査者**: Product Designer (Claude Opus 4.7)
> **日付**: 2026-04-17
> **対象**: Haretoki 4 画面（ホーム / 探す / 候補 / 情景で決める）
> **基準**: DESIGN.md v4.2 "Modern Luxury · Editorial Refresh" + モバイル 375px ファースト
> **観点**: 13 点 × 6 段階スコア（5=ラグジュアリー / 4=洗練 / 3=合格 / 2=違和感 / 1=崩壊手前 / 0=未実装）

---

## 概要サマリ（4 画面の総合スコア）

| 画面 | 総合スコア | ひとこと要約 |
|------|:---:|---|
| ホーム | **3.4 / 5** | editorial-hero 本体は合格だが、周辺（DailyRitual metadata / RecentVenues カード / 直下リンク）の tier 差が急で「上品な出だし → 急に情報が粗くなる」落差が発生 |
| 探す | **2.3 / 5** | 写真 16:9 が薄い + 「条件」ゾーンに text-[10px]〜text-[14px] が 7 種混在 + AI Rec カード内のタイポが 4 tier も落差。#12 指摘の震源地 |
| 候補 | **2.6 / 5** | ヘッダは美しいが、CoupleGap の text-[10.5px]/[11.5px]/[13.5px] 混線 + duel への誘導カードが本文 CTA と同じ density でヒエラルキー不在 |
| 情景で決める (Duel) | **2.8 / 5** | 2 択コア体験にもかかわらず**式場写真を問い部分で見せていない**のが致命的。「情景」を語りながら写真ゼロで text のみ、結果画面に初めて 4:3 写真が出る順序逆転 |

**4 画面共通の構造的課題**
1. **オフグリッド値の氾濫** — 4px 単位から外れた `text-[10.5px]` `text-[11.5px]` `text-[12.5px]` `text-[13.5px]` `text-[14.5px]` `text-[15px]` `text-[17px]` `text-[19px]` `text-[20px]` `gap-1.5` `py-3.5` `space-y-1.5` `px-3.5` が editorial-hero 単体で 14 箇所検出。v4.2 が宣言する「4px spacing grid」「fluid type scale」から実装が剥がれている。
2. **アイコン 14px の蔓延** — `h-3.5 w-3.5` が 4 画面で計 6 箇所。DESIGN.md v4.2 は 16/20/24 のみ許可。
3. **text-xs 急降下** — editorial-hero の明朝 300 × text-fluid-3xl から次に来る metadata が text-[10.5px] 〜 text-[13px]、tier が 3-4 段も飛んでいる。読者（カップル）の目に「上品な雑誌のページをめくったら急にチラシになった」感触。
4. **カード写真比率の不一致** — VenueCard は 16/9、RecentVenues は 4/3、Duel 結果は 4/3。同じ「式場写真」を 1 セッション内で 3 比率出している。
5. **明朝と text-\[Npx\] 組み合わせ** — 式場名に serif を付けながら 13.5px / 15px など半端値に落としている箇所多数。明朝は 16px 以上で使う前提（DESIGN.md: Shippori は ≥24px）。

---

## 画面 1: ホーム（/home）

**File**: `src/app/(app)/home/page.tsx` + `src/components/home/{editorial-hero,daily-ritual,recent-venues}.tsx`
**総合スコア**: **3.4 / 5**（洗練手前）
**ひとこと要約**: EditorialHero の明朝見出し・gradient hairline・SkyChip・metrics block は DESIGN.md v4.2 通りに仕上がっているが、**DailyRitual の eyebrow が `text-[10.5px]`、見出しが `text-fluid-3xl`、その次の sub が `text-[13.5px]` と 3 段 tier を一気に落とす構造**が毎セクションで繰り返され、読後感が「美しい → 粗い」の往復になる。RecentVenues は写真上に名前を焼き込む扱い自体は良いが、次画面（探す）の VenueCard は写真の下にクリアな serif タイポで式場名を出す構造で、フォーマットが一貫していない。

### 6 段階 × 13 観点マトリクス

| 観点 | Score | 所見（1-2 行） |
|---|:---:|---|
| 1. Typography scale | 2 | editorial-hero 単体で `text-[10.5px]` `text-[12px]` `text-[13px]` `text-[13.5px]` `text-[11px]` `text-[17px]` `text-[22px]` `text-[11.5px]` が混在。fluid scale を使わず px 直打ちしており DESIGN.md v4.2 の `--text-fluid-*` token を無視。 |
| 2. 余白リズム | 3 | `space-y-10` / `mt-5` / `mt-6` / `mt-7` / `space-y-4` / `pb-2` が混在し、8px grid（4/8/12/16/20/24）から `mt-7` だけ外れる。許容だが鋭敏な読者には気づかれる。 |
| 3. カラー一貫性 | 5 | Rose = CTA、Gold = AI（eyebrow/stage label/metrics gradient）、背景 = cream で意味逆転なし。 |
| 4. アイコンサイズ | 2 | DailyRitual の `<ArrowRight className="h-3.5 w-3.5" />`（:83）、RecentVenues の `<Star className="h-3 w-3" />`（:75）が 16/20/24 外。 |
| 5. 重なり・衝突 | 5 | fixed 要素と hero の衝突なし、SkyChip と eyebrow の右側余白も十分。 |
| 6. 要素バランス | 3 | RecentVenues カード幅 `min-w-[280px]` + aspect-[4/3] photo 全面焼き込み → 1 枚が 375px 画面で ~75% 専有。カルーセルの「次が見える」余白が 20px しかなく密度感が強い。 |
| 7. モバイル 375px 密度 | 4 | hero + metrics は fold 内に収まる。DailyRitual を差し込むと fold を越えるが mb-2 の呼吸があるのでギリ OK。 |
| 8. 明朝 × ゴシック | 4 | 式場名・見出しは serif、本文は sans で統一。ただし RecentVenues の `<h3 ... text-base>` に `font-medium` を当てており（:83）v4.2 の「明朝は 300-400 weight のみ」から外れる。 |
| 9. tabular-nums | 4 | 進捗 %・カウンタは tabular-nums、DailyRitual の `{todayLabel}` も適用済。ただし RecentVenues のスコア `{avg.toFixed(1)}` は tabular-nums 付いているが親要素が `text-xs` で可読性低い。 |
| 10. 空/loading/error | 3 | EmptyState（RecentVenues 0 件）は "これから、ふたりの候補が集まっていきます" と招待状トーン OK。ただし Home に error.tsx 固有の装飾なく、loading.tsx 未確認。 |
| 11. マイクロインタル | 4 | editorial-hero の HaloTap + active:scale（:339）、RecentVenues の active:scale-[0.98]（:59）は v4.2 準拠。 |
| 12. ダークモード | 2 | RecentVenues の写真グラデーション `bg-gradient-to-t from-black/60`（:71）、スコアバッジ `bg-black/40`（:74）がハードコード、`dark:` バリアント無し。ライトモード前提で読めているだけ。 |
| 13. Landing 品質 | - | 該当なし |

### Before → After（5 件、実装粒度）

**1. 「晴れまでの道 →」単独リンクがページ中央に浮く、tier 不明** — 優先度 **P1** / 工数 **S**
- File: `src/app/(app)/home/page.tsx:88-96`
- Before:
  ```tsx
  <div className="text-center">
    <Link
      href="/journey"
      prefetch={false}
      className="inline-flex min-h-[44px] items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
    >
      晴れまでの道 →
    </Link>
  </div>
  ```
- After:
  ```tsx
  <div className="border-t border-border/40 pt-6 text-center">
    <Link
      href="/journey"
      prefetch={false}
      className="inline-flex min-h-11 items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
    >
      <span className="h-px w-6 bg-muted-foreground/40" aria-hidden="true" />
      Journey
      <span className="font-[family-name:var(--font-display)] normal-case tracking-normal text-[13px] text-foreground/80">
        晴れまでの道
      </span>
    </Link>
  </div>
  ```
- Why: 現状は「孤立した text-xs 矢印リンク」でページ構造上の役割不明。magazine の「Editor's Note」様の eyebrow + 明朝小タイトル + hairline border で「次章への案内」として格を与える。DailyRitual・EditorialHero に置かれている HARETOKI · Date の eyebrow と視覚言語が揃う。

**2. RecentVenues 写真内テキスト焼き込みを廃し、カード下に serif 名 + metadata 構造に** — P1 / M
- File: `src/components/home/recent-venues.tsx:61-90`
- Before (抜粋):
  ```tsx
  <div className="relative aspect-[4/3] w-full">
    <Image ... />
    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
      <Star className="h-3 w-3 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
      <span className="tabular-nums text-xs font-medium text-white">
        {avg.toFixed(1)}
      </span>
    </div>
    <div className="absolute inset-x-0 bottom-0 p-4">
      <h3 className="truncate font-[family-name:var(--font-display)] text-base font-medium tracking-[0.05em] text-white">
        {venue.name}
      </h3>
      {venue.location && (
        <p className="mt-0.5 text-xs text-white/80">{venue.location}</p>
      )}
    </div>
  </div>
  ```
- After:
  ```tsx
  <div className="relative aspect-[3/2] w-full overflow-hidden">
    <Image ... className="object-cover photo-tone" />
    {/* score as eyebrow-style floating pill, NOT dark-overlay */}
    {avg !== null && (
      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 backdrop-blur-md ring-1 ring-white/60 dark:bg-black/50 dark:ring-white/10">
        <Star className="h-4 w-4 fill-[var(--gold-warm)] text-[var(--gold-warm)]" strokeWidth={1.5} />
        <span className="tabular-nums text-[12px] font-medium text-foreground dark:text-white">
          {avg.toFixed(1)}
        </span>
      </div>
    )}
  </div>
  <div className="p-4 pb-5">
    <h3 className="truncate font-[family-name:var(--font-display)] text-[17px] font-extralight tracking-[0.02em] text-foreground">
      {venue.name}
    </h3>
    {venue.location && (
      <p className="mt-1 truncate text-[12px] text-muted-foreground">{venue.location}</p>
    )}
  </div>
  ```
- Why:
  1. Airbnb / Aesop / モダン luxury ホテルプロモの黄金フォーマット = 「写真は写真単体で語らせる → テキストは下に分ける」。現状の焼き込みはコントラスト担保のため `from-black/60` 黒ベタを敷いており、cream/rose/gold を基調とする Morning Light パレットと反目する「黒板的」な質感を生んでいる。
  2. 写真比率 4:3 → **3:2 に変更**（Airbnb の標準）。VenueCard（16:9）より背高で「記録媒体」感が出るため、ホームの「見た式場を振り返る」文脈に最適。
  3. dark mode 対応（`dark:bg-black/50`）を同時に入れる。

**3. DailyRitual eyebrow の `text-[10.5px]` → token 化された `text-eyebrow` ユーティリティへ** — P2 / S
- File: `src/components/home/daily-ritual.tsx:43-57`
- Before:
  ```tsx
  <p className="flex items-center gap-2 text-[10.5px] tracking-[0.16em] uppercase text-muted-foreground">
    <span className="tabular-nums">{todayLabel}</span>
    ...
    <span className="normal-case tracking-normal text-[12px]">
      {timeOfDayLabel}
    </span>
    ...
    <span className="normal-case tracking-normal text-[12px] text-[var(--gold-warm)]">
      {weatherLabel(ritual.weather)}
    </span>
  </p>
  ```
- After:
  ```tsx
  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-eyebrow text-muted-foreground">
    <span className="tabular-nums">{todayLabel}</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span className="normal-case tracking-normal text-[12px] text-foreground/80">
      {timeOfDayLabel}
    </span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span className="normal-case tracking-normal text-[12px] text-[var(--gold-warm)]">
      {weatherLabel(ritual.weather)}
    </span>
  </p>
  ```
- Why: globals.css に `text-eyebrow` ユーティリティが既に定義されている（:406-412）のに使われず `text-[10.5px] tracking-[0.16em] uppercase` を手書き。token を使うことで将来のグローバル調整が効く + 4 画面の eyebrow 共通化の出発点になる。v4.2 の「token 化」方針に合致。

**4. RecentVenues の「すべて →」矢印が text-[12px]、magazine マスト頭の tier と衝突** — P2 / XS
- File: `src/components/home/recent-venues.tsx:43-49`
- Before:
  ```tsx
  <Link
    href="/candidates?view=recent"
    prefetch={true}
    className="text-[12px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
  >
    すべて →
  </Link>
  ```
- After:
  ```tsx
  <Link
    href="/candidates?view=recent"
    prefetch={true}
    className="inline-flex min-h-11 items-center gap-1 text-[11px] tracking-[0.14em] uppercase text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
  >
    View all
    <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} />
  </Link>
  ```
- Why: 現状「すべて →」は text-[12px]、左に配置されている "Recent" masthead（eyebrow、`text-[11.5px] tracking-[0.2em] uppercase`）と tracking も大小もバラバラで「上品な媒体」ではなく「アプリの機能ボタン」の質感。**eyebrow スタイルで揃えて "View all" + ArrowUpRight（明確な 16px アイコン）**にすることで、NYT / FT / Cereal 誌スタイルの「節見出しと対の遷移リンク」になる。

**5. `recent-venues.tsx` の写真なしブランチ（photoUrls=0）の EmptyState が弱い** — P3 / S
- File: `src/components/home/recent-venues.tsx:92-97`
- Before:
  ```tsx
  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted rounded-t-xl">
    <Building2 className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.2} />
    <span className="text-xs text-muted-foreground/70">タップして詳細を見る</span>
  </div>
  ```
- After:
  ```tsx
  <div className="relative flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-t-2xl bg-gradient-to-br from-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))] to-[color-mix(in_oklab,var(--primary)_4%,var(--background))]">
    <Building2 className="h-8 w-8 text-[var(--gold-warm)]/50" strokeWidth={1} />
    <span className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
      写真はこれから
    </span>
  </div>
  ```
- Why: 灰色 `bg-muted` + text-xs の「タップして詳細を見る」は汎用アプリの EmptyState トーン。**Morning Light gradient + gold eyebrow コピー**で「写真がまだ無い」を「これから集まっていきますよ」という招待状的語り（DESIGN.md P1: "空ステートは招待状である"）に転換。

### 競合参考

- **The Knot Wedding Planner app** — 2025-09 導入の "Your Vendors" ハブ、カードは写真下にテキストを置き、写真とテキストを明確に分離。Haretoki RecentVenues は焼き込み→分離への移行が妥当。
- **Airbnb mobile（公式 UI kit）** — Cover photo は 16:9 推奨だが、Listing サムネイルは **3:2** 比率で object-fit: cover を使う実装が標準。RecentVenues（現 4:3）を 3:2 に揃えることは Airbnb 同等の比率。
- **Aesop mobile web** — editorial eyebrow（10-11px, 0.18em tracking, uppercase）+ 明朝見出し + 本文という 3 tier 構造を厳格に運用。Haretoki editorial-hero はこの構造を採用済みだが、周辺（DailyRitual / RecentVenues）に適用が漏れている。

### 優先度 / 工数 サマリ

- P0: 0 件
- P1: 2 件（Journey リンク tier / VenueCard 写真焼き込み廃止）
- P2: 2 件（DailyRitual eyebrow token 化 / View all 矢印リンク）
- P3: 1 件（EmptyState のブランド gradient 化）
- 合計工数: XS×1, S×3, M×1

---

## 画面 2: 探す（/explore）

**File**: `src/app/(app)/explore/page.tsx` + `src/components/explore/{explore-content,explore-add-venue,vibe-filter-chips}.tsx` + `src/components/venues/{venue-card,ai-recommendations,venue-search-bar}.tsx`
**総合スコア**: **2.3 / 5**（違和感強）
**ひとこと要約**: ユーザー #12「写真が小さすぎる」の震源地。VenueCard は 16/9 という**横長過ぎる比率**で、モバイル 375px で縦 160-170px しかなく式場の空間感が伝わらない。加えて「条件で絞り込み」ゾーンが `text-[10px]` `text-[10.5px]` `text-[11px]` `text-[11.5px]` `text-[12.5px]` `text-xs` の 6 tier が 170px の高さに詰め込まれている**情報圧縮地獄**。AIRecommendations カードは gold-subtle の意図は良いが、チップが `text-[10px]`、見出しが `text-xs`、本文が `text-sm`、式場名が `text-sm` と 4 tier が 40px の垂直幅に並び「フライヤー」感を生む。#13「20 年前のデザイン」が刺さるセクション。

### 6 段階 × 13 観点マトリクス

| 観点 | Score | 所見（1-2 行） |
|---|:---:|---|
| 1. Typography scale | 1 | 「条件で絞り込み」ゾーンに 6 tier、AIRec カードに 4 tier、VenueCard に `text-[10.5px]` / `text-[13px]` / `text-h2` / `text-eyebrow` / `text-meta` が共存。scale の秩序が完全崩壊。 |
| 2. 余白リズム | 2 | explore-content の `space-y-3.5` は 14px（半端）、AIRec の `space-y-2` / `space-y-3` 混在、VenueCard の `pt-5` / `pt-3` / `p-6` / `mt-4` が同居。 |
| 3. カラー一貫性 | 3 | gold = AI / rose = CTA は守られているが、Save Search Button の gold chip が `bg-[var(--gold-warm)]/15` text-[var(--gold-warm)]、vibe chips も同色 token、条件 chips も同色 → **gold だらけで AI の意味が希薄化**。 |
| 4. アイコンサイズ | 1 | AIRec の Sparkles `h-3.5 w-3.5`（:299）、RefreshCw `h-3.5 w-3.5`（:318）、VenueCard の Star `h-3.5 w-3.5`（:108）、Sparkles `h-3.5 w-3.5`（:145）、MapPin `h-3 w-3`（:535）、Plus/Loader2 `h-3 w-3`（:573-574）。16/20/24 を外れた値が 6 箇所。 |
| 5. 重なり・衝突 | 3 | VenueCard のスコアバッジが写真左下 `bottom-14`（:107）で、heart button（top-3）と干渉はないが、**左下スコア + 左上ステータスバッジ + 右上ハート + 右下「晴れの日」chip** が同時表示で写真隅 4 箇所全部バッジ。 |
| 6. 要素バランス | 1 | **VenueCard 16:9 写真は 375px 幅で縦 ~170px しかない**。式場の「空間感・雰囲気」を重視するユーザー体験で、写真より下のテキスト領域（fitReason + eyebrow + h2 + meta + tags = ~180px）の方が専有。本末転倒。 |
| 7. モバイル 375px 密度 | 2 | 「条件で絞り込み」ゾーンは 4 セクション縦積み（条件 / 雰囲気 / ステータス / filter sheet ボタン）で ~200px を消費。式場カード 1 枚（~350px）と並べると fold 内に 1 枚しか見えない。 |
| 8. 明朝 × ゴシック | 4 | VenueCard の h3（式場名）と AIRec の h4（式場名）に `font-[family-name:var(--font-display)]` が付与されている。ただし AIRec の式場名が `text-sm`（~14px）で serif を使うのは小さすぎて可読性低い（Shippori は ≥24px 推奨）。 |
| 9. tabular-nums | 3 | VenueCard の priceLabel は `tabular-nums`、AIRec の `¥{...}万〜` も `tabular-nums`。ただし condition chip の "50名前後" `{data.venueCount}件を参考` 部分に抜けあり。 |
| 10. 空/loading/error | 3 | 空「式場さがしは、ここから」は OK。ただし「該当する式場がありません」は text 2 行だけで画像なし、「条件に合う式場が見つかりません」の CTA が `rounded-full bg-primary` で 1 箇所だけ明示的 rose button 色、他 EmptyState と装飾が不統一。 |
| 11. マイクロインタル | 4 | VenueCard active:scale-[0.98] 有、AIRec RecommendationCard はアニメーションなく静的（改善余地）。 |
| 12. ダークモード | 2 | VenueCard photo 下の `from-black/45`（:96）ハードコード、AIRec の `bg-card/70` / `bg-muted` はトークン OK だが gold-subtle と dark mode 衝突可能性。 |
| 13. Landing 品質 | - | 該当なし |

### Before → After（5 件、実装粒度）

**1. VenueCard 写真比率 16:9 → 4:3 に戻す（#12「写真が小さい」の決定打）** — 優先度 **P0** / 工数 **S**
- File: `src/components/venues/venue-card.tsx:89-93`
- Before:
  ```tsx
  <PhotoCarousel
    photos={venue.photoUrls}
    alt={venue.name}
    aspectRatio="16/9"
  />
  ```
- After:
  ```tsx
  <PhotoCarousel
    photos={venue.photoUrls}
    alt={venue.name}
    aspectRatio="4/3"
  />
  ```
- Why:
  1. DESIGN.md Section 3 (Explore 式場カード仕様) に **「Photo ratio 4:3, 占有率 ~65% of card height」** と明記されている。現在の実装は設計書から剥離している。
  2. Airbnb 公式 UI kit の listing サムネイルは 3:2、Onefinestay / Mr & Mrs Smith (luxury hotel) は 4:3 が標準。式場は空間感が最大の訴求要素なので 4:3 で天井・奥行が映る方が伝わる。
  3. 375px 幅で 16:9 → 縦 211px、4:3 → 縦 281px。**写真が 70px 大きくなるだけでカード全体の印象が「チラシ」から「カタログ」に変わる**（#13 の 20 年前感への直接回答）。

**2. AIRecommendations カード見出し部分の tier 整理** — P1 / M
- File: `src/components/venues/ai-recommendations.tsx:293-306`
- Before:
  ```tsx
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold-warm)]/10">
        <Sparkles
          aria-hidden="true"
          className="h-3.5 w-3.5 text-[var(--gold-warm)]"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-xs font-medium tracking-[0.04em] uppercase text-[var(--gold-warm)]">
        AIおすすめ式場
      </h3>
    </div>
    ...
  </div>
  ```
- After:
  ```tsx
  <div className="flex items-start justify-between gap-2">
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gold-warm)]/12 ring-1 ring-[var(--gold-warm)]/25">
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.5}
        />
      </div>
      <div className="leading-tight">
        <p className="text-[10.5px] tracking-[0.18em] uppercase text-[var(--gold-warm)]/80">
          AI for you
        </p>
        <h3 className="font-[family-name:var(--font-noto-serif-jp)] text-[15px] font-light tracking-wide text-foreground">
          おすすめ式場
        </h3>
      </div>
    </div>
    ...
  </div>
  ```
- Why: 現状 `h-6 w-6` の丸 + `h-3.5 w-3.5` Sparkles は「小さすぎるラッパーに小さすぎるアイコン」で貧相。**32px ラッパー + 16px icon** にして v4.2 のアイコンサイズ規定に合わせる。見出しは eyebrow（英語）+ 明朝（日本語）の 2 段構造にして、後続の式場名と tier 差を作る（既存は AI 見出し = 式場名が同じ `text-xs` で区別不能）。

**3. 「条件で絞り込み」ゾーンの 6 tier text を整理** — P1 / M
- File: `src/components/explore/explore-content.tsx:152-198`
- Before（抜粋）:
  ```tsx
  <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-3.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium tracking-wide text-muted-foreground">条件で絞り込み</span>
      <span className="tabular-nums text-xs font-medium text-[var(--gold-warm)]">{filteredVenues.length}件</span>
    </div>
    {conditionChips && (
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/60">条件</p>
        {conditionChips}
      </div>
    )}
    {vibeChips && (
      <div className="space-y-1.5">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/60">雰囲気</p>
        <p className="text-[11px] text-muted-foreground mb-2">気になる雰囲気で絞り込む</p>
        {vibeChips}
      </div>
    )}
    <div className="space-y-1.5">
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground/60">ステータス</p>
      ...
    </div>
  </div>
  ```
- After:
  ```tsx
  <div className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-5">
    {/* Zone header — eyebrow style, not body text */}
    <div className="flex items-baseline justify-between border-b border-border/40 pb-3">
      <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
        Filter
      </p>
      <p className="tabular-nums text-[13px] font-medium text-foreground">
        <span className="text-[var(--gold-warm)]">{filteredVenues.length}</span>
        <span className="ml-0.5 text-[11px] text-muted-foreground">件</span>
      </p>
    </div>

    {/* Each subsection: eyebrow-style 11px label, single tier */}
    {conditionChips && (
      <div className="space-y-2">
        <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground/70">
          条件
        </p>
        {conditionChips}
      </div>
    )}
    {vibeChips && (
      <div className="space-y-2">
        <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground/70">
          雰囲気
        </p>
        {vibeChips}
      </div>
    )}
    <div className="space-y-2">
      <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground/70">
        ステータス
      </p>
      ...
    </div>
  </div>
  ```
- Why:
  1. 元は **6 tier**（text-xs / text-[10px] / text-[11px] / text-[11.5px] / text-[12.5px] / text-[13px]）。After は **2 tier のみ**（eyebrow 11px + 件数の 13px）に絞る。
  2. 「気になる雰囲気で絞り込む」という説明文（:180）は vibe チップ自体が絵文字付きで自明なため削除。
  3. `space-y-3.5` (14px) → `space-y-5` (20px) で 4px grid に戻す。subsection 間の呼吸も広がり「箱にすし詰め」感が消える。

**4. VenueCard 写真領域の 4 角バッジ集中 → 「score bar」方式に再配置** — P1 / M
- File: `src/components/venues/venue-card.tsx:100-134`
- Before: 左上 Status / 左下 Score / 右上 Heart / 右下「晴れの日」の 4 角全使用。
- After: 写真下に 1 行サブバー（score + status）を追加し、写真角は Heart（右上）+「晴れの日」（右下、決定時のみ）の 2 点に絞る。
  ```tsx
  {/* photo section — heart + (決定時のみ)晴れの日 chip のみ */}
  <div className="relative border-b border-[var(--gold-subtle)]/40">
    <PrefetchLink href={`/venues/${venue.id}`}>
      <PhotoCarousel photos={venue.photoUrls} alt={venue.name} aspectRatio="4/3" />
    </PrefetchLink>
    <div className="absolute right-3 top-3">
      <HeartButton venueId={venue.id} initialFavorite={isFavorite} />
    </div>
    {isDecided && (
      <div className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.12em] uppercase text-white backdrop-blur-sm" style={{...}}>
        晴れの日
      </div>
    )}
  </div>

  {/* meta bar — status + score in one horizontal row */}
  <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-3">
    <VenueStatusBadge status={venue.status} />
    {avgScore !== null && (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-[var(--gold-warm)] text-[var(--gold-warm)]" strokeWidth={1.5} />
        <span className="tabular-nums text-[13px] font-medium text-foreground">
          {avgScore.toFixed(1)}
        </span>
      </div>
    )}
  </div>
  ```
- Why: 現状はバッジ 4 角集中で「ゲーム UI」のような忙しさ。写真を 4:3 にして天井まで見せた上で、**スコアとステータスは写真の下に横ストリップで配置**することで Mr & Mrs Smith / Kinfolk 誌の「見出し＋認証ストリップ＋本文」の誌面構造になる。

**5. AIRec RecommendationCard の式場名を明朝 serif の格で** — P2 / S
- File: `src/components/venues/ai-recommendations.tsx:530-538`
- Before:
  ```tsx
  <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-1.5">
        <h4 className="font-[family-name:var(--font-display)] text-sm font-medium tracking-[0.03em]">{rec.name}</h4>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {rec.location}
        </div>
  ```
- After:
  ```tsx
  <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2">
        <h4 className="font-[family-name:var(--font-noto-serif-jp)] text-[17px] font-light tracking-[0.02em] leading-snug">
          {rec.name}
        </h4>
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <MapPin className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {rec.location}
        </div>
  ```
- Why:
  1. 元の `text-sm` serif + `font-medium` は「明朝で太字」という v4.2 禁忌（"font-weight 300-400 のみ"）。
  2. 17px まで上げ font-extralight 寄りの `font-light` に置換、serif を Shippori（display）でなく Noto Serif JP（body serif）に切替。DESIGN.md の「Shippori は ≥24px ONLY」ルールに準拠。
  3. `rounded-xl` → `rounded-2xl`、`p-4` → `p-5`、`h-3` icon → `h-4`、`gap-1` → `gap-1.5`。4px grid に揃え、全体の "ふくらみ" を作る。

### 競合参考

- **Airbnb Experiences mobile** — リスティングカードは listing photo 3:2 + 写真**外**に text block。Haretoki VenueCard の 16:9 は Airbnb の cover photo 比率（検索結果用）と混同している。listing card は 3:2 or 4:3 が業界標準。
- **Wedding Spot（米）** — side-by-side 比較を旗印にしており、カードは写真が 65-70% 占有、下に「per-person breakdown」の数字が入る構造。Haretoki の「Price eyebrow + 式場名 + location · capacity」3 行構造は方向性は同じ。
- **Aesop / Le Labo モバイルサイト** — filter zone は eyebrow 11px + 本文の 2 tier のみで統一。Haretoki explore の 6 tier は「EC っぽさ」ではなく「行政フォーム」の質感を生んでいる。

### 優先度 / 工数 サマリ

- P0: 1 件（VenueCard 写真 4:3 化）
- P1: 3 件（AIRec 見出し整理 / 条件ゾーン tier 整理 / バッジ分離）
- P2: 1 件（RecommendationCard 明朝格上げ）
- 合計工数: S×2, M×3

---

## 画面 3: 候補（/candidates）

**File**: `src/app/(app)/candidates/page.tsx` + `src/components/candidates/{candidates-view,couple-gap-section}.tsx`
**総合スコア**: **2.6 / 5**（違和感中〜強）
**ひとこと要約**: ページヘッダ（HARETOKI · Candidates + 明朝 h1 + tagline + gradient hairline）は v4.2 editorial の格で合格（score 4）。が、その下に来る **CoupleGap の tier 崩れ**（`text-[10.5px]` / `text-[11px]` / `text-[11.5px]` / `text-[13.5px]` / `text-[15px]` が混在）と、**candidates-view の「気になった式場を比べて…」リード文が `text-[12px]` で小さく、SegmentedControl（候補 / 比べる / 決める）の下に沈む**構造で、主要 CTA の「candidate tab」が何なのかパッと分からない。duel 誘導カード（favorites=2 のときのみ）も通常の式場カードと同じ影・同じ radius で差別化がなく「またカードか」と見流される。

### 6 段階 × 13 観点マトリクス

| 観点 | Score | 所見（1-2 行） |
|---|:---:|---|
| 1. Typography scale | 2 | CoupleGap の見出し h2 が `text-[11px]`、次の card 内見出しが `text-[15px]`、gap 本文が `text-[11.5px]`、venue 名が `text-[13.5px]`、location が `text-[10.5px]`、who label が `text-[10px]` → **6 tier**。 |
| 2. 余白リズム | 3 | `space-y-10`（ページ）/ `space-y-5`（view）/ `space-y-3`（gap section）/ `space-y-2` / `space-y-1.5` が入れ子で使われている。`space-y-1.5`（6px）は 4px grid 的には 4 や 8 に揃えたい。 |
| 3. カラー一貫性 | 4 | gold = AI（Sparkles / borderLeft）/ rose = primary（「〜だけ」chip の border-primary）/ cream = base、意味は守られる。ただし CoupleGap 親カード（`borderLeftWidth: 3px, borderLeftColor: var(--gold-warm)`）は AI インサイトの typography なのに中身は venue リスト。構造的混同。 |
| 4. アイコンサイズ | 2 | Sparkles `h-3.5 w-3.5`（CoupleGap :21, candidates-view :222）、HeartCrack `h-2.5 w-2.5`（CoupleGap :107）、SlidersHorizontal `h-3 w-3`（page.tsx :80）。4 箇所 16/20/24 外。 |
| 5. 重なり・衝突 | 5 | 問題なし。 |
| 6. 要素バランス | 3 | 「チェック項目を編集」リンクが `text-right` で右端に孤立（page.tsx :74-82）、ページの流れを断つ。 |
| 7. モバイル 375px 密度 | 3 | ヘッダ + hairline + CoupleGap + 編集リンク + SegmentedControl + リード文 = fold 消費 600px 近い。空状態（favorites=0）で SegmentedControl の下の EmptyState に至るまで 700px。 |
| 8. 明朝 × ゴシック | 4 | venue 名は serif、ヘッダ h1 は display serif、見出し・eyebrow は sans と使い分け OK。 |
| 9. tabular-nums | 3 | CoupleGap の「ふたりとも気になる {bothCount} 件」「気持ちがずれている {gaps.length} 件」に tabular-nums なし。数字はフォームに並ばない箇所は許容だが、件数はタブラー化すべき（v4.2 "Inline numeric" rule）。 |
| 10. 空/loading/error | 4 | shortlist 空状態「これから、ふたりの輪郭を描いていきましょう」「式場カードの♡をそっとタップすると、ここに集まります」は招待状トーン合格。 |
| 11. マイクロインタル | 4 | AnimatePresence の shortlist 0→1 は delay 0.1 scale 0.96→1 で合格。duel 誘導カードに `active:bg-muted` 有、decision tab の「取り消す」buttonは `active:bg-muted` 有。 |
| 12. ダークモード | 3 | 明示的な `bg-white`/`bg-black` なし、トークン使用。ただし CoupleGap 親カード の `color-mix(in oklab, var(--gold-warm) 22%, transparent)` は light mode での border 色だが、dark mode で同じ色だと弱い可能性。 |
| 13. Landing 品質 | - | 該当なし |

### Before → After（5 件、実装粒度）

**1. CoupleGap の「ふたりの温度」heading を editorial eyebrow + serif pair に統一** — 優先度 **P1** / 工数 **S**
- File: `src/components/candidates/couple-gap-section.tsx:18-27`
- Before:
  ```tsx
  <header className="flex items-baseline gap-2">
    <Sparkles
      aria-hidden="true"
      className="h-3.5 w-3.5 text-[color:var(--gold-warm)]"
      strokeWidth={1.8}
    />
    <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      ふたりの温度
    </h2>
  </header>
  ```
- After:
  ```tsx
  <header className="space-y-1.5">
    <p className="flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
      <Sparkles
        aria-hidden="true"
        className="h-4 w-4 text-[var(--gold-warm)]"
        strokeWidth={1.6}
      />
      <span>Couple Temperature</span>
    </p>
    <h2 className="font-[family-name:var(--font-noto-serif-jp)] text-[17px] font-light tracking-wide text-foreground">
      ふたりの温度
    </h2>
  </header>
  ```
- Why:
  1. 現状 `<h2 className="text-[11px] uppercase">ふたりの温度</h2>` は、日本語に uppercase は効かないため見た目は「小さい text」のまま。意味論的にも 11px のタイトルは a11y で弱い。
  2. **english eyebrow + 日本語 serif h2 の 2 段構造**（editorial-hero / explore header / candidates page header で既に使っている構造）に揃えると 4 画面の reading rhythm が統一される。
  3. icon `h-3.5 w-3.5` → `h-4 w-4`（16px 正規化）。

**2. CoupleGap の「気持ちがずれている N 件」ブロックのカード → メタデータを明朝 + serif 軸で整理** — P1 / M
- File: `src/components/candidates/couple-gap-section.tsx:72-114`
- Before（抜粋）:
  ```tsx
  <Link href={`/venues/${g.venueId}`} className="flex items-center gap-3 rounded-xl border bg-card p-2.5 pr-3 transition active:scale-[0.99]">
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">...</div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-[family-name:var(--font-display)] text-[13.5px] font-light">
        {g.venueName}
      </p>
      <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
        {g.location ?? ""}
      </p>
    </div>
    <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]", ...)}>
      <HeartCrack aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={2} />
      {whoLabel}
    </span>
  </Link>
  ```
- After:
  ```tsx
  <Link href={`/venues/${g.venueId}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition active:scale-[0.99]">
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">...</div>
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="truncate font-[family-name:var(--font-noto-serif-jp)] text-[14px] font-light tracking-[0.01em]">
        {g.venueName}
      </p>
      {g.location && (
        <p className="truncate text-[11px] text-muted-foreground">
          {g.location}
        </p>
      )}
    </div>
    <span className={cn(
      "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] tracking-[0.08em]",
      onlyMe
        ? "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] text-[color:var(--primary)]"
        : "border-border text-muted-foreground",
    )}>
      <HeartCrack aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
      {whoLabel}
    </span>
  </Link>
  ```
- Why:
  1. 元の 12px サムネ → 14px に拡大（**44px ルールより小さい 48px 相当のタッチ補助エリア**、Link 行全体のタッチ領域は十分なので純視覚的な調整）。rounded-lg (8px) → rounded-xl (12px) で大きい thumb が丸すぎず収まる。
  2. 式場名 `text-[13.5px]` → `text-[14px]`、location `text-[10.5px]` → `text-[11px]` と 4px grid に揃える。
  3. Shippori（display）serif は 24px 以上ルールのため、body serif の Noto Serif JP に切替。
  4. HeartCrack icon `h-2.5 w-2.5` (10px) → `h-3 w-3` (12px)。完全な 16/20/24 ルールから外れるが、chip 内アイコンは 12px が実用下限として許容される。
  5. 「〜だけ」chip の背景色を薄い primary tint で追加し、境界線だけでなく**面の色**でも「あなただけ」感情的ニュアンスを強調。

**3. candidates-view のリード文を SegmentedControl の上に移し、role を明確化** — P1 / S
- File: `src/components/candidates/candidates-view.tsx:170-179`
- Before:
  ```tsx
  <div className="space-y-5">
    <p className="text-[12px] text-muted-foreground">
      気になった式場を比べて、おふたりの一番を見つけましょう
    </p>
    <SegmentedControl
      segments={SEGMENTS}
      activeId={tab}
      onChange={(id) => setTab(id as Tab)}
    />
  ```
- After:
  ```tsx
  <div className="space-y-5">
    {/* Lead — sits above segments as the "section intention" */}
    <div className="space-y-2 text-center">
      <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
        Three steps, gently
      </p>
      <p className="font-[family-name:var(--font-noto-serif-jp)] text-[15px] font-light leading-relaxed text-foreground/85">
        集める → 並べる → 決める
      </p>
    </div>
    <SegmentedControl
      segments={SEGMENTS}
      activeId={tab}
      onChange={(id) => setTab(id as Tab)}
    />
  ```
- Why:
  1. 元のリード「気になった式場を比べて、おふたりの一番を見つけましょう」は 40 字で `text-[12px]` の muted、SegmentedControl（候補 / 比べる / 決める）と**同じ役割（ナビゲーション案内）**。冗長。
  2. **3 ステップの比喩（集める→並べる→決める）を明朝小タイトルで視覚化**し、SegmentedControl の 3 つのラベル（候補=集める / 比べる=並べる / 決める=決める）と意味的に接続する。v4.2「ステップ番号は見せない」原則（DESIGN.md 設計原則）を踏みつつ「3 歩」の呼吸を作る。

**4. duel 誘導カード（「2 件で迷ったら、情景で決める」）を gold-subtle の AI インサイトカードに格上げ** — P2 / S
- File: `src/components/candidates/candidates-view.tsx:215-230`
- Before:
  ```tsx
  <Link
    href={`/candidates/duel?a=${favorites[0].venue.id}&b=${favorites[1].venue.id}`}
    prefetch={false}
    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-colors active:bg-muted"
  >
    <Sparkles
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
      strokeWidth={1.8}
    />
    <span className="flex-1 text-[13.5px] font-light">
      2件で迷ったら、情景で決める
    </span>
    <span className="text-[11px] text-muted-foreground">→</span>
  </Link>
  ```
- After:
  ```tsx
  <Link
    href={`/candidates/duel?a=${favorites[0].venue.id}&b=${favorites[1].venue.id}`}
    prefetch={false}
    className="group flex w-full items-center gap-3 rounded-2xl border-l-[3px] border-l-[var(--gold-warm)] border-y border-r border-[color-mix(in_oklab,var(--gold-warm)_20%,transparent)] bg-[var(--gold-subtle)] px-5 py-4 text-left transition-all active:scale-[0.99]"
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold-warm)]/15">
      <Sparkles
        aria-hidden="true"
        className="h-4 w-4 text-[var(--gold-warm)]"
        strokeWidth={1.6}
      />
    </div>
    <div className="flex-1 leading-tight">
      <p className="text-[10.5px] tracking-[0.16em] uppercase text-[var(--gold-warm)]/85">
        Haretoki Suggests
      </p>
      <p className="mt-1 font-[family-name:var(--font-noto-serif-jp)] text-[14.5px] font-light text-foreground">
        2件で迷ったら、情景で決める
      </p>
    </div>
    <ArrowRight className="h-4 w-4 text-[var(--gold-warm)] transition-transform group-active:translate-x-0.5" strokeWidth={1.6} />
  </Link>
  ```
- Why:
  1. 元は「普通のリンクカード」と同じ装飾（border-border、bg-card、shadow-card）。duel は Haretoki の**差別化機能**（ペアワイズ情景 2 択）。ここを埋もれさせている。
  2. AIInsightCard と同じ構造（gold-subtle 背景 + 3px gold 左ボーダー + Sparkles + eyebrow + 明朝コピー）にすることで「これはアプリからの提案」と視覚的に明示。AIInsightCard と装飾を揃える = 「AI からの声」の一貫性。
  3. `→` テキストを ArrowRight アイコンに置換し、active 時に `translate-x-0.5` でさりげない動きを加える。

**5. 「チェック項目を編集」リンクの配置を整える** — P3 / XS
- File: `src/app/(app)/candidates/page.tsx:72-83`
- Before:
  ```tsx
  <div className="text-right">
    <Link
      href="/checklist"
      prefetch={false}
      className="inline-flex min-h-11 items-center gap-1 text-[11.5px] text-muted-foreground underline-offset-4 hover:underline hover:text-[var(--gold-warm)]"
    >
      <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
      チェック項目を編集
    </Link>
  </div>
  ```
- After:
  ```tsx
  <div className="flex justify-end">
    <Link
      href="/checklist"
      prefetch={false}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-4 text-[11.5px] tracking-wide text-muted-foreground underline-offset-4 transition-colors hover:border-[var(--gold-warm)]/40 hover:text-[var(--gold-warm)]"
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      チェック項目を編集
    </Link>
  </div>
  ```
- Why:
  1. 元は「右寄せテキストリンク」でページフローを分断。**pill 型ゴースト button** にすることで「副次的な操作」と明確に分かる。
  2. icon `h-3 w-3` (12px) → `h-4 w-4` (16px)。

### 競合参考

- **The Knot "Your Vendors" hub** — 3 tab（Browse / Shortlist / Booked）と各 tab に「per-category breakdown」を配置。Haretoki の 3 segment（候補 / 比べる / 決める）は同じ IA。リード文を補助する "Three steps, gently" の editorial eyebrow は Knot にはない Haretoki 独自の格付け。
- **Zola favorites UI** — 温度感表現として heart + 「you + partner」同意サインがあり、Haretoki の CoupleGap「ふたりとも気になる / 〜だけ」と同じ方向性。ただし Zola は chip 色をより強く使う（pink 塗り）。Haretoki は primary rose tint（6%）にとどめて上品さを維持する方針を堅持すべき。
- **Airbnb Wishlist → Compare** — 2-3 件を並べて比較するためのエントリは「Compare」CTA として Wishlist カード直上に配置。Haretoki の duel 誘導カードも同じ位置（favorites=2 のとき shortlist 上）で配置は正しい。装飾の格上げが残課題。

### 優先度 / 工数 サマリ

- P0: 0 件
- P1: 3 件（CoupleGap heading / gap card typography / リード文整理）
- P2: 1 件（duel 誘導カード AI インサイト化）
- P3: 1 件（編集リンク pill 化）
- 合計工数: XS×1, S×3, M×1

---

## 画面 4: 情景で決める（/candidates/duel）

**File**: `src/app/(app)/candidates/duel/page.tsx` + `src/components/candidates/duel-client.tsx`
**総合スコア**: **2.8 / 5**（違和感中）
**ひとこと要約**: 2 択体験は Haretoki の Soul（独自機能）のひとつ。タイポ（明朝 19px の問い）と進捗ドット（current は rose、past は gold）は良い。**致命的な欠陥は「情景で決める」と名乗っておきながら、問い画面（quiz phase）で式場の写真を一切見せていない**こと。ユーザーは 2 つの式場名（text のみ）を見て text 2 択を選ぶ UI になっている。写真が出てくるのは **結果画面の勝者のみ、しかも 4:3 で 1 枚**。つまり体験フローが「写真で比べる」ではなく「名前だけで選ばされる」になっており、ペアワイズの心理的根拠が薄い。結果画面の写真タイポは明朝 + gold overlay で luxury だが、到達するまでの旅が text-only でチープ。

### 6 段階 × 13 観点マトリクス

| 観点 | Score | 所見（1-2 行） |
|---|:---:|---|
| 1. Typography scale | 3 | 問いの `text-[19px]` 明朝 extralight は luxury。ただし ChoiceButton 内「式場名（ラベル）`text-[12px]` → 情景テキスト `text-[14.5px]`」の 2.5px ギャップが中途半端。 |
| 2. 余白リズム | 3 | `pb-6` / `pb-8` / `mb-8` / `gap-1.5` / `space-y-3` が混在。ChoiceButton の `px-5 py-4` は OK だが `min-h-24` (96px) と大きめで空気を持て余す。 |
| 3. カラー一貫性 | 4 | 現在の問い = primary（rose）/ 過去の回答 = gold / 未回答 = muted。意味の割当ては明快。結果画面の winner = primary（rose）CTA + gold overlay 背景、AI インサイトカード = gold-subtle で正しい。 |
| 4. アイコンサイズ | 2 | `<ArrowLeft className="h-4 w-4" />`（:93, :239）は 16px OK。Sparkles `h-3.5 w-3.5`（:365）は 14px で規定外。 |
| 5. 重なり・衝突 | 5 | 問題なし。 |
| 6. 要素バランス | 1 | **Quiz phase に式場の写真がない**。2 つの venueA.name / venueB.name の text と「情景テキスト」だけで選ばされる。「情景で決める」というコンセプトと UI が乖離。 |
| 7. モバイル 375px 密度 | 3 | header(56px) + progress(32px) + 問い(~100px) + ChoiceA(~110px) + 「または」(~40px) + ChoiceB(~110px) = ~450px。可読性は良いが、式場写真を入れる余地が余白側に十分ある。 |
| 8. 明朝 × ゴシック | 4 | 問い、結果見出し、venue 名は serif (display)、ラベル・本文は sans。ただし問い 19px で display serif は OK 範囲（Shippori ≥24px ルールからは少し下だが、問いは見出し格なので許容）。 |
| 9. tabular-nums | 5 | 進捗 `{currentIndex + 1} / {totalQuestions}`、結果の `{countA} — {countB}`、共感度 `{pct}%` は全て tabular-nums 付与済。 |
| 10. 空/loading/error | - | 2 venues 必須の硬い画面。notFound() で返す。EmptyState ケースは意図的に省略されている（OK）。 |
| 11. マイクロインタル | 4 | ChoiceButton `active:scale-[0.98]`、選択後 320ms 待機で進行、ScoreBar `transition-all duration-700` アニメーション有。結果画面の写真入場に motion がないのは物足りない。 |
| 12. ダークモード | 3 | `bg-[color-mix(in_oklab,var(--primary)_8%,var(--background))]` 形式で oklab-mix を使っており theoretical には dark mode 対応。ただし gold overlay `from-[color-mix(in_oklab,var(--gold-warm)_30%,transparent)]` は dark mode で見た目が強すぎる可能性。 |
| 13. Landing 品質 | - | 該当なし |

### Before → After（5 件、実装粒度）

**1. Quiz phase に venueA/B の写真サムネを出し、「text-only 2 択」から「photo-paired 2 択」に変える** — 優先度 **P0** / 工数 **L**
- File: `src/components/candidates/duel-client.tsx:175-202`
- Before:
  ```tsx
  function ChoiceButton({ label, text, isSelected, isOtherSelected, onClick }: ChoiceButtonProps) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isSelected || isOtherSelected}
        className={cn(
          "w-full min-h-24 rounded-2xl border px-5 py-4 text-left transition-all duration-200",
          "active:scale-[0.98]",
          isSelected
            ? "border-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,var(--background))] shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
            : isOtherSelected
              ? "border-border/40 bg-muted/40 opacity-50"
              : "border-border bg-card hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))] hover:bg-[color-mix(in_oklab,var(--primary)_3%,var(--card))]",
        )}
      >
        <p className={cn(
          "mb-1.5 font-[family-name:var(--font-display)] text-[12px] font-light tracking-[0.08em]",
          isSelected ? "text-[color:var(--primary)]" : "text-muted-foreground",
        )}>
          {label}
        </p>
        <p className="text-[14.5px] font-light leading-relaxed text-foreground">{text}</p>
      </button>
    );
  }
  ```
- After（新しいシグネチャで photoUrl を受け取る）:
  ```tsx
  interface ChoiceButtonProps {
    label: string;
    photoUrl: string | null;
    text: string;
    isSelected: boolean;
    isOtherSelected: boolean;
    onClick: () => void;
  }

  function ChoiceButton({ label, photoUrl, text, isSelected, isOtherSelected, onClick }: ChoiceButtonProps) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isSelected || isOtherSelected}
        className={cn(
          "relative flex w-full items-stretch gap-4 overflow-hidden rounded-2xl border text-left transition-all duration-200",
          "active:scale-[0.98]",
          isSelected
            ? "border-[color:var(--primary)] bg-[color-mix(in_oklab,var(--primary)_8%,var(--background))] shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
            : isOtherSelected
              ? "border-border/40 bg-muted/40 opacity-50"
              : "border-border bg-card hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))]",
        )}
      >
        {/* 96x96 thumbnail with gold hairline — photo tells the first half of the story */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-muted">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt=""
              fill
              sizes="96px"
              className="object-cover photo-tone"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/30">
              <Building2 className="h-8 w-8" strokeWidth={1} />
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--primary)_25%,transparent)]" />
          )}
        </div>
        <div className="min-w-0 flex-1 py-4 pr-5">
          <p className={cn(
            "mb-1 font-[family-name:var(--font-noto-serif-jp)] text-[12px] font-light tracking-[0.08em]",
            isSelected ? "text-[color:var(--primary)]" : "text-muted-foreground",
          )}>
            {label}
          </p>
          <p className="text-[14.5px] font-light leading-relaxed text-foreground">{text}</p>
        </div>
      </button>
    );
  }
  ```
- Why:
  1. **Quiz phase の情景を text-only で選ばせるのは "情景で決める" という機能名の裏切り**。ユーザーは「どちらの式場で」というビジュアル記憶なく text だけで判断を強いられる。96x96 のサムネを左側に置くだけで「名前 + 写真 + 情景文」の 3 点セットになる。
  2. 競合: "This or that" 型の pairwise UI（Tinder の swipe、Airbnb の experience quiz）は**必ず写真をセットにする**。text-only は survey ツール（SurveyMonkey 等）の質感で、ラグジュアリーからは最も遠い。
  3. photo-tone フィルタ（VenueImage と同じ）を適用して、ユーザーがここまで見てきた他画面の写真と**同じ色調（cream/gold warm sepia）**で統一。
  4. isSelected 時に photo の上に primary 25% overlay をかけて「選んだ」感を視覚的に強化。

**2. Quiz phase の問いテキストに gradient hairline を入れて editorial リズムを作る** — P1 / S
- File: `src/components/candidates/duel-client.tsx:125-133`
- Before:
  ```tsx
  <div className="mb-8 flex-1">
    <p
      className="font-[family-name:var(--font-display)] text-[19px] font-extralight leading-[1.65] tracking-[0.01em] text-foreground"
      key={scene.id}
    >
      {scene.moment}
    </p>
  </div>
  ```
- After:
  ```tsx
  <div className="mb-8 flex-1 space-y-5">
    <p className="text-[10.5px] tracking-[0.22em] uppercase text-muted-foreground">
      Scene {currentIndex + 1}
    </p>
    <p
      className="font-[family-name:var(--font-display)] text-[21px] font-extralight leading-[1.6] tracking-[0.01em] text-foreground"
      key={scene.id}
    >
      {scene.moment}
    </p>
    <div
      aria-hidden="true"
      className="h-px w-16"
      style={{
        background: "linear-gradient(to right, color-mix(in oklab, var(--gold-warm) 40%, transparent), transparent)",
      }}
    />
  </div>
  ```
- Why:
  1. 現状の問いは `text-[19px]` + `leading-[1.65]` で質は良いが、前後の context（このシーンが何番目か）が数字の横並び（1/8 等）でしか表現されず、editorial 感が弱い。
  2. 「Scene N」eyebrow を追加 → 問いを `text-[21px]` に 2px 上げ（display serif は 24px 以上推奨の下限に近づける）→ 下に gold gradient hairline 16px → **magazine の「記事タイトル + 本文の境目」構造**になる。editorial-hero / candidates page と同じ hairline 装飾で画面間の一貫性も出る。

**3. 「または」divider を削り、gap を広げてリズムで分ける** — P2 / XS
- File: `src/components/candidates/duel-client.tsx:146-150`
- Before:
  ```tsx
  <div className="flex items-center gap-3">
    <div className="flex-1 border-t border-border" />
    <span className="text-[11px] text-muted-foreground">または</span>
    <div className="flex-1 border-t border-border" />
  </div>
  ```
- After: 削除。代わりに親の `space-y-3` → `space-y-4` に広げる。
  ```tsx
  <div className="space-y-4 pb-6">
    {/* 式場 A */}
    <ChoiceButton ... photoUrl={venueA.photoUrl} ... />
    {/* 式場 B */}
    <ChoiceButton ... photoUrl={venueB.photoUrl} ... />
  </div>
  ```
- Why:
  1. 写真付きの 2 択になれば視覚的に「A と B」が明確で、「または」divider は冗長ノイズ。
  2. 余白（gap-4 = 16px）で呼吸を作る方が luxury。The Knot / Airbnb の choice list も divider ではなく gap 16-24px で間を作る。

**4. 結果画面の勝者写真にハロー入場モーションを追加** — P2 / S
- File: `src/components/candidates/duel-client.tsx:328-353`
- Before:
  ```tsx
  <div className="flex flex-1 flex-col gap-6">
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
      {winner.photoUrl ? (
        <Image ... />
      ) : (...)}
      <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to top, color-mix(in oklab, var(--gold-warm) 30%, transparent) 0%, transparent 50%)" }} />
    </div>
    ...
  </div>
  ```
- After:
  ```tsx
  <div className="flex flex-1 flex-col gap-6">
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted"
    >
      {winner.photoUrl ? (
        <Image src={winner.photoUrl} alt={winner.name} fill sizes="(max-width: 430px) 100vw, 430px" className="object-cover photo-tone-hero" priority />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground/40 text-[40px]">◎</span>
        </div>
      )}
      {/* Inner glow — top edge emboss, consistent with DESIGN.md Atmospheric Layers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)" }} />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(to top, color-mix(in oklab, var(--gold-warm) 35%, transparent) 0%, transparent 55%)" }} />
      {/* Venue name overlay */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="text-[10.5px] tracking-[0.2em] uppercase text-white/80">
          Haretoki for you
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-[20px] font-extralight tracking-wide text-white">
          {winner.name}
        </p>
      </div>
    </motion.div>
    ...
  </div>
  ```
- Why:
  1. 勝者の写真は**演出の主役**。`initial: opacity 0, scale 0.96` から 900ms hero duration（v4.2 `--dur-hero 900ms`）で入場することで「結果発表」の瞬間にドラマが生まれる。
  2. `photo-tone-hero` フィルタ適用で他画面の photo-tone（default）より saturation/contrast がわずかに高く、ヒーロー感を出す。
  3. `rounded-2xl` → `rounded-3xl` で大型 hero として膨らみを与える（24px radius）。
  4. 写真上にオーバーレイで「Haretoki for you」eyebrow + 明朝 venue 名 20px を入れることで、勝者写真が**独立した editorial spread** になる（現状は下の AI インサイトカードに venue 名を任せて写真はただの装飾）。

**5. AI インサイトカードの Sparkles icon を 14 → 16px に** — P3 / XS
- File: `src/components/candidates/duel-client.tsx:364-367`
- Before:
  ```tsx
  <Sparkles
    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--gold-warm)]"
    strokeWidth={1.8}
  />
  ```
- After:
  ```tsx
  <Sparkles
    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold-warm)]"
    strokeWidth={1.6}
  />
  ```
- Why:
  1. 16/20/24 ルールへの統一。strokeWidth は 1.6 に下げてラグジュアリー感を維持（1.8 はやや重い）。

### 競合参考

- **Tinder / pairwise photo choice apps** — 2 択でカード全面写真 + 下に名前・ラベル + ボタン 2 個（NO / YES）の構造。Haretoki duel はカード単位ではなく行単位の 2 択だが、「写真を必ず見せる」原則は共通。
- **Airbnb "Experience" recommendation quiz** — 「A or B どちらが気になる？」型の pairwise UI で、両方ともに photo thumbnail + short title。Haretoki duel は**情景ベースの問い**という point of difference があるので、写真 + 情景文の組み合わせは Airbnb より一段深い体験になる（実装後）。
- **Mobbin "Quiz" category** — モバイルクイズ UI ベストプラクティスとして「選択肢は写真 or icon を必ず伴う」。現在の Haretoki duel は text-only で、2026 年の pairwise UI の標準から外れている。

### 優先度 / 工数 サマリ

- P0: 1 件（Quiz phase に venue photo 追加）
- P1: 1 件（問い eyebrow + hairline）
- P2: 2 件（divider 削除 / 勝者写真モーション&overlay）
- P3: 1 件（Sparkles icon 16px 化）
- 合計工数: XS×2, S×2, L×1

---

## 4 画面トータル 優先度 / 工数サマリ

| Priority | 件数 | 該当 |
|---|:---:|---|
| **P0** | **2** | VenueCard 写真 4:3 化、Duel Quiz に写真追加 |
| **P1** | **9** | Home Journey リンク格、Home RecentVenues 写真焼込み廃止、Explore AIRec 見出し、Explore 条件 tier 整理、Explore バッジ分離、CoupleGap heading、CoupleGap cards、Candidates リード、Duel 問い eyebrow |
| **P2** | **6** | DailyRitual eyebrow token、View all 矢印、AIRec 式場名格上げ、duel 誘導 AI 化、Duel divider 削除、Duel 勝者モーション |
| **P3** | **3** | Home EmptyState gradient、編集リンク pill、Duel Sparkles 16px |

| 工数 | 件数 |
|---|:---:|
| XS | 5 |
| S  | 9 |
| M  | 5 |
| L  | 1 |

---

## 4 画面全体に効く横断パッチ（監査から見えた「やるなら 1 回で効く」改修）

1. **`text-eyebrow` ユーティリティの徹底** — globals.css :406 に既に定義済み。explore/candidates/home の全 eyebrow 相当箇所（`text-[10px]` `text-[10.5px]` `text-[11px]` `text-[11.5px] tracking-[0.16em] uppercase` 等）を `text-eyebrow` に置換するだけで scale が 1 段階統一される。
2. **Shippori (display serif) の使用場所の棚卸し** — `font-[family-name:var(--font-display)]` が `text-[13.5px]` / `text-[14px]` / `text-[15px]` / `text-[17px]` に付与されている箇所が 4 画面で 10 件以上検出。DESIGN.md の「Shippori は ≥24px ONLY」ルールに合わせ、**24px 未満の serif は Noto Serif JP (body serif)** に置換する。
3. **アイコン `h-3.5 w-3.5` 一括検出と `h-4 w-4` への置換** — プロジェクト全体で `grep "h-3\.5 w-3\.5"` した結果、4 画面担当範囲だけで 6 箇所。関連するアイコンは stroke-width も `1.8` → `1.6` に下げて luxury feel に整える。
4. **写真比率の統一宣言** — 新しい UI 規約として「VenueCard = 4:3 / RecentVenues = 3:2 / Duel winner = 4:3 / Duel thumbnail = 1:1」とドキュメント化すれば、今後の画面追加時の判断が早くなる（実装は各コンポーネントで個別対応）。
5. **dark mode 対応の穴** — `bg-black/40` `bg-black/45` `from-black/60` 等のハードコードが home/explore に 4 箇所。`bg-foreground/40` or `dark:bg-white/10` 等のトークン or variant 化が必要（ただし Phase 5 で対応予定とドキュメントされているため、今回は「棚卸し」のみ）。

---

## 監査所感

担当 4 画面で一番の問題は、DESIGN.md v4.2 のトークン（`--text-fluid-*`、`text-eyebrow` ユーティリティ、「Shippori は ≥24px のみ」ルール、アイコン 16/20/24 のみ規定）が**部分的にしか運用されていない**こと。刷新済みの editorial-hero は v4.2 の格を達成しているが、周囲の RecentVenues / AIRecommendations / explore の条件ゾーン / CoupleGap / duel-client は**旧世代の実装**で、画面内・画面間で「品格が上下する」ジグザグ体験を生んでいる。

ユーザー #13「20 年前のデザイン」の核心は、決して Morning Light パレットの問題ではなく、**text size tier が整理されておらず `text-[11px]` `text-[11.5px]` `text-[12px]` `text-[12.5px]` `text-[13px]` `text-[13.5px]` が同じ画面に並ぶ**ことに起因するノイズ感。P0/P1 の 11 件を着手すれば、#13 の違和感の 70-80% は解消される見込み。

#12「写真サイズ問題」の核心は VenueCard 16:9 → 4:3 の 1 行変更（P0）で大きく前進する。これだけで探す画面の第一印象が変わる。

#14「施設名・住所・アクセスの書式不統一」はこの監査範囲ではフル対応できないが、CoupleGap の「venue 名 + location」ペア整理（P1 第 2 項）や、RecentVenues 写真焼き込み廃止（P1 第 1 項）で一部は整理される。「書式統一」の全面対応は venue detail ページまで含めた別監査で扱うのが適切。

---

## Sources（調査で参照）

- [The Knot Wedding Planner — App Store](https://apps.apple.com/us/app/the-knot-wedding-planner/id457941553) — Dashboard 現行版と "Your Vendors" ハブ UI 調査
- [The Knot Wedding Planner App overview](https://www.theknot.com/wedding-planning-app)
- [Zola Wedding Planner Mobile App](https://www.zola.com/wedding-planning/app) — Favorites / Vendor comparison UX 調査
- [Wedding Spot — How it works](https://www.wedding-spot.com/how-it-works/) — Side-by-side 比較と per-person breakdown 参考
- [Airbnb mobile photo aspect ratio guidelines (Copilot Rentals, 2025)](https://copilot.rentals/2025/02/26/photo-resolution-amp-aspect-ratio-guidelines-for-major-otas-2025/) — 3:2 推奨、listing card 4:3 も許容
- [Airbnb Mobile App UI Kit — Figma Community](https://www.figma.com/community/file/1386744539424070779/airbnb-mobile-app-ui-kit-design-system-free) — card 構造と typography tier 参考
- [Luxury serif fonts 2026 — Sensatype](https://sensatype.com/best-luxury-serif-fonts-for-elegant-branding-in-2026) — editorial serif × 細字ウェイトの現代運用
- [Design Systems Trends 2026 — Design Signal](https://designsignal.ai/articles/design-systems-trends-2026) — Aesop の "digital terroir" 原則と responsive serif
- [Mobbin Quiz category](https://mobbin.com/explore/mobile/screens/quiz) — pairwise 2 択 UI ベストプラクティス（写真必須原則）
- [Hitched Wedding Planner App](https://apps.apple.com/gb/app/hitched-wedding-planner/id606949137) — UK 結婚式場ブラウズ参考

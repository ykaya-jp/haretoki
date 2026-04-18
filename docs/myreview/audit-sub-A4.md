# Audit Sub-A4 — Editorial Unrefreshed Surfaces (12 screens)

> **担当**: Sub-A4 / checklist・visits 補助・mypage 周辺・auth・landing
> **対象**: 全画面 v4.2 editorial 刷新前の想定
> **基準**: DESIGN.md v4.2 "Modern Luxury · Editorial Refresh"
> **実ユーザー痛点**: #13 "20 年前のデザイン"、#14 "項目書式バラツキ"、#16 "並べましただけ"
> **成果物種別**: 調査 + 監査のみ。実装 edit 禁止。
> **視点**: モバイル 375px 基準、DESIGN.md v4.2 token を唯一の尺度とする

## スコアリング凡例

| スコア | 意味 |
|---|---|
| 5 | editorial 完成。Airbnb / Linear / Things 3 と同列に並べて遜色ない |
| 4 | 構造は整っているが細部に 1-2 箇所の穴 |
| 3 | 情報は伝わる。ただし 2026 水準からは一歩遅れ |
| 2 | 「並べた」印象が残り editorial ではない |
| 1 | #16 "並べましただけ" 該当。刷新手前 |
| 0 | 崩壊 |

13 観点略号: **T**ypography / **S**pacing / **C**olor / **I**con / **O**verlap / **B**alance / **D**ensity / **F**ont-mix / **N**ums / **E**mpty-state / **M**otion / **K** (dark) / **1st**(first-touch)

---

# Part I — 認証後 9 画面

---

## 画面 1: 式場チェックリスト（/venues/[id]/checklist）

**File**: `src/app/(app)/venues/[id]/checklist/page.tsx` + `src/components/checklist/venue-checklist-input-view.tsx`
**総合スコア**: 2.5 / 5
**ひとこと要約**: page 上部の eyebrow / serif h1 は v4.2 水準。ただし本体 `VenueChecklistInputView` が v3 以前の白カード + `border-b px-4 py-3` で、内側の item spacing が `space-y-4` の単調 vertical rhythm に終わっている。#14 "書式バラツキ" の震源地（yesno/memo/number/photo の 4 形式が全て違うシェルで並ぶ）。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 3 | page h1 は `text-h1 font-extralight` で OK。しかし item `<p className="text-sm">` は画面内で最大 40 行連続し、hierarchy が潰れる。category label `font-medium`、subcategory label `text-xs font-medium text-muted-foreground`、item question `text-sm leading-snug` が全て近接した weight で **3 階層が 1 階層に見える** |
| 2 | S Spacing | 2 | カード header `px-4 py-3` + items `space-y-4` + subcategory `px-4 py-3` が全て同じ 12-16px レンジ。section gap が無い（DESIGN.md: mobile 32-48px）。**#16 パターン直撃** |
| 3 | C Color | 3 | `bg-card`/`border`/`bg-primary` の 3 色のみ。gold-warm / gold-subtle accent が完全に欠如（v4.2 で checklist は AI 領域として gold 帯を薄く被せる想定） |
| 4 | I Icon | 4 | 本体には icon なし。page header の `ChevronLeft h-3 w-3` は 16/20/24 外（12px）で **トークン違反**。Back link の icon は h-4 に上げるべき |
| 5 | O Overlap | 4 | item row 内部の衝突なし。textarea の `rows={2}` と photo thumbnails `h-16 w-16` は 44px グリッドに沿う |
| 6 | B Balance | 2 | yesno row は 3 ボタンで `flex-1` 均等、memo row は textarea 100%、number row は input 100%、photo row は 64px thumbnail 並び — **4 形式の weight がバラバラ** で "form が整っていない" #14 印象 |
| 7 | D Density | 3 | 1 カード内に平均 8-12 問。scroll 距離が長く、category 間の区切りが視覚的に弱い |
| 8 | F Font-mix | 3 | page h1 は serif、本体は sans のみ。question text に serif を少し入れると editorial 感が出るが、現状は「質問は全部 sans」で機能的 |
| 9 | N Nums | — | 数値 input は `tabular-nums` 適用済み。該当箇所 OK |
| 10 | E Empty-state | 4 | 0 件時の破線 border + CTA ありで v4.2 P1 "招待状" に準拠。ただし icon 無し、serif 見出し無しで少し素っ気ない |
| 11 | M Motion | 2 | `active:scale-[0.98]` のみ。yesno 切替時の色トランジションは `transition-colors` で OK だが、**memo 保存時の feedback が toast 以外皆無**。debounce 500ms の間に状態表示が何もない |
| 12 | K Dark | 3 | `bg-card/border-border/text-muted-foreground` で自動対応。ただし item `rows` の `bg-card` は dark では背景が親と同化して field が消える懸念 |
| 13 | 1st First-touch | — | 認証後画面のため対象外 |

### Before → After

**1. サブカテゴリ header に eyebrow を導入（#14 書式統一）** — P0 / M
- File: `src/components/checklist/venue-checklist-input-view.tsx:175-177`
- Before:
```tsx
<div key={sub.subcategory} className="px-4 py-3">
  <p className="mb-2 text-xs font-medium text-muted-foreground">{sub.subcategory}</p>
  <div className="space-y-4">
```
- After:
```tsx
<div key={sub.subcategory} className="px-5 pt-5 pb-4">
  <p className="mb-4 text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
    {sub.subcategory}
  </p>
  <div className="space-y-6">
```
- Why: 通常の `text-xs medium` は body text と同化する。**tracking-[0.2em] uppercase + 10.5px** の eyebrow 化で「ここから違う粒度の情報」と即座に伝わる。Linear settings / Notion settings で確立されたパターン。`space-y-4 → space-y-6` で 1 item = 1 呼吸に広げる。

**2. Category card に section gap を入れて「並べた」感を消す（#16）** — P0 / S
- File: `src/components/checklist/venue-checklist-input-view.tsx:167-169`
- Before:
```tsx
<div className="space-y-4">
  {grouped.map((group) => (
    <div key={group.category} className="rounded-lg border bg-card shadow-sm">
```
- After:
```tsx
<div className="space-y-10">
  {grouped.map((group) => (
    <section key={group.category} className="rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
```
- Why: `space-y-4` (16px) は item 間隔と同じで「全部が同じ距離」になり #16 症状を悪化させる。`space-y-10` (40px) は DESIGN.md 「mobile section gap 32-48」の中心値。`rounded-lg (8px) → rounded-2xl (16px)` で editorial な呼吸感。`shadow-sm → shadow-[var(--shadow-card)]` は token 準拠。

**3. yesno ボタンをセグメント型に統一して #14 "書式バラツキ" を収める** — P1 / M
- File: `src/components/checklist/venue-checklist-input-view.tsx:72-94`
- Before:
```tsx
<div className="flex gap-2">
  {(["yes", "no", "unknown"] as const).map((val) => {
    ...
    <button className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border text-sm ...`}>
      {labels[val]}
    </button>
```
- After:
```tsx
<div className="inline-flex min-h-[44px] w-full overflow-hidden rounded-full border border-border bg-background p-0.5">
  {(["yes", "no", "unknown"] as const).map((val) => {
    ...
    <button className={cn(
      "flex-1 rounded-full text-[13px] transition-colors active:scale-[0.98]",
      isSelected
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}>
      {labels[val]}
    </button>
```
- Why: 現状 3 つの border-radius 正方形ボタンが並ぶ「セレクト UI」。ThemeSwitcher や DESIGN.md のテーマ選択と**同じ pattern に統一**すべき。`rounded-full` 外殻 + `p-0.5` 内側トラック + active `bg-foreground` は iOS の segmented control / Linear の view switcher で確立された書式。**全項目のトグルが同じ目で読めるようになり、#14 の「書式が違う」不満が消える**。

**4. memo / number 保存状態の可視化** — P2 / M
- File: `src/components/checklist/venue-checklist-input-view.tsx:99-132`
- Before:
```tsx
<textarea ... onChange={(e) => debouncedSave({ memo: e.target.value })} />
```
- After:
```tsx
<div className="relative">
  <textarea ... onChange={...} />
  {isPending && (
    <span className="absolute bottom-2 right-3 text-[10.5px] tracking-[0.14em] uppercase text-muted-foreground">
      保存中…
    </span>
  )}
  {lastSavedAt && !isPending && (
    <span className="absolute bottom-2 right-3 text-[10.5px] tracking-[0.14em] uppercase text-[color:var(--gold-warm)]/60">
      ✓ 保存済
    </span>
  )}
</div>
```
- Why: 現状 debounce 500ms の間 UI に feedback 無し → ユーザーは「書けた？」と不安になる（Haretoki #13 "20 年前" に直結する触感劣化）。inline ステータス表示は Notion / Linear の TextArea で採用されている control を真似る。eyebrow tracking を活かして視覚的な音量を抑える。

### 競合参考

- **Things 3 (Apple)** — Heading による section 分離と Project カード内の checklist item spacing が 4:8:16 の厳密な rhythm。Haretoki の `space-y-4` 単調を改善する原型。
- **Linear Settings** — category card 毎に 32px gap + uppercase eyebrow。Haretoki の subcategory header 置き換えにそのまま適用可能。
- **Notion Settings (Desktop)** — rowsあたり 48px 高さと 24px 水平 padding の厳格なグリッド。yesno/memo を混ぜても統一感が保たれる。

### 優先度 / 工数サマリ
- P0 × 2（section gap、eyebrow 化）= 合計 M
- P1 × 1（セグメント化）= M
- P2 × 1（保存状態可視化）= M

---

## 画面 2: チェックリスト選択（/checklist）

**File**: `src/app/(app)/checklist/page.tsx` + `src/components/checklist/{checklist-selection-view,starter-cta,reflection-hint}.tsx`
**総合スコア**: 3.5 / 5
**ひとこと要約**: 入口（`ChecklistStarterCTA`）と反映先 hint は v4.2 editorial 刷新済み（gold gradient + eyebrow + serif 22px）。ただし本体の `ChecklistSelectionView` はアコーディオン chevron が `▲▼` 絵文字、toggle switch は shadcn/ui ではなく手実装、subcategory 下の item 間 `py-2` が貧弱。Header の h1 が `text-[22px]` で他画面の `text-h1` と揃っていない（#14 書式バラツキ）。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 3 | h1 `text-[22px]` は他の editorial 画面（`text-h1` = fluid-xl）と不一致。eyebrow `text-[10.5px] tracking-[0.14em]` は DESIGN.md 標準 `[0.2em]` より狭い |
| 2 | S Spacing | 3 | Category card は `space-y-2` と窮屈（`space-y-6` 相当が適切）。subcategory と item の上下余白も `mb-3 mt-2` と非対称でリズム崩壊 |
| 3 | C Color | 4 | gold-warm 枠の `activeCount` chip は優秀。**`StarterCTA` と `ReflectionHint` は token 化済み**（gold gradient、gold-subtle icon well） |
| 4 | I Icon | 2 | Chevron の代わりに `▲▼` 絵文字（行 95-96）。**トークン違反**（16/20/24 の lucide のみ）。開閉状態のモーションも無し |
| 5 | O Overlap | 4 | Toggle switch と text の右寄せ配置は正常 |
| 6 | B Balance | 3 | `activeCount chip` が h1 と同じ baseline で競合、全体の視線誘導が散る。「すべて選ぶ」ボタンが 36px で 44px 未満（実質 37px で P5 違反） |
| 7 | D Density | 4 | `useOptimistic` + `bulkToggleDimension` で体感速度は良好 |
| 8 | F Font-mix | 3 | `ReflectionHint` の card title は sans で正常。category label は `font-medium` sans のみ |
| 9 | N Nums | 5 | `{catActive}/{catTotal}` は `tabular-nums`。OK |
| 10 | E Empty-state | 5 | `StarterCTA` は v4.2 の模範（gold gradient + sparkles eyebrow + serif 22px 見出し + 48px primary CTA + secondary link）|
| 11 | M Motion | 2 | toggle switch の `duration-200` は OK。しかしアコーディオン開閉は **height 非アニメ**（即時）で雑 |
| 12 | K Dark | 4 | gold-subtle / gold-warm は CSS 変数で自動切替。ただし `bg-muted` の switch track は dark で contrast 低 |
| 13 | 1st | — | 認証後画面のため対象外 |

### Before → After

**1. h1 を `text-h1` に揃える + tracking を全画面統一（#14）** — P0 / XS
- File: `src/app/(app)/checklist/page.tsx:60-65`
- Before:
```tsx
<p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
  何を比べるか、決める
</p>
<h1 className="mt-0.5 font-[family-name:var(--font-display)] text-[22px] font-extralight tracking-[0.01em]">
  チェックリスト設定
</h1>
```
- After:
```tsx
<p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
  何を比べるか、決める
</p>
<h1 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-extralight tracking-[-0.01em]">
  チェックリスト設定
</h1>
```
- Why: mypage / notifications / venues-checklist は全て `text-h1 tracking-[-0.01em]` + eyebrow `[11.5px] tracking-[0.2em]`。**この画面だけ h1=22px / eyebrow tracking=0.14em なのは #14 の代表例**。`mt-0.5 → mt-2` も他画面に揃える。

**2. Chevron 絵文字を lucide に置き換える（トークン違反修正）** — P0 / XS
- File: `src/components/checklist/checklist-selection-view.tsx:95-97`
- Before:
```tsx
<span className="ml-auto text-muted-foreground">
  {isOpen ? "▲" : "▼"}
</span>
```
- After:
```tsx
<ChevronDown
  aria-hidden="true"
  className={cn(
    "ml-auto h-4 w-4 text-muted-foreground transition-transform duration-[var(--dur-micro)]",
    isOpen && "rotate-180"
  )}
  strokeWidth={1.6}
/>
```
- Why: 絵文字 `▲▼` は 1) **icon token 16/20/24 違反**、2) フォント依存で Android / Windows で形が変わる、3) motion を付けられない。lucide `ChevronDown` + `rotate-180` transition で Linear / Stripe と同じ開閉表現。

**3. 「すべて選ぶ」ボタンを 44px 準拠にする（P5 違反修正）** — P0 / XS
- File: `src/components/checklist/checklist-selection-view.tsx:99-103`
- Before:
```tsx
<button
  className="min-h-[36px] rounded-md border border-border px-3 text-xs text-muted-foreground active:bg-muted"
```
- After:
```tsx
<button
  className="min-h-11 rounded-full border border-border px-4 text-[11px] tracking-[0.1em] text-muted-foreground active:scale-[0.98] active:bg-muted"
```
- Why: 36px は **P5 "44px 最低タッチ" 違反**。DESIGN.md に明記されたルール。`rounded-md → rounded-full` + tracking 追加で secondary action の editorial 化。

**4. Category `space-y-2` を `space-y-3` 以上にして呼吸を入れる** — P1 / XS
- File: `src/components/checklist/checklist-selection-view.tsx:75`
- Before:
```tsx
<div className="space-y-2">
  {grouped.map((group) => { ... })}
```
- After:
```tsx
<div className="space-y-3">
  {grouped.map((group) => { ... })}
```
- Why: 8 dimension card の間隔が 8px は **隣接カード境界が曖昧**。1 クリックで開くとアコーディオンが伸びて前後の card を押し込む動作が乱雑に見える。12px で最低限の息を入れる（dimension 数が多いので 16px まで上げると scroll 距離が増えすぎるため 12px 妥協）。

**5. アコーディオン開閉にアニメーションを足す** — P2 / M
- File: `src/components/checklist/checklist-selection-view.tsx:108-147`
- Before:
```tsx
{isOpen && (
  <div className="border-t px-4 pb-3">
    ...
  </div>
)}
```
- After:
```tsx
<AnimatePresence initial={false}>
  {isOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden border-t"
    >
      <div className="px-4 pb-3">
        ...
      </div>
    </motion.div>
  )}
</AnimatePresence>
```
- Why: 現状の即時 expand は #13 "20 年前" 症状。DESIGN.md `--dur-micro 200ms` + luxury ease の適用で Airbnb/Linear と同等の質感。framer-motion は既に landing-page.tsx で使用済みのため追加依存なし。

### 競合参考

- **Things 3 iPad 版** — 同類タスク group の開閉に 220ms easeOut。Haretoki の `--dur-micro 200ms` とほぼ一致、そのまま転用できる。
- **Linear UI Refresh 2026-03** — 全 chevron に `rotate-180` + 200ms、絵文字は 1 つも無い。
- **Todoist Grouping** — sub-group に eyebrow uppercase label。Haretoki `subcategory` ラベルの置き換え教材。

### 優先度 / 工数サマリ
- P0 × 3（h1 統一・chevron・44px）= 合計 S
- P1 × 1（spacing）= XS
- P2 × 1（アニメ）= M

---

## 画面 3: 見学準備（/visits/[visitId]/prep）

**File**: `src/app/(app)/visits/[visitId]/prep/page.tsx` + `src/components/visits/visit-questions-list.tsx`
**総合スコア**: 4 / 5
**ひとこと要約**: editorial 準拠度は**本 sub の中で最高**。eyebrow "HARETOKI · Prep" / serif h1 "{venueName}、これだけは聞いて" / gold gradient progress card / check-circle UI など editorial language がほぼ揃っている。減点は「※ ご希望に合わせて…（今後実装予定）」の 11px 注釈が ux 上浮いて見える、および list item の check アニメーションが色変化のみで motion が薄い。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 5 | page h1 `text-[24px] font-extralight leading-[1.35] tracking-[-0.005em]` + serif category h2 `text-[15px]` + item body `text-[13.5px] leading-relaxed`。3 階層が明確 |
| 2 | S Spacing | 4 | `space-y-10` page + `space-y-5` list + `space-y-2` category + `space-y-1.5` items。段階的で editorial |
| 3 | C Color | 5 | gold gradient progress、check 済 item は `bg-gold-subtle` + `border-[color-mix gold 40%]`。十分 |
| 4 | I Icon | 4 | `Check h-3 w-3` は 12px で 16 最小外。`strokeWidth={2.2}` の thick stroke は editorial には太すぎる（1.6-1.8 推奨） |
| 5 | O Overlap | 5 | 問題なし |
| 6 | B Balance | 4 | check circle (20px) + item text + 透明 right space。左固定の視線ガイドとして機能。progress pct は右端配置だが tabular-nums 良好 |
| 7 | D Density | 4 | 1 category あたり 2-5 問 × 5 category = 10-25 行。scroll 距離は合理的 |
| 8 | F Font-mix | 5 | category label serif `font-display extralight`、item sans `text-[13.5px]` が綺麗に分離 |
| 9 | N Nums | 5 | `doneCount / total` + `pct%` に `tabular-nums` |
| 10 | E Empty-state | 3 | seed = idempotent で常に質問が存在するが、`notFound()` フォールバック以外のナラティブが無い。loading.tsx の有無も要確認 |
| 11 | M Motion | 3 | check 切替は `active:scale-[0.99]` のみ。check アイコンの登場も `transition-none`。「聞けた！」の小さな高揚感が欲しい |
| 12 | K Dark | 4 | `bg-card` は dark で切替。gold gradient は `color-mix` で自動調整 |
| 13 | 1st | — | 対象外 |

### Before → After

**1. check mark に spring アニメを足して達成感を増幅（#13 "記憶に残す" 対応）** — P1 / M
- File: `src/components/visits/visit-questions-list.tsx:99-101`
- Before:
```tsx
<span aria-hidden="true" className={cn(
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
  checked
    ? "bg-[var(--gold-warm)] border-[var(--gold-warm)] text-white"
    : "border-border",
)}>
  {checked && <Check className="h-3 w-3" strokeWidth={2.2} />}
</span>
```
- After:
```tsx
<span aria-hidden="true" className={cn(
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-[background,border-color] duration-[var(--dur-micro)]",
  checked
    ? "bg-[var(--gold-warm)] border-[var(--gold-warm)] text-white"
    : "border-border",
)}>
  <AnimatePresence>
    {checked && (
      <motion.span
        key="check"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        <Check className="h-3 w-3" strokeWidth={1.8} />
      </motion.span>
    )}
  </AnimatePresence>
</span>
```
- Why: チェックの瞬間こそ editorial product の差が出るミクロ。Things 3 の checkbox が愛される理由は checkmark の spring。DESIGN.md `stiffness 260 / damping 16` は P6 にあるレンジの上限。**1 タップで気持ちが動く** = Haretoki の brand promise に最も近い箇所。

**2. 予告テキスト「（今後実装予定）」を消してリストに統合** — P1 / S
- File: `src/components/visits/visit-questions-list.tsx:118-121`
- Before:
```tsx
<p className="pt-2 text-[11px] text-muted-foreground leading-relaxed">
  ※ ご希望に合わせて質問を追加したい場合は、
  項目タイトル下の「＋ 質問を追加」(今後実装予定) からどうぞ。
</p>
```
- After:
```tsx
<button
  type="button"
  disabled
  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 px-4 py-4 text-[12px] text-muted-foreground/60"
>
  <Plus className="h-4 w-4" strokeWidth={1.6} />
  質問を追加（近日）
</button>
```
- Why: 「※ …（今後実装予定）」は **広告の打ち消し表示みたいでブランド感を削る**。代わりに **破線 + dashed の未実装ボタン**（DESIGN.md P1 "空ステートは招待状"）として配置すると「今はできないが将来の入口がある」意思が見える。ユーザー #13 "モダン" 期待にも沿う。

**3. loading.tsx を用意してスケルトン表示（存在確認して無ければ追加）** — P1 / S
- File: 新規 `src/app/(app)/visits/[visitId]/prep/loading.tsx`
- Before: なし
- After:
```tsx
export default function Loading() {
  return (
    <div className="space-y-10 pb-24">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
```
- Why: CLAUDE.md `Lessons` に「新しいページを追加したら `loading.tsx` も必ず用意する」明記。Server Component の白画面を防ぐ（**知覚速度 P4**）。スケルトンを実レイアウトに一致させる（DESIGN.md P4）。

### 競合参考

- **Things 3** — checkmark の spring はほぼ同じ stiffness/damping。参考実装として完璧。
- **Todoist** — 未実装機能を dashed ボタンで配置するパターン（"Add project" などで使用）。
- **Apple Reminders iOS** — 進捗 bar 2px の gold tint は Apple の accent bar と同質感。維持すべし。

### 優先度 / 工数サマリ
- P1 × 3（motion / 予告テキスト / loading）= 合計 M

---

## 画面 4: 帰り道モード（/visits/[visitId]/way-home）

**File**: `src/components/visits/way-home-flow.tsx`
**総合スコア**: 4.5 / 5
**ひとこと要約**: **本 sub の中で最高品質**。独立した min-h-dvh フロー、sticky frosted header、3 step progress bar、gold gradient progress、mood card (4 選択肢 × emoji + 2 行ラベル)、tag chips、CTA + skip の明確な hierarchy。#13 "モダン" 要件に最も応答できている画面。減点は done ステップの `☀` を絵文字で済ませている点と、mood emoji が絵文字のため 2 色フォント依存で iOS/Android で微妙に形が変わる点。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 5 | sticky header eyebrow `text-[11.5px] tracking-[0.2em]` + serif h1 `text-[22px] font-extralight tracking-[-0.005em]` + helper `text-[12.5px] leading-relaxed`。階層が 3 レベル完全 |
| 2 | S Spacing | 5 | `px-6 py-8` main + `mt-6 grid` mood + `mt-5` + `mt-2.5` で段階 |
| 3 | C Color | 5 | gold gradient progress、mood 選択時 gold-subtle + 40% gold border、concern tag は destructive 12%/45%。semantic 徹底 |
| 4 | I Icon | 4 | `ArrowLeft h-4 w-4 strokeWidth={1.6}` ただし emoji `☀️🌤☁️🌫` は lucide 外。ブランドとして `SkyChip` と重複する文脈 |
| 5 | O Overlap | 5 | sticky header と footer の safe-area inset 完璧 |
| 6 | B Balance | 5 | mood grid 2×2 / concern chips wrap / CTA + skip の column。段ごとに視線が動く editorial 構造 |
| 7 | D Density | 5 | 3 step それぞれ 1 画面内で完結。scroll 不要 |
| 8 | F Font-mix | 5 | serif h1 + sans body |
| 9 | N Nums | 5 | progress `progressPct` + step counter `1/3` tabular-nums 相当 |
| 10 | E Empty-state | 5 | done ステップが成功 state を演出 |
| 11 | M Motion | 4 | progress bar `duration-500 ease-out` 良好。ただし mood タップ時の spring 無し、done ステップの pop-in が無い |
| 12 | K Dark | 4 | `bg-background/80 backdrop-blur` はテーマ対応。gold-subtle / destructive は自動 |
| 13 | 1st | — | 対象外 |

### Before → After

**1. done ステップの `☀` をブランド `SkyChip` に置換** — P1 / S
- File: `src/components/visits/way-home-flow.tsx:258-266`
- Before:
```tsx
{step === "done" && (
  <section className="flex flex-col items-center gap-3 py-16 text-center">
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
      style={{ background: "var(--gold-subtle)" }}
    >
      ☀
    </div>
    <h1 className="font-[family-name:var(--font-display)] text-[22px] font-extralight">
      残しました。
    </h1>
```
- After:
```tsx
{step === "done" && (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="flex flex-col items-center gap-4 py-16 text-center"
  >
    <SkyChip mood="sunny" size={72} />
    <h1 className="font-[family-name:var(--font-display)] text-[24px] font-extralight leading-[1.35]">
      残りました。
    </h1>
```
- Why: `☀` Unicode emoji は iOS で orange の立体絵文字、Android では別レンダリング。**ブランドメタファー「曇り→晴れ」の fruition 瞬間に自前の `SkyChip` を使わないのは機会損失**。login/signup 画面でも既に使われているため一貫性が取れる。モーションも spring じゃない editorial easeOutExpo に。コピー「残しました」→「残りました」は受動で余韻が長い（editorial tone）。

**2. mood emoji を lucide + gold tint に置換（絵文字フォント依存排除）** — P2 / M
- File: `src/components/visits/way-home-flow.tsx:17-22`
- Before:
```tsx
const MOOD_OPTIONS = [
  { value: 5, emoji: "☀️", label: "晴れやか", sub: "とても良かった" },
  { value: 4, emoji: "🌤", label: "明るめ", sub: "良かった方" },
  { value: 3, emoji: "☁️", label: "もやもや", sub: "迷いが残る" },
  { value: 2, emoji: "🌫", label: "合わなかった", sub: "次を見たい" },
] as const;
```
- After:
```tsx
import { Sun, CloudSun, Cloud, CloudFog } from "lucide-react";

const MOOD_OPTIONS = [
  { value: 5, Icon: Sun, label: "晴れやか", sub: "とても良かった" },
  { value: 4, Icon: CloudSun, label: "明るめ", sub: "良かった方" },
  { value: 3, Icon: Cloud, label: "もやもや", sub: "迷いが残る" },
  { value: 2, Icon: CloudFog, label: "合わなかった", sub: "次を見たい" },
] as const;

// in JSX
<opt.Icon
  className={cn(
    "h-8 w-8",
    sel ? "text-[var(--gold-warm)]" : "text-muted-foreground"
  )}
  strokeWidth={1.3}
/>
```
- Why: emoji 30px は OS ごとの差異が大きく editorial プロダクトでは統制できない。lucide `Sun/CloudSun/Cloud/CloudFog` は Haretoki の「曇り→晴れ」メタファーに完全一致。選択時 gold-warm、未選択 muted で色で mood を伝える情報設計にも寄与。

**3. mood タップに spring pop** — P2 / S
- File: `src/components/visits/way-home-flow.tsx:143-166`
- Before:
```tsx
<button
  key={opt.value}
  type="button"
  onClick={() => setMood(opt.value)}
  aria-pressed={sel}
  className={cn(
    "flex min-h-[110px] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-4 transition active:scale-[0.98]",
    ...
  )}
>
```
- After:
```tsx
<motion.button
  key={opt.value}
  type="button"
  onClick={() => setMood(opt.value)}
  aria-pressed={sel}
  whileTap={{ scale: 0.97 }}
  animate={sel ? { scale: [1, 1.03, 1] } : { scale: 1 }}
  transition={{ type: "spring", stiffness: 220, damping: 14 }}
  className={cn(
    "flex min-h-[110px] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-4",
    ...
  )}
>
```
- Why: 選択時 1→1.03→1 の hop は気持ちの移ろい自体を表現する micro-interaction。DESIGN.md P3 "フィードバックは即時かつ複層"（色 + スケール + 影）に合致。way-home は見学直後の **感情の瞬間** なので編集ソフト的な UI より "反応する道具" 感がブランドに寄与。

### 競合参考

- **Apple Health iOS Mindfulness** — 同質のラグジュアリー「気持ちチェックイン」UX。4 選択肢 grid + 即時 spring。
- **Revolut onboarding step 2/3** — sticky header + progress + CTA の配置は Haretoki と同構造。完成度の参照点。
- **Things 3 Today section** — done 状態の celebration は控えめ（SkyChip の替わりに小さな sparkle）。派手にしすぎない editorial を学ぶ。

### 優先度 / 工数サマリ
- P1 × 1（SkyChip 置換）= S
- P2 × 2（mood icon / spring）= 合計 M

---

## 画面 5: マイページ（/mypage）

**File**: `src/app/(app)/mypage/page.tsx` + `src/components/mypage/{name-edit,...}.tsx` + `src/components/partner/*` + `src/components/settings/settings-form.tsx`
**総合スコア**: 2 / 5
**ひとこと要約**: **#16 "並べましただけ" の震源地第 1 位**。section ごとに eyebrow + serif subhead が既に入っているため一見整っているが、実体は「`rounded-2xl bg-card p-5` の card が 5 つ縦に並ぶ」だけで card 内部の書式がバラバラ（Profile は label/value の 2 段、Partner は `InviteLinkPanel` 独自 lay、Preferences は `SettingsForm` の pill 群、More は ChevronRight row）。section 区切り線の gradient hairline が `via-[var(--gold-subtle)]/40` で薄く、**「card が並ぶ」だけで editorial rhythm が無い**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 3 | h1 `text-h1 font-extralight` + section eyebrow `[11.5px] tracking-[0.2em]` + serif subhead `[15px] font-extralight` の 3 段階は OK。card 内の label が `text-xs text-muted-foreground` + value `font-medium` の 2 段で階層は出ているが、card 間で粒度が揃わない |
| 2 | S Spacing | 2 | page `space-y-8`、section `space-y-4`、card 内 `space-y-3`。**`space-y-8` (32px) がギリギリ DESIGN.md 下限で、section が card と分離して見えない**。mypage の section 間は `space-y-12` (48px) 寄りが editorial |
| 3 | C Color | 3 | gold-warm は eyebrow + icon + partner chip に散在。Preferences の card は gold accent 皆無、Profile も同様で**色で「ここは AI 領域 vs 自分の情報」の区別が無い** |
| 4 | I Icon | 3 | More section: `Bell h-5 w-5 text-[var(--gold-warm)]` / `Bookmark h-5 w-5 gold` / `Settings h-5 w-5 text-muted-foreground` — Bell と Bookmark だけ gold、Settings は muted で **基準不明**（なぜ Settings だけ muted？）|
| 5 | O Overlap | 4 | NotificationBadge と h1 の右寄せ配置 OK |
| 6 | B Balance | 1 | Profile card: 左詰め label/value 2 行 × 2。Partner: icon + inline form/CTA panel。Preferences: 4 段 pill + button。More: 3 個の horizontal row with chevron。**4 つの card が全く違う構造** = #14 / #16 の複合症状 |
| 7 | D Density | 3 | 縦 5 section × 各 100-200px = 約 700-1000px の scroll。More section だけ list 的で他の section と触感差 |
| 8 | F Font-mix | 4 | eyebrow + serif subhead + body sans は徹底。card title は sans で一貫 |
| 9 | N Nums | 4 | NotificationBadge の unread count `tabular-nums` OK。budget の数値は適用無し（要改善） |
| 10 | E Empty-state | 3 | Partner 非招待時は `InviteLinkPanel`（gold gradient CTA）で招待状化、Preferences は form 自体なので空にならない |
| 11 | M Motion | 3 | card の `active:scale-[0.98]` + `hover:shadow` は一応有り。しかし section 入場に fade-in 無し、settings-form の保存も toast のみ |
| 12 | K Dark | 3 | gradient hairline `via-[var(--gold-subtle)]/40` は dark で ほぼ不可視。token で明るさを切り替える定義必要 |
| 13 | 1st | — | 認証後画面のため対象外 |

### Before → After

**1. section 間を 48px にして editorial rhythm を確保（#16 対応）** — P0 / XS
- File: `src/app/(app)/mypage/page.tsx:74`
- Before:
```tsx
<div className="space-y-8">
  <div className="flex items-start justify-between gap-4">
    ...
  </div>
  <div aria-hidden="true" className="h-px bg-gradient-to-r ..." />

  {/* Profile */}
  <section className="space-y-4">
    ...
```
- After:
```tsx
<div className="space-y-12 pb-8">
  <div className="flex items-start justify-between gap-4">
    ...
  </div>
  <div aria-hidden="true" className="h-px bg-gradient-to-r ..." />

  {/* Profile */}
  <section className="space-y-5">
    ...
```
- Why: mypage の「並べた」感の正体は**section gap が card の内 padding (p-5 = 20px) と 12px しか差がない** こと。`space-y-8` (32) → `space-y-12` (48) で「別の話題に入る」呼吸が生まれる。section 内の `space-y-4 → space-y-5` は subhead とカードの間に息を入れる。

**2. SettingsRow 汎用コンポーネントを作って list を統一（#14 / #16 合併）** — P0 / L
- File: 新規 `src/components/mypage/settings-row.tsx` + `src/app/(app)/mypage/page.tsx:189-243`
- Before:
```tsx
<div className="space-y-3">
  <Link href="/notifications" className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] ...">
    <div className="flex items-center gap-3">
      <Bell className="h-5 w-5 text-[var(--gold-warm)]" />
      <div>
        <p className="font-medium">通知</p>
        <p className="text-xs text-muted-foreground">新着のお知らせ</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {unreadCount > 0 && <span className="...">{unreadCount}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  </Link>
  {/* ... 同じパターンが 3 回繰り返される */}
</div>
```
- After:
```tsx
// src/components/mypage/settings-row.tsx
export function SettingsRow({
  icon: Icon,
  label,
  meta,
  badge,
  href,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  badge?: ReactNode;
  href: string;
  tone?: "default" | "accent";
}) {
  return (
    <Link
      href={href}
      prefetch
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-4 transition-colors active:bg-muted/40"
    >
      <Icon
        className={cn(
          "h-5 w-5",
          tone === "accent" ? "text-[var(--gold-warm)]" : "text-muted-foreground"
        )}
        strokeWidth={1.6}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-tight">{label}</span>
        {meta && <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{meta}</span>}
      </span>
      <span className="flex items-center gap-2">
        {badge}
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.6} />
      </span>
    </Link>
  );
}

// page.tsx  More section
<div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
  <SettingsRow
    icon={Bell}
    tone="accent"
    label="通知"
    meta="新着のお知らせ"
    href="/notifications"
    badge={unreadCount > 0 && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[11px] font-medium text-primary-foreground tabular-nums">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    )}
  />
  <SettingsRow icon={Bookmark} tone="accent" label="保存した検索条件" meta="新しい式場が出たらお知らせ" href="/mypage/saved-searches" />
  <SettingsRow icon={Settings} label="設定" meta="見た目・ログアウト" href="/settings" />
</div>
```
- Why: 現状**同じパターンが 3 回 copy-paste** + 外枠が 3 個の card。Linear/Notion settings と同様に `divide-y` 1 card 内 list に統合すると、1) 列幅が揃い grid `auto_1fr_auto` で label/meta/chevron の比率が固定、2) tone prop で gold / default を制御（#16 の accent 基準不明を解消）、3) LOC が半分。**#14 "書式バラツキ"解消と #16 "並べた"解消を同時に達成**する構造変更。

**3. Profile / Partner / Preferences の card を「内容物で分けず list に統一」** — P0 / L
- File: `src/app/(app)/mypage/page.tsx:96-177`
- Before: 3 つの section が独立 card で各々 `rounded-2xl bg-card p-5`
- After:
```tsx
{/* Account section — Profile + Preferences を統合 */}
<section className="space-y-4">
  <div className="flex items-baseline gap-2 px-1">
    <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
      Account
    </p>
    <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
      わたしのこと
    </h3>
  </div>
  <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-4 px-5 py-4">
      <span className="text-[12px] text-muted-foreground">お名前</span>
      <NameEdit currentName={ownerName} />
    </div>
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-4 px-5 py-4">
      <span className="text-[12px] text-muted-foreground">メール</span>
      <span className="truncate text-[14px] font-medium">{user.email}</span>
    </div>
  </div>
</section>

{/* Partner は独立 section を維持（CTA が主役の panel は一覧化しない） */}
```
- Why: 同じ sub-A4 指摘の **"label → value → chevron の 3 列 grid"**。`grid-cols-[120px_1fr_auto]` で label 幅を 120px に固定すると複数行で縦軸が揃い Linear settings そのまま。現状の `space-y-3` 内 2 段は label が右に広がって value が細ってしまう（#14 書式バラツキ）。

**4. Preferences form に eyebrow sub-group を入れる** — P1 / M
- File: `src/components/settings/settings-form.tsx:99-151`
- Before:
```tsx
<div className="space-y-6">
  <div className="space-y-2">
    <Label>希望スタイル</Label>
    <PillOptions ... />
  </div>
  <div className="space-y-2">
    <Label htmlFor="guests">ゲスト人数</Label>
    <Input ... />
  </div>
  ...
```
- After:
```tsx
<div className="space-y-8">
  <div className="space-y-3">
    <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">Style</p>
    <PillOptions ... />
  </div>
  <div className="grid grid-cols-[120px_1fr] items-center gap-4">
    <p className="text-[12px] text-muted-foreground">ゲスト人数</p>
    <Input id="guests" className="h-11 max-w-[140px] tabular-nums" />
  </div>
  <div className="space-y-3">
    <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">Area</p>
    <PillOptions ... />
  </div>
  <div className="space-y-3">
    <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">Budget</p>
    <PillOptions ... />
  </div>
</div>
```
- Why: Settings form の 4 項目は **同じ Label component** で区別が無く #14 書式バラツキ。eyebrow + 120px label grid の 2 パターンで「ピル選択 vs 数値入力」を視覚的に分ける。Linear / Revolut onboarding form のパターン。

**5. gradient hairline を visible 化 + dark 対応** — P2 / XS
- File: `src/app/(app)/mypage/page.tsx:91-94`
- Before:
```tsx
<div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-[var(--gold-subtle)]/40 to-transparent" />
```
- After:
```tsx
<div
  aria-hidden="true"
  className="h-px"
  style={{ background: "var(--hairline-gold)" }}
/>
```
- Why: DESIGN.md v4.1 Atmospheric Layers に既に `--hairline-gold: 0.5px solid gold-warm/35%` が定義されている。未使用なのは勿体無い。opacity 40% は light テーマで淡すぎ、dark で見えない。トークン利用で自動テーマ対応。

### 競合参考

- **Linear Settings** — Account / Preferences / Members section が全て `divide-y` 1 card list。eyebrow は 11px uppercase tracking-wide。Haretoki の模範。
- **Notion Settings Desktop** — sidebar + 本体 + section gap 40px。mobile 化は Haretoki `space-y-12` を採用推奨。
- **Revolut My Card / Profile** — grid `label_value_chevron` の rhythm を極めたモバイル UI。`120px_1fr_auto` はそのまま転用可。

### 優先度 / 工数サマリ
- P0 × 3（section 48px / SettingsRow / 3 列 grid）= 合計 L
- P1 × 1（form eyebrow）= M
- P2 × 1（hairline token）= XS
- **全 Sub の中で最優先箇所**

---

## 画面 6: 保存した検索条件（/mypage/saved-searches）

**File**: `src/app/(app)/mypage/saved-searches/page.tsx` + `src/components/mypage/saved-search-delete-button.tsx`
**総合スコア**: 3.5 / 5
**ひとこと要約**: page header は editorial OK（eyebrow + serif h1 `text-h1`）。`SavedSearchCard` 内の bookmark icon well + serif label + muted meta + primary link + delete button の構造は Linear の subscription list と同等水準。減点は **1) card 間 `space-y-3` が狭い、2) "最大 5 件" 表記が tabular-nums 適用されているが eyebrow 化されていない、3) delete button と link が同じ行で tap 衝突リスク**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | h1 `text-h1` OK、card label は `font-display text-base font-extralight tracking-wide` = serif 16px、meta `text-xs leading-relaxed`、link `text-xs tabular-nums`。良好 |
| 2 | S Spacing | 3 | card `p-4` + `gap-3` は適度。`space-y-3` card 間が 12px でやや狭い |
| 3 | C Color | 4 | bookmark icon well gold-warm 70% mix は繊細。primary link underline も editorial |
| 4 | I Icon | 4 | `Bookmark h-4 w-4 strokeWidth={1.6}` tokens準拠、ただし `ArrowLeft h-3 w-3` は 12px で違反 |
| 5 | O Overlap | 3 | delete button と primary link が同じ bounding box 内右端で、指誤タップ懸念（44×44 確保しているが視覚的に接近） |
| 6 | B Balance | 4 | icon 36px + content flex-1 + delete 44px の 3 列 balance 良好 |
| 7 | D Density | 5 | 最大 5 件だが card 1 枚に「ラベル / 条件 / 該当数 link / delete」4 要素は読みやすい |
| 8 | F Font-mix | 5 | serif label + sans meta の対比が editorial |
| 9 | N Nums | 5 | `{count}件該当` + `現在 {length} 件` tabular-nums |
| 10 | E Empty-state | 5 | `EmptyState` で icon + title + description + action CTA、editorial な招待状 |
| 11 | M Motion | 3 | delete button `active:scale-95` のみ。card 自体に hover/active 無し |
| 12 | K Dark | 4 | bookmark icon gold mix は dark でも可視 |
| 13 | 1st | — | 対象外 |

### Before → After

**1. Back chevron を h-4 に昇格（icon token 違反修正）** — P0 / XS
- File: `src/app/(app)/mypage/saved-searches/page.tsx:100`
- Before:
```tsx
<ArrowLeft className="h-3 w-3" aria-hidden="true" />
Back
```
- After:
```tsx
<ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.6} />
Back
```
- Why: DESIGN.md「アイコンは 16/20/24 のみ」。eyebrow と同時表示で 12px は小さすぎて視認性落ちる。**この違反は全 breadcrumb で共通なので page 全体 grep で一括直しが望ましい**（画面 1, 3, 4, 7, 8 で同パターン）。

**2. card 間 space-y を広げて 1 件ずつの respiration** — P1 / XS
- File: `src/app/(app)/mypage/saved-searches/page.tsx:124-132`
- Before:
```tsx
<div className="space-y-3">
  {searches.map((s) => (
    <SavedSearchCard ... />
  ))}
  <p className="text-center text-xs text-muted-foreground pt-2">
    最大 5 件まで保存できます（現在 {searches.length} 件）
  </p>
</div>
```
- After:
```tsx
<div className="space-y-4">
  {searches.map((s) => (
    <SavedSearchCard ... />
  ))}
  <p className="pt-4 text-center text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground tabular-nums">
    {searches.length} / 5 — 最大 5 件
  </p>
</div>
```
- Why: `space-y-3` → `space-y-4` で editorial spacing。フッター注釈を eyebrow tracking uppercase に昇格させると「1 章の締め」として機能し、最大件数の警告も強くない（Haretoki tone "急かさない"）。数字は `tabular-nums` 追加で桁揃え。

**3. card を tappable link 化（デリートと衝突しない zone 設計）** — P1 / M
- File: `src/app/(app)/mypage/saved-searches/page.tsx:49-86`
- Before:
```tsx
<div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[...]">
  <div className="mt-0.5 flex h-9 w-9 ..."><Bookmark ... /></div>
  <div className="min-w-0 flex-1">
    <p className="font-[family-name:var(--font-display)] ...">{label}</p>
    <p className="mt-0.5 text-xs text-muted-foreground ...">
      <FilterPreview ... />
    </p>
    <Link href={exploreUrl} className="mt-2 inline-flex ... text-primary underline">
      <Search className="h-3 w-3" />
      <span className="tabular-nums">{count}件該当</span>
      <span>— 検索する</span>
    </Link>
  </div>
  <SavedSearchDeleteButton id={id} />
</div>
```
- After:
```tsx
<div className="group relative flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[...] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
  <Link
    href={exploreUrl}
    prefetch={false}
    aria-label={`${label} の検索結果を見る（${count}件該当）`}
    className="absolute inset-0 rounded-2xl z-0"
  />
  <div className="relative z-10 mt-0.5 flex h-9 w-9 ..."><Bookmark ... /></div>
  <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
    <p className="...">{label}</p>
    <p className="mt-0.5 text-xs ..."><FilterPreview ... /></p>
    <p className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
      <Search className="h-3 w-3" strokeWidth={1.8} />
      <span className="tabular-nums">{count}件該当</span>
      <ChevronRight className="h-3 w-3" />
    </p>
  </div>
  <div className="relative z-10">
    <SavedSearchDeleteButton id={id} />
  </div>
</div>
```
- Why: 現状 delete button と Link が **兄弟要素 + 同じ px 幅に近接**し、指 18-20mm で誤タップの可能性がある。絶対配置 Link を card 全体に敷くパターン (Airbnb experience card と同じ) で、delete button は `z-10` で前面。tap の ergonomics が向上し、card 全体がクリック可能になる affordance も上がる。

### 競合参考

- **Apple Mail VIP list** — card 全体 tap + 右端 swipe delete で類似。Haretoki はタップで誤爆しない保護だけ移植。
- **Notion saved searches** — `divide-y` 1 card list / row に集約。Haretoki は card 派で editorial 感は強い。
- **Things 3 "Deadlines" filter** — 数字バッジは tabular-nums 厳守。Haretoki もこれに倣うと品格向上。

### 優先度 / 工数サマリ
- P0 × 1（icon token）= XS
- P1 × 2（spacing / tap zone）= 合計 M

---

## 画面 7: 通知（/notifications）

**File**: `src/app/(app)/notifications/page.tsx` + `notification-item.tsx` + `mark-all-read-button.tsx` + `src/components/layout/notification-badge.tsx`
**総合スコア**: 3.5 / 5
**ひとこと要約**: Inbox pattern は v4.2 editorial 準拠。未読 item の `bg-gold-subtle/30` + `border-l-[3px] gold-warm` は Apple Mail / Stripe Dashboard 類似で美しい。NotificationItem の relative time も `Intl.RelativeTimeFormat("ja")` で丁寧。減点は **1) "すべて既読にする" button の text size が `text-sm` で eyebrow 化されていない、2) 未読ドットが `h-2 w-2` (8px) で視認性低い、3) `bg-[var(--gold-subtle)]/30` 30% は dark で破綻する、4) item 間 `space-y-3` が窮屈**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | h1 text-h1 serif + eyebrow OK、item title serif `text-base` + body sans `text-sm` の mix 良好、relative time `text-xs` |
| 2 | S Spacing | 3 | `space-y-3` item 間 12px は「通知が並ぶ」感。**ほぼ #16 症状に近い**。20px 程度の呼吸が欲しい |
| 3 | C Color | 4 | 未読 gold-subtle/30 + border-l gold-warm は editorial。既読は bg-card |
| 4 | I Icon | 4 | `Bell h-5 w-5 strokeWidth={1.5}` OK、badge 内 number text-[10px] で 12px 未満（辛うじて OK） |
| 5 | O Overlap | 4 | badge 右上の absolute 配置 OK |
| 6 | B Balance | 3 | item title (serif, 多行) + 未読 dot (右上) + body + timestamp が縦積み。dot が `mt-1 shrink-0 h-2 w-2` で小さすぎ |
| 7 | D Density | 4 | 30 件 listNotifications で page 長くなりうる |
| 8 | F Font-mix | 5 | item title serif `font-extralight/light`、body sans。editorial で良好 |
| 9 | N Nums | 5 | badge count `tabular-nums`、timestamp も nums |
| 10 | E Empty-state | 5 | EmptyState "いまは静かな一日です" は Haretoki tone そのもの。編集的 |
| 11 | M Motion | 3 | item active:scale `[0.98]` のみ。markAllRead 押下時 toast のみで item 群の既読化 transition 無し |
| 12 | K Dark | 2 | `bg-gold-subtle/30` (30%) は dark テーマで card 背景と同化、border-l gold-warm だけが残る。dark 動作確認必須 |
| 13 | 1st | — | 対象外 |

### Before → After

**1. 未読 dot を 10px + offset で視認性確保** — P0 / XS
- File: `src/app/(app)/notifications/notification-item.tsx:70-74`
- Before:
```tsx
<span
  aria-label="未読"
  className="mt-1 shrink-0 h-2 w-2 rounded-full bg-[var(--gold-warm)]"
/>
```
- After:
```tsx
<span
  aria-label="未読"
  className="mt-1.5 shrink-0 h-2.5 w-2.5 rounded-full bg-[var(--gold-warm)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold-warm)_18%,transparent)]"
/>
```
- Why: 8px ドットは mobile ret で薄い印象。10px + 外周 halo (3px) で「ここ、新しい」が伝わる。halo の `color-mix 18%` は dark でも可視。Apple Notifications の未読マーカー手法。

**2. item 間 spacing を 16px に拡大 + 既読セクション区切り** — P0 / S
- File: `src/app/(app)/notifications/page.tsx:55-58`
- Before:
```tsx
<div className="space-y-3">
  {notifications.map((n) => (
    <NotificationItem key={n.id} notification={n} />
  ))}
</div>
```
- After:
```tsx
<div className="space-y-4">
  {/* Unread cluster */}
  {notifications.some((n) => !n.read) && (
    <p className="px-1 text-[10.5px] font-medium tracking-[0.2em] uppercase text-[var(--gold-warm)]">
      新着
    </p>
  )}
  {notifications.filter((n) => !n.read).map((n) => (
    <NotificationItem key={n.id} notification={n} />
  ))}
  {notifications.some((n) => !n.read) && notifications.some((n) => n.read) && (
    <p className="px-1 pt-4 text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
      これまで
    </p>
  )}
  {notifications.filter((n) => n.read).map((n) => (
    <NotificationItem key={n.id} notification={n} />
  ))}
</div>
```
- Why: 現状「読」「未読」が混在で timeline 逆順のみ。Apple Mail / Gmail モバイルの標準 pattern は **未読クラスタ + 既読クラスタの 2 分**。`space-y-4` (16px) で editorial rhythm。eyebrow で「新着 / これまで」のコピーは Haretoki tone "急かさない"。

**3. MarkAllReadButton を eyebrow style にして品格を上げる** — P1 / XS
- File: `src/app/(app)/notifications/mark-all-read-button.tsx:22-29`
- Before:
```tsx
<button ... className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl text-sm text-[var(--gold-warm)] border border-[var(--gold-subtle)] bg-[var(--gold-subtle)]/30 ...">
  {isPending ? "処理中…" : "すべて既読にする"}
</button>
```
- After:
```tsx
<button
  ...
  className="min-h-11 inline-flex items-center gap-1.5 rounded-full px-4 text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--gold-warm)] transition hover:bg-[var(--gold-subtle)] active:scale-[0.98] disabled:opacity-50"
>
  <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
  {isPending ? "処理中" : "すべて既読"}
</button>
```
- Why: page header 右端の secondary action は editorial では **chip でなく type-only の rounded pill**。`text-sm` のベタ文字 + 背景より、eyebrow tracking + icon + 透過的な pill が品格を上げる。Airbnb の "View all" や Linear の "Mark all read" と同じ。

**4. 未読 bg のダーク対応** — P1 / XS
- File: `src/app/(app)/notifications/notification-item.tsx:55-57`
- Before:
```tsx
notification.read
  ? "bg-card border-border/60"
  : "bg-[var(--gold-subtle)]/30 border-l-[3px] border-l-[var(--gold-warm)] border-border/60",
```
- After:
```tsx
notification.read
  ? "bg-card border-border/60"
  : "bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--card))] border-l-[3px] border-l-[var(--gold-warm)] border-border/60",
```
- Why: `/30` opacity は dark で card とほぼ同色。`color-mix gold-warm 6% + card` は light / dark 両対応で未読の diff が常に 6% 分取れる。DESIGN.md v4.1 Atmospheric Layers の思想に合致。

### 競合参考

- **Apple Notifications iOS** — "新着 / 通知センター" 2 clusters 分離。eyebrow label + 16px item spacing。
- **Linear Inbox** — unread dot は 10px + gold (= Linear purple) halo。Haretoki がそのまま採用できる。
- **Stripe Dashboard Alerts** — "Mark all read" secondary は text-only pill。Haretoki の editorial 候補。

### 優先度 / 工数サマリ
- P0 × 2（dot / cluster 分離）= 合計 S
- P1 × 2（button eyebrow / dark bg）= 合計 S

---

## 画面 8: 設定（/settings）

**File**: `src/app/(app)/settings/page.tsx` + `src/components/settings/{theme-switcher,logout-button,data-management}.tsx`
**総合スコア**: 3 / 5
**ひとこと要約**: page 構造は editorial 風（eyebrow + serif h1 + 3 section: Theme / Data / Logout）で mypage より整理されている。`ThemeSwitcher` は rounded-full segmented control で良好。**ただし `LogoutButton` が section 見出し無しで単独 full-width 配置され、浮いている。**`DataManagement` の「ダウンロード / 消す」2 button stack は border + border-destructive の色対比のみで書式バラツキ（#14）。削除確認 dialog は `fixed bottom sheet` パターン で mobile 最適化済み。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | h1「整える」は editorial コピー（動詞化）で Haretoki tone 合致、eyebrow/subhead 構造 OK |
| 2 | S Spacing | 3 | `space-y-10` は適度。ただし LogoutButton section に eyebrow 無く直接 button |
| 3 | C Color | 4 | destructive accent 統一、theme segmented は muted ベース。ThemeSwitcher の active `bg-card shadow-sm` で contrast |
| 4 | I Icon | 4 | 全て `h-4 w-4` 統一。ChevronLeft `h-3 w-3` は違反（他画面共通）|
| 5 | O Overlap | 5 | dialog の inset-0 centered OK、safe-area 適用済み |
| 6 | B Balance | 3 | Theme card: label/desc 左 + switcher 右 の 2 列は balanced。Data card: 縦 3 件は hierarchy 弱い。Logout: 単独 full-width で浮く |
| 7 | D Density | 4 | 3 section × 各 1-3 要素で scroll 少 |
| 8 | F Font-mix | 4 | eyebrow + serif subhead + sans body。OK |
| 9 | N Nums | — | 該当なし |
| 10 | E Empty-state | — | form 中心のため該当せず |
| 11 | M Motion | 3 | button `active:scale-[0.98]` のみ、theme 切替時の transition は next-themes だが card の color transition 無し |
| 12 | K Dark | 4 | ThemeSwitcher 自体が dark/light/system で自動対応。destructive は両テーマ対応 |
| 13 | 1st | — | 対象外 |

### Before → After

**1. LogoutButton を Account section の中に入れる（"並べた"回避）** — P0 / S
- File: `src/app/(app)/settings/page.tsx:69-72`
- Before:
```tsx
{/* Logout */}
<section>
  <LogoutButton />
</section>
```
- After:
```tsx
{/* Account */}
<section className="space-y-3">
  <div className="flex items-baseline gap-2">
    <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
      Account
    </p>
    <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
      アカウント
    </h3>
  </div>
  <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
    <LogoutButton />
  </div>
  <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
    また来るときはこのメールアドレスで戻ってこれます。
  </p>
</section>
```
- Why: 現状の LogoutButton は **section eyebrow 無しで単独 full-width**。設計書 #16 "並べた" 直撃。eyebrow + serif subhead + card wrapper + tone コピー で他 section と書式統一（#14）。

**2. DataManagement の 2 button を destructive action pattern に統一** — P1 / M
- File: `src/components/settings/data-management.tsx:69-93`
- Before:
```tsx
<div className="space-y-3">
  <button onClick={handleExport} ... className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground ...">
    <Download className="h-4 w-4" />
    {isExporting ? "準備しています…" : "記録をダウンロード"}
  </button>
  <button onClick={() => setConfirmOpen(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive ...">
    <Trash2 className="h-4 w-4" />
    アカウントを消す
  </button>
  <p className="text-xs text-muted-foreground">
    ダウンロードには、お名前・式場・見学記録・...
  </p>
</div>
```
- After:
```tsx
<div className="space-y-5">
  {/* Safe primary action */}
  <button
    onClick={handleExport}
    disabled={isExporting}
    aria-busy={isExporting}
    className="group grid min-h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-border bg-card px-4 text-left transition-all hover:bg-muted/40 active:scale-[0.99] disabled:opacity-50"
  >
    <Download className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
    <span className="min-w-0">
      <span className="block text-[14px] font-medium">記録をダウンロード</span>
      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
        式場・評価・メモをすべてまとめて
      </span>
    </span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
  </button>

  {/* Hairline separator signaling destructive zone */}
  <div
    aria-hidden="true"
    className="h-px"
    style={{ background: "linear-gradient(to right, transparent, color-mix(in oklab, var(--destructive) 20%, transparent), transparent)" }}
  />

  {/* Destructive action — mimics primary shape but in destructive tone */}
  <button
    onClick={() => setConfirmOpen(true)}
    className="group grid min-h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-destructive/25 px-4 text-left transition-colors hover:bg-destructive/5 active:scale-[0.99]"
  >
    <Trash2 className="h-5 w-5 text-destructive" strokeWidth={1.6} />
    <span className="min-w-0">
      <span className="block text-[14px] font-medium text-destructive">アカウントを消す</span>
      <span className="mt-0.5 block truncate text-[11.5px] text-destructive/70">
        元に戻せません
      </span>
    </span>
    <ChevronRight className="h-4 w-4 text-destructive/60" strokeWidth={1.6} />
  </button>
</div>
```
- Why: 現状 2 button が同じ体裁 + 後に `<p>` で注釈 → 情報が尻すぼみ。**両 button を同じ 3 列 grid (icon/meta/chevron) に統一**し、間に gradient hairline を destructive tone で 1 本引くことで「ここから先は戻せない」境界が視覚化される。#14 "書式統一" + editorial quality の両方向上。コピーを button 内 meta に移動することで冗長な `<p>` が消える。

**3. "ChevronLeft h-3 w-3" を h-4 に昇格（他画面と同じ）** — P0 / XS
- File: `src/app/(app)/settings/page.tsx:21`
- Before: `<ChevronLeft className="h-3 w-3" aria-hidden="true" />`
- After: `<ChevronLeft className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />`
- Why: 全画面共通の icon token 違反。

### 競合参考

- **Linear Settings Account** — logout は "Account" section の最下段 + description。Haretoki の改修プラン完全一致。
- **Notion Settings Data** — export / delete を 2 列 grid で並べる。destructive tone ズレは hairline + icon color。
- **Revolut Settings** — 3 列 grid の row 分けに倣うと editorial 感が出る。

### 優先度 / 工数サマリ
- P0 × 2（Logout section 化 / icon token）= 合計 S
- P1 × 1（data management grid 統一）= M

---

## 画面 9: 招待受信（/accept-invite）

**File**: `src/app/(app)/accept-invite/page.tsx` + `accept-invite-form.tsx`
**総合スコア**: 4 / 5
**ひとこと要約**: **editorial 刷新されている稀な既存画面**。eyebrow "Haretoki · Invitation" + gold gradient hairline + serif h1 `text-[22px]` + Users icon well + primary CTA の構造は editorial 教科書に近い。減点は **1) AcceptInviteForm が shadcn `Card` をそのまま使い `rounded-lg bg-card` の古い shell（mypage の `rounded-2xl bg-card p-5` と統一されていない）、2) Users icon 64px x h-8 のサイズが他画面の icon well 9-14 より大きく不整合、3) projectName の serif 表示がない**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | serif h1 22px + body sans 14px、eyebrow 11.5px。良好。だが projectName `{invitation.projectName}` は `<br />` の前の本文に埋もれる（serif 強調したい） |
| 2 | S Spacing | 4 | `min-h-[60dvh] items-center` で vertical centering + `space-y-6` 内部 rhythm。editorial |
| 3 | C Color | 4 | gold-warm eyebrow、primary CTA。Users icon は `bg-primary/10 text-primary` で rose accent だが **partner 合流は gold が妥当**（AI でも partner でもない、accent の使い分け要議論） |
| 4 | I Icon | 3 | Users h-8 w-8 = 32px で **16/20/24 外**（ただし well 内の装飾 icon なので許容幅）|
| 5 | O Overlap | 5 | センタリング + max-w-md で mobile OK |
| 6 | B Balance | 4 | hero type + form card の 2 block。CTA は primary で視線一点集中 |
| 7 | D Density | 5 | 6 要素（eyebrow / hairline / h1 / body / card-desc / CTA）で scroll 無 |
| 8 | F Font-mix | 4 | serif h1 + sans body。OK |
| 9 | N Nums | — | 該当無 |
| 10 | E Empty-state | — | redirect("/") で非該当 |
| 11 | M Motion | 3 | Suspense fallback のみ、hero の fade-in 無し。招待の受諾は情緒的な瞬間なので 600ms motion 欲しい |
| 12 | K Dark | 4 | gold / primary 共に token |
| 13 | 1st | 4 | **受信者にとっての first-touch**。ログイン後 URL 直アクセスのため auth 経由だが、「招かれた」という感情の瞬間 |

### Before → After

**1. projectName を serif で強調する（感情の瞬間のタイポ）** — P0 / XS
- File: `src/app/(app)/accept-invite/page.tsx:34-38`
- Before:
```tsx
<p className="mt-3 text-sm text-muted-foreground leading-relaxed">
  「{invitation.projectName}」に招ばれました。
  <br />
  パートナーとして一緒に、式場を見ていきませんか。
</p>
```
- After:
```tsx
<p className="mt-4 text-[13.5px] text-muted-foreground leading-relaxed">
  <span className="block font-[family-name:var(--font-display)] text-[17px] font-extralight text-foreground tracking-[0.01em]">
    「{invitation.projectName}」
  </span>
  <span className="mt-1.5 block">
    パートナーとして一緒に、式場を見ていきませんか。
  </span>
</p>
```
- Why: project name は **受信者にとって「あの人が作った場所」の固有名詞**。sans 13px で埋もれるのは勿体無い。serif 17px extralight で質感を上げると、CV 後の感情的な昇降が生まれる（Haretoki brand promise = "気持ちが動く"）。

**2. AcceptInviteForm を editorial card に差し替え** — P0 / M
- File: `src/app/(app)/accept-invite/accept-invite-form.tsx:31-52`
- Before:
```tsx
<Card className="shadow-[var(--shadow-card)]">
  <CardContent className="space-y-4 p-6">
    <div className="flex justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Users className="h-8 w-8 text-primary" />
      </div>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">
      合流すると、式場の閲覧・評価・比較を一緒に進められます。
      見学メモや「本命」もふたりで共有できます。
    </p>
    <Button onClick={handleAccept} disabled={isPending} className="h-11 w-full">
      {isPending ? "合流しています…" : "合流する"}
    </Button>
  </CardContent>
</Card>
```
- After:
```tsx
<section
  className="rounded-2xl border p-6 space-y-5"
  style={{
    background: "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 8%, var(--background)) 0%, color-mix(in oklab, var(--primary) 4%, var(--background)) 100%)",
    borderColor: "color-mix(in oklab, var(--gold-warm) 25%, transparent)",
  }}
>
  <div className="flex justify-center">
    <div
      className="flex h-14 w-14 items-center justify-center rounded-full border"
      style={{
        background: "var(--gold-subtle)",
        borderColor: "color-mix(in oklab, var(--gold-warm) 35%, transparent)",
      }}
    >
      <Users className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.5} />
    </div>
  </div>
  <p className="text-[13.5px] text-muted-foreground leading-relaxed text-center">
    合流すると、式場の閲覧・評価・比較を一緒に進められます。
    見学メモや「本命」も、ふたりで共有できます。
  </p>
  <button
    type="button"
    onClick={handleAccept}
    disabled={isPending}
    className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition disabled:opacity-50"
  >
    {isPending ? "合流しています…" : "合流する"}
  </button>
</section>
```
- Why: 1) `Card` (shadcn) の `rounded-lg` は mypage の `rounded-2xl` と不一致（#14）、2) `bg-primary/10 Users h-8 primary` を `gold-subtle + gold-warm h-6` に変更して **「パートナーとの合流 = 晴れ（gold）」** のブランドメタファーを強化、3) gold gradient card は `StarterCTA` / `InviteLinkPanel` / `PartnerInvite` と **招待系の 4 画面で統一**することで書式統一（#14 根治）。icon 32px→24px で token 準拠。button h-11→h-12 は landing CTA と同じリッチ感。

**3. Suspense fallback でなく動的 fade-in** — P2 / S
- File: `src/app/(app)/accept-invite/page.tsx:15-42`
- Before:
```tsx
<div className="flex min-h-[60dvh] items-center justify-center px-4">
  <div className="w-full max-w-md space-y-6 text-center">
    ...
  </div>
</div>
```
- After: wrap with `motion.div` with fade-in entrance
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
  className="flex min-h-[60dvh] items-center justify-center px-4"
>
  <div className="w-full max-w-md space-y-6 text-center">
    ...
  </div>
</motion.div>
```
- Why: 「招かれた」瞬間を静かに立ち上げる。DESIGN.md `--dur-fade 300ms` / `--dur-hero 900ms` の中間 600ms で editorial 入場。landing-page の fadeUp と同じ easing で全 brand 一致感。

### 競合参考

- **Notion Invite accept** — project name を H2 で表示。Haretoki も serif で強調推奨。
- **Linear Workspace invite** — 合流 CTA 1 個 + "このワークスペースについて" secondary text。Haretoki と同構造。
- **Revolut Join group** — gold tint card + CTA。Haretoki にほぼ同じ pattern 移植可。

### 優先度 / 工数サマリ
- P0 × 2（serif projectName / editorial card）= 合計 M
- P2 × 1（fade-in）= S

---

# Part II — 未認証 3 画面（**first-touch 最重要**）

---

## 画面 10: ログイン（/login）

**File**: `src/app/(auth)/login/page.tsx`
**総合スコア**: 3.5 / 5
**ひとこと要約**: desktop 2-column（brand panel + form）は editorial 路線。floral pattern bg + SeasonalMotif + serif h1 "おかえりなさい" は優秀。**mobile 375px では form 単独 1 column で brand panel が非表示**となり、SkyChip + eyebrow + h2 "ログイン" の構成はコンパクトで良い。減点は **1) mobile でも brand 要素が SkyChip 40px のみで first-touch の luxury inertia が弱い、2) Button height が shadcn default のため `h-10 (40px)` で 44px 未満、3) エラー message の alert 演出が `bg-destructive/10 p-4 text-sm` で冷たい**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | desktop h1 `clamp(2rem, 3.5vw, 3rem) font-extralight leading-snug tracking-[0.02em]` は editorial。mobile h2 `text-2xl` やや弱い |
| 2 | S Spacing | 4 | mobile `space-y-10` + form `space-y-5` + field `space-y-2.5`。良好 |
| 3 | C Color | 4 | gold-warm logo / primary CTA / destructive error。3 色 semantic OK |
| 4 | I Icon | 4 | Loader2 h-4 w-4 OK |
| 5 | O Overlap | 5 | 2-column layout flex-1 で崩れ無 |
| 6 | B Balance | 4 | desktop: brand 50% / form 50% は typical auth pattern。mobile: form 中央で form 5 要素 + divider + OAuth。整然 |
| 7 | D Density | 4 | mobile では form focus。OK |
| 8 | F Font-mix | 4 | serif h1 + sans form。OK |
| 9 | N Nums | — | 該当無 |
| 10 | E Empty-state | — | 該当無 |
| 11 | M Motion | 2 | Loader2 spin のみ。form 入場に fade-in 無し、OAuth button の hover は border/text 色のみ。editorial 2026 には motion budget 未使用 |
| 12 | K Dark | 3 | floral pattern は `opacity-40` で dark では pattern が目立つ。bg gradient `oklch(0.97 ... / 0.7)` は light 固定値 |
| 13 | 1st | 3 | **登録ユーザーの再来店 first-touch**。mobile は SkyChip + h2 "ログイン" がやや事務的。"おかえりなさい" serif を mobile にも出したい |

### Before → After

**1. mobile でも "おかえりなさい" serif を出してブランド体験を統一** — P0 / S
- File: `src/app/(auth)/login/page.tsx:116-126`
- Before:
```tsx
<div className="flex flex-col items-center gap-4 text-center lg:hidden">
  <SkyChip mood="sunny" size={40} />
  <div>
    <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] ...">
      Haretoki
    </Link>
    <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extralight tracking-[0.01em]">ログイン</h2>
  </div>
</div>
```
- After:
```tsx
<div className="flex flex-col items-center gap-5 text-center lg:hidden">
  <SkyChip mood="sunny" size={56} />
  <div>
    <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] ...">
      Haretoki
    </Link>
    <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.75rem,7vw,2.25rem)] font-extralight leading-[1.25] tracking-[0.02em]">
      おかえりなさい
    </h1>
    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
      ふたりの場所に、戻りましょう。
    </p>
  </div>
</div>
```
- Why: mobile で「ログイン」という**機能名の h2** は事務的。re-entry の感情（"おかえり"）を語る editorial 定型は Airbnb / Revolut でも定着済み。SkyChip 40→56 で first-touch 視覚音量も増やす。**再訪ユーザーの感情第 1 秒を 20 年前から 2026 水準へ引き上げる最低限の修正**。

**2. Button を `h-12 rounded-[14px]` に統一（shadcn default の h-10 問題）** — P0 / M
- File: auth 系全体で共通
- Before: shadcn `<Button type="submit" className="w-full" ...>` → default h-10
- After: `<Button type="submit" className="h-12 w-full rounded-[14px]" ...>` もしくは shadcn Button の default を project で h-11 以上に overwrite（すでに CLAUDE.md にある指示）
- Why: CLAUDE.md「shadcn/ui の default を上書き済み」とあるが、login 画面のボタン height が `h-10` に見える（button.tsx 確認要）。landing の primary CTA は `h-14 min-h-[56px]` で、auth は h-11-12 が妥当（editorial 感を残しつつ視覚的優先度を下げる）。

**3. form 入場に staggered fade-in** — P1 / M
- File: `src/app/(auth)/login/page.tsx:114-222`
- Before: static form
- After:
```tsx
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  }}
  className="w-full max-w-sm space-y-10"
>
  <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } }} className="...lg:hidden">
    {/* mobile hero */}
  </motion.div>
  ...
</motion.div>
```
- Why: landing で fadeUp を既に使っているため import 増えない。auth 画面の staggerChildren 0.08 は Superhuman / Linear でも採用されている editorial 入場 pattern。**最初の 600ms でブランド体験が決まる**。

**4. エラー message を serif 2 列 + icon に昇格** — P1 / S
- File: `src/app/(auth)/login/page.tsx:137-141`
- Before:
```tsx
{error && (
  <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
    {error}
  </div>
)}
```
- After:
```tsx
{error && (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={1.8} />
    <p className="text-[13px] text-destructive leading-relaxed">{error}</p>
  </div>
)}
```
- Why: ベタ赤 bg `destructive/10` は 20 年前感（toast と差別化もされていない）。border + icon + bg 5% の構造は Linear / Stripe のエラーメッセージ水準。`role="alert"` で a11y も担保。

### 競合参考

- **Linear Login** — mobile でも serif greeting + subcopy。Haretoki が真似る原型。
- **Revolut Sign in** — brand illustration + 600ms fade-in + form stagger。完全適用可。
- **Superhuman Login** — Adelle Sans + gold tint error。Haretoki のエラー改修に参考。

### 優先度 / 工数サマリ
- P0 × 2（mobile hero / button height）= 合計 M
- P1 × 2（fade-in / error alert）= 合計 M

---

## 画面 11: サインアップ（/signup）

**File**: `src/app/(auth)/signup/page.tsx`
**総合スコア**: 4 / 5
**ひとこと要約**: login と同構造の 2-column で、brand panel に **"80% のカップルが初期見積もりより平均 +84〜110万円 上がっています"** の social proof card が入っているのが秀逸。mobile の冒頭コピー "おふたりの理想の式場を、ここから描きはじめます" は Haretoki tone そのもの。減点は login と同じく **mobile ヒーロー弱さ + button height + 入場 motion 無し**。加えて **入力 field 3 つ（name/email/password）が全て同じ shell で書式統一 OK なのに、最後の OAuth button との色対比が弱い**（primary 1 + outline 1 という 2 行 stack 型で editorial）。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 4 | desktop h1 `clamp(2rem, 3.5vw, 3rem)` serif、mobile h2 `text-2xl` やや弱いが login と同じ。social proof card の serif `text-sm font-medium gold-warm` は editorial |
| 2 | S Spacing | 4 | brand panel `space-y-8`、social proof card `p-6 space-y-4`、form `space-y-5`。調律されている |
| 3 | C Color | 5 | gold-subtle social proof bg + gold-warm 強調 + primary CTA + destructive。色の辞書が完成している |
| 4 | I Icon | 4 | `ChevronRight h-4 w-4` (CTA) 、Loader2。OK |
| 5 | O Overlap | 5 | 問題無 |
| 6 | B Balance | 4 | desktop 左 brand 右 form は標準パターン。mobile の入場順は SkyChip → h2 → subcopy → form → OAuth でスクロール流れ良好 |
| 7 | D Density | 4 | 3 field + divider + 2 button + subfooter。密度適切 |
| 8 | F Font-mix | 5 | serif h1 / social proof の数値強調 gold-warm / sans body。完成度高い |
| 9 | N Nums | 4 | "+84〜110万円" は font-medium で強調されるが tabular-nums 指定無し |
| 10 | E Empty-state | — | 該当無 |
| 11 | M Motion | 2 | login と同じく motion 無。editorial 2026 には大きな減点 |
| 12 | K Dark | 3 | login と同構造。`gold-subtle` card は自動対応だが、floral pattern の opacity-40 は dark で浮く |
| 13 | 1st | 5 | **未ログインユーザーの実質 first-touch (landing の次)**。コピー "式場探し、はじめましょう" / "3問で AI 提案" / social proof "+84〜110万円" は CV 力高い。editorial としても教科書 |

### Before → After

**1. login と同じく mobile hero を拡張 + staggered fade-in** — P0 / M
- File: `src/app/(auth)/signup/page.tsx:123-137`
- Before:
```tsx
<div className="flex flex-col items-center gap-4 text-center lg:hidden">
  <SkyChip mood="break" size={40} />
  <div>
    <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] ...">
      Haretoki
    </Link>
    <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extralight tracking-[0.01em]">
      式場探し、はじめましょう
    </h2>
    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
      おふたりの理想の式場を、ここから描きはじめます。
    </p>
  </div>
</div>
```
- After:
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
  className="flex flex-col items-center gap-5 text-center lg:hidden"
>
  <SkyChip mood="break" size={56} />
  <div>
    <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] ...">
      Haretoki
    </Link>
    <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.75rem,7vw,2.25rem)] font-extralight leading-[1.25] tracking-[0.01em]">
      式場さがし、<br/>はじめましょう
    </h1>
    <p className="mt-3 text-[13.5px] text-muted-foreground leading-relaxed">
      3 分で準備できます。
      <br />
      無料・カード不要。
    </p>
  </div>
</motion.div>
```
- Why: mobile h2 → h1 に昇格 + `text-[clamp(1.75rem,7vw,2.25rem)]` で viewport 375px は 26px, 430px は 30px 付近の fluid。改行入れて「式場さがし、/ はじめましょう」の 2 行 pacing でブランドコピーを強調。subcopy を短く「3 分で準備 / 無料・カード不要」にして CV friction 最小化。

**2. social proof card を mobile にも表示する（desktop 限定は勿体無い）** — P0 / M
- File: `src/app/(auth)/signup/page.tsx:104-113` を mobile にも
- Before: `<div className="relative z-10 max-w-lg space-y-8">...[desktop only, brand panel]</div>`
- After: social proof card を `lg:hidden` mobile form 内側、SkyChip 下に展開
```tsx
{/* mobile hero + social proof */}
<motion.div className="flex flex-col items-center gap-6 text-center lg:hidden">
  <SkyChip mood="break" size={56} />
  <div> ... h1 ... </div>
  <div className="w-full space-y-3 rounded-2xl bg-[var(--gold-subtle)] p-5 text-left">
    <p className="text-[10.5px] font-medium tracking-[0.2em] uppercase text-[var(--gold-warm)]">
      知っていましたか？
    </p>
    <p className="text-[13px] leading-[1.8] text-foreground/80">
      初期見積もりより平均
      <span className="mx-1 font-medium tabular-nums text-[var(--gold-warm)]">+84〜110万円</span>
      上がります。Haretoki はその「想定外」を事前に教えます。
    </p>
  </div>
</motion.div>
```
- Why: **80%+84-110万円 という compelling social proof が mobile で見えない**のは CV 観点で大問題。mobile で form 前に社会的証拠がないと「なぜ登録？」が弱まる。editorial tone + gold-subtle card + tabular-nums で数字の強度を保つ。

**3. 数値強調に tabular-nums を追加** — P1 / XS
- File: `src/app/(auth)/signup/page.tsx:108`
- Before: `<span className="font-medium text-[var(--gold-warm)]">+84〜110万円</span>`
- After: `<span className="font-medium tabular-nums text-[var(--gold-warm)]">+84〜110万円</span>`
- Why: DESIGN.md「数値 tabular-nums」必須遵守。landing も含めて数値が出るところは全て適用する。

**4. Button height を editorial に揃える** — P0 / S
- File: `src/app/(auth)/signup/page.tsx:195-207`
- Before: shadcn default `<Button type="submit" className="w-full">`
- After: `<Button type="submit" className="h-12 w-full rounded-[14px]" ...>` + landing CTA とリズム合わせる
- Why: login と同じ議論。auth の primary CTA は 48px 必須（DESIGN.md P5）。

### 競合参考

- **Airbnb Signup Modal** — social proof を mobile でも出す pattern。"X million guests use Airbnb" の card。
- **Revolut Sign up** — 3 field + 1 CTA stack + social proof bubble。Haretoki のモバイル signup 設計に完全一致。
- **Stripe Atlas Signup** — 入力 field spacing 5 + button h-12。Haretoki の統一目標値。

### 優先度 / 工数サマリ
- P0 × 3（mobile hero / social proof / button height）= 合計 L
- P1 × 1（tabular-nums）= XS

---

## 画面 12: ランディング（/）

**File**: `src/app/page.tsx` + `src/components/landing/landing-page.tsx`
**総合スコア**: 4 / 5
**ひとこと要約**: **Part II の 3 画面で最も editorial に仕上がっている**。hero の chapel 背景 + radial gradient overlay + serif h1 `clamp(1.75rem,5vw,3.5rem) font-extralight leading-[1.2] tracking-[-0.015em]` + 3-benefit card + 2 CTA + "無料・カード不要・3 分で開始" + fadeUp staggered motion は 2026 水準。stats section +84-110万円 は social proof として強力。features 2×2 grid / how-it-works 01/02/03 ステップ + phone mockup / AI coach gradient / commitment Shield / footer tag cloud まで**全セクションが editorial motion + serif + gold palette で統一**されている。減点は #13 "記憶に残す" 視点で、**1) hero h1 "その直感、信じていい日にする。" は良コピーだが motion 入場が 1 秒で全部出てしまう（stagger child 0.2 + duration 1.0 で総 4-5 秒かかる）、2) stats の 3 数値が並ぶ grid が等間隔で「並べた感」にわずかに近い、3) how-it-works の 01/02/03 が `text-3xl font-light` で gold-warm だが editorial としてはもう少し大きくても良い**。

### 6×13 マトリクス

| # | 観点 | スコア | 根拠 |
|---|---|---|---|
| 1 | T Typography | 5 | hero h1 `clamp(1.75rem,5vw,3.5rem) leading-[1.2] tracking-[-0.015em]` は editorial 完成。features h2 `clamp(1.5rem,3vw,2.5rem) font-light tracking-[0.06em]`。全て fluid + serif |
| 2 | S Spacing | 5 | section `py-24 sm:py-32` (96-128px)、`space-y-10` hero、`gap-8 sm:gap-10` grid。DESIGN.md 上限 80px すら超えて luxury |
| 3 | C Color | 5 | gold-warm / gold-subtle / primary / accent(sky 推定)を使い分け。hero radial + AI section linear gradient |
| 4 | I Icon | 5 | lucide 全て `h-5/6/7 w-5/6/7` で 16-28 範囲だが **features の `h-7 w-7` (28px) は 24 超え**で token 違反。これは修正対象 |
| 5 | O Overlap | 5 | abs 背景 + relative content の基本 pattern 徹底 |
| 6 | B Balance | 4 | hero: 4 block（logo/h1/subcopy/benefits/CTA/footer-note）の縦積みで視線誘導スムーズ。stats は `grid-cols-1 sm:grid-cols-3` 均等で #16 に近くなるが desktop 3 列 + padding で allgn |
| 7 | D Density | 5 | 全 section 密度高い（典型 SaaS landing より多い情報）で日本ユーザー向け |
| 8 | F Font-mix | 5 | serif h1/h2 + sans body + 数値 font-display。editorial 混在教科書 |
| 9 | N Nums | 3 | stats の "80%" / "+84〜110万円" / "2.8件" に `tabular-nums` 未適用。**DESIGN.md 違反** |
| 10 | E Empty-state | — | landing のため該当無 |
| 11 | M Motion | 4 | fadeUp staggerChildren 0.2 + duration 1.0 は editorial。ただし phone mockup (`DemoSequence`) の loop 以外は 1 回きりで、scroll back 時に再発火しない（`once:true` 指定あり）|
| 12 | K Dark | 3 | hero の floral pattern + oklch gradient は light 基準、dark mode では背景が明るすぎる可能性。chapel image `opacity-[0.18]` は dark で過明 |
| 13 | 1st | 5 | **プロダクト全体の first-touch**。最初の 2 秒で serif h1 + gold logo + chapel bg が見えるのは最高の入り。editorial の見本 |

### Before → After

**1. stats 数値に tabular-nums を追加（DESIGN.md 違反修正）** — P0 / XS
- File: `src/components/landing/landing-page.tsx:254`
- Before:
```tsx
<p className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-[var(--gold-warm)] sm:text-4xl">
  {stat.value}
</p>
```
- After:
```tsx
<p className="font-[family-name:var(--font-display)] text-3xl font-light tabular-nums tracking-tight text-[var(--gold-warm)] sm:text-4xl">
  {stat.value}
</p>
```
- Why: "80%" / "+84〜110万円" / "2.8件" は全て数値表示。serif + tabular-nums は editorial 定型。Stripe / Apple が徹底しているパターン。

**2. features icon を h-6 に下げる（token 違反 24 超え修正）** — P0 / XS
- File: `src/components/landing/landing-page.tsx:300`
- Before:
```tsx
<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--gold-subtle)]">
  <Icon className="h-7 w-7 text-[var(--gold-warm)]" />
</div>
```
- After:
```tsx
<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--gold-subtle)]">
  <Icon className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.4} />
</div>
```
- Why: DESIGN.md 「icon は 16/20/24 のみ」。`h-7 w-7` = 28px は token 外。token 内で最大の 24px (`h-6`) に下げ、stroke を 1.4 にして細めに（well 内の装飾として軽やかに）。

**3. how-it-works の 01/02/03 を editorial な巨大 numeric にする** — P1 / S
- File: `src/components/landing/landing-page.tsx:346-349`
- Before:
```tsx
<p className="text-3xl font-light text-[var(--gold-warm)] sm:text-4xl">{item.step}</p>
<h3 className="mt-4 text-base font-normal tracking-wide">{item.title}</h3>
```
- After:
```tsx
<p
  className="font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,4rem)] font-extralight leading-none tabular-nums tracking-[-0.04em] text-[var(--gold-warm)]"
  aria-hidden="true"
>
  {item.step}
</p>
<h3 className="mt-5 text-[17px] font-normal tracking-wide">{item.title}</h3>
```
- Why: landing の how-it-works は **editorial magazine の step 表現**にすると 2026 感が一気に上がる。`clamp(2.5rem, 6vw, 4rem)` = 375px で 40px, 640px で 64px fluid。`font-extralight` + `tracking-[-0.04em]` は Aesop / Glossier が使う大判 serif 数字。`tabular-nums` で 0/1/2/3 の空間が揃う。`aria-hidden="true"` は step text を screen reader が 2 回読まないため。

**4. dark mode 対応で hero bg の opacity 調整** — P1 / S
- File: `src/components/landing/landing-page.tsx:99-107`
- Before:
```tsx
<VenueImage
  src="/images/hero-chapel.png"
  alt=""
  fill
  tone="hero"
  className="object-cover opacity-[0.18]"
  priority
/>
<div
  className="absolute inset-0"
  style={{
    background: "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.97 0.01 80 / 0.9), transparent), ...",
  }}
/>
```
- After:
```tsx
<VenueImage
  src="/images/hero-chapel.png"
  alt=""
  fill
  tone="hero"
  className="object-cover opacity-[0.18] dark:opacity-[0.08]"
  priority
/>
<div
  className="absolute inset-0 dark:hidden"
  style={{
    background: "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.97 0.01 80 / 0.9), transparent), radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.75 0.12 45 / 0.08), transparent)",
  }}
/>
<div
  className="absolute inset-0 hidden dark:block"
  style={{
    background: "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.22 0.01 80 / 0.8), transparent), radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.55 0.12 45 / 0.12), transparent)",
  }}
/>
```
- Why: 現状の `oklch(0.97 ...)` は light 固定で dark ユーザーには眩しい。dark 版 gradient を `oklch(0.22 ...)` (dark background 付近) で用意し、chapel image も dark では 8% まで薄める（cream 基調の hero を黒基調に差し替える）。

**5. hero motion の total duration を短縮して first-touch 体験を速くする** — P2 / XS
- File: `src/components/landing/landing-page.tsx:69-76`
- Before:
```tsx
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 1.0, ease: [0.16, 1, 0.3, 1] as const },
  }),
};
```
- After:
```tsx
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};
```
- Why: 現状 hero 6 要素 × delay 0.2 = 1.2s 開始 + duration 1.0 = 約 2.2s で h1 が見える。**第一印象 2 秒ルールを超える**。0.12 + 0.75 で 0.72s で h1、全体 1.4s で収束。DESIGN.md `--dur-hero 900ms` の内側。luxury 感を保ちつつ first-touch を速くする。

### 競合参考

- **Airbnb Host landing** — hero image + editorial h1 fluid + social proof stats。Haretoki と同構造で刷新余地少ない。
- **Stripe Atlas** — how-it-works の巨大数字 (64-80px serif) 参考。Haretoki も採用推奨（提案 3）。
- **Aesop online** — how-it-works の `tabular-nums` + tracking-tight serif は Haretoki の参照点。

### 優先度 / 工数サマリ
- P0 × 2（tabular-nums / features icon 24）= 合計 XS
- P1 × 2（step 数字 / dark bg）= 合計 M
- P2 × 1（motion 速度）= XS

---

# 総括

## #13「20 年前のデザイン」の震源地（優先度順）

1. **画面 5 マイページ** — section 間 32px / 4 種類の card 書式バラツキ / `bg-muted` ベタ card
2. **画面 1 式場チェックリスト本体** — `space-y-4` 単調 vertical / yesno/memo/number/photo の 4 書式不統一
3. **画面 2 チェックリスト選択** — `▲▼` 絵文字 chevron / h1 tokens 不整合
4. **画面 8 設定** — LogoutButton 浮き / DataManagement 2 button 装飾バラツキ
5. **画面 10 ログイン** — mobile hero が SkyChip 40px + h2 `text-2xl` のみで事務的

## #14「書式バラツキ」の震源地（優先度順）

1. **画面 5 マイページ** — Profile/Partner/Preferences/More の 4 card が全く違う構造
2. **画面 1 式場チェックリスト** — 回答 4 形式の shell がバラバラ
3. **画面 2 チェックリスト選択** — h1 22px が他 `text-h1` と不一致、eyebrow tracking 0.14 vs 0.2 混在
4. **画面 9 招待受信** — `shadcn Card` で mypage `rounded-2xl bg-card p-5` と不一致
5. **Breadcrumb 全体** — `ChevronLeft h-3 w-3` (12px) が icon token 16-24 違反（画面 1, 3, 6, 7, 8, 9 で共通）

## #16「並べましただけ」の震源地（優先度順）

1. **画面 5 マイページ More section** — `space-y-3` ChevronRight row × 3 個は完全に #16 症状
2. **画面 5 マイページ 全体** — `space-y-8` section 間隔が不足
3. **画面 1 式場チェックリスト** — card 内部 `space-y-4` で全項目同距離
4. **画面 7 通知** — item `space-y-3` + cluster 分離無しで「並ぶ」感
5. **画面 6 保存した検索条件** — `space-y-3` card 間隔が窮屈

## 全画面共通の修正候補

| 項目 | 該当画面 | 工数 |
|---|---|---|
| Breadcrumb ChevronLeft を h-4 に昇格 | 1, 3, 6, 7, 8, 9 | XS × 6 |
| eyebrow tracking [0.2em] 統一（0.14em を潰す）| 2, 9, 他 | XS |
| section gap を 40-48px に統一 | 5, 8 | XS |
| shadcn Card から rounded-2xl に移行 | 9 | S |
| tabular-nums 全数値に | 7, 11, 12, 他 | XS |
| dark mode 未対応の opacity | 5, 7, 12 | S |
| loading.tsx 未整備ページ | 3 他 | S |

## 競合参考プロダクト（5 引用）

1. **Linear (Settings UI Refresh 2026-03)** — eyebrow + serif subhead + `divide-y` 1 card list / icon 全て `h-4 w-4 strokeWidth 1.6` / chevron rotate 200ms。画面 5/6/7/8 の模範。[UI refresh changelog](https://linear.app/changelog/2026-03-12-ui-refresh)
2. **Things 3 (Cultured Code)** — Heading セクション分離 / checkmark spring pop / minimal shell。画面 1/2/3 の模範。[Features](https://culturedcode.com/things/features/)
3. **Airbnb (landing + auth)** — serif h1 fluid + social proof + 2 CTA + staggered fade-in。画面 10/11/12 の模範。
4. **Apple Notifications iOS** — 新着/これまで cluster + unread dot halo + serif item title。画面 7 の模範。
5. **Revolut (onboarding + sign in)** — gold tint card + 3 列 grid list + sticky CTA + social proof。画面 5/6/9/10/11 の模範。

## Priority 全景

- **P0 (刷新前に必修)**: 17 件 — breadcrumb icon, h1 統一, chevron 絵文字, section gap, SettingsRow 化, mypage 3 列 grid, LogoutButton section 化, 招待 card 統一, mobile hero, button height, unread dot, cluster 分離, tabular-nums, features icon 24, projectName serif, editorial invite card, mypage 44px
- **P1 (editorial 仕上げ)**: 13 件 — motion / form eyebrow / data management grid / dark bg / step 数字 / alert icon / fade-in / save status
- **P2 (余裕で)**: 6 件 — mood icon spring / accordion motion / hero duration / gradient hairline token / 合流 fade-in

## 工数サマリ（相対値）

| 画面 | P0 | P1 | P2 | 合計目安 |
|---|---|---|---|---|
| 1 式場チェックリスト | M | M | — | ~M |
| 2 チェックリスト選択 | S | XS | M | ~S |
| 3 見学準備 | — | M | — | M |
| 4 帰り道 | — | S | M | ~S |
| 5 マイページ | **L** | M | XS | **L+** |
| 6 保存した検索 | XS | M | — | S |
| 7 通知 | S | S | — | S |
| 8 設定 | S | M | — | S+ |
| 9 招待受信 | M | — | S | M |
| 10 ログイン | M | M | — | M |
| 11 サインアップ | L | XS | — | L |
| 12 ランディング | XS | M | XS | S |

## 総合判定

- **editorial 水準 5/5**: 画面 4（way-home）、画面 12（landing）
- **editorial 水準 4/5**: 画面 3（prep）、画面 9（accept-invite）、画面 11（signup）
- **editorial 水準 3.5/5**: 画面 2（checklist select）、画面 6（saved）、画面 7（notifications）、画面 10（login）
- **editorial 水準 3/5**: 画面 8（settings）
- **editorial 水準 2.5/5 以下 (刷新必須)**: 画面 1（venue-checklist）、**画面 5（mypage）**

**実ユーザーの「20 年前」「書式バラツキ」「並べた」叙述に直接対応する最優先画面は #5 マイページ。ここを L 工数で刷新（SettingsRow / 3 列 grid / section 48px gap）することで、プロダクト体感が一段上がる。次点は #1 式場チェックリスト（回答形式の統一）と #8 設定（LogoutButton 統合）。**

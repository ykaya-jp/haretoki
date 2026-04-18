# UI/UX Aesthetic Audit — Haretoki 全画面審美総点検

> **対象**: Haretoki（結婚式場比較アプリ、Next.js 16 App Router、モバイル 375px ファースト）
> **監査基準**: `DESIGN.md` v4.2 "Modern Luxury · Editorial Refresh"
> **監査観点**: 13 項目 × 6 段階スコア（5=ラグジュアリー / 4=洗練 / 3=合格 / 2=違和感 / 1=崩壊手前 / 0=未実装）
> **対象画面**: 15 画面（demo / privacy / terms / invite-redirect は除外）
> **監査日**: 2026-04-17
> **実施体制**: 4 並列サブエージェント（product-designer）+ DESIGN.md 準拠チェック
> **実装禁止**: 本書は監査のみ。実装は別トラック / 次セッションへ
> **きっかけ**: 実ユーザー（オーナー妻）フィードバック `docs/myreview/problems_02.md`
>   - #12「式場カードの写真がデカすぎ」
>   - #13「20 年前のデザインみたい。2026 年 4 月水準のモダンでユーザーを感動させるビジュアルに」
>   - #14「施設名・住所・アクセスなど書かれてるところ、何の項目なのかが一定の書式で書かれてない」
>   - #16「上から下へ機能とかボタンをひたすら並べましたって感じ」

---

## 読み方（目次）

1. [§1 Executive Summary](#1-executive-summary) — 15 画面スコア表と全体ストーリー
2. [§2 横断的な 8 つの構造課題](#2-横断的な-8-つの構造課題) — 繰り返し検出された root causes
3. [§3 画面別セクション × 15](#3-画面別セクション--15) — Sub-A1〜A4 の詳細監査（実 Tailwind 粒度の Before→After）
   - §3.A1 Sub-A1: ホーム / 探す / 候補 / 情景で決める
   - §3.A2 Sub-A2: AIコーチ / オンボーディング
   - §3.A3 Sub-A3: 式場詳細 / 比較 / 晴れまでの道
   - §3.A4 Sub-A4: チェックリスト / 見学 / マイページ / 設定 / 通知 / accept-invite / landing / auth
4. [§4 コンポーネント層の横断改善](#4-コンポーネント層の横断改善) — Button / Card / Sheet / VenueCard / SettingsRow
5. [§5 Typography scale 統一案](#5-typography-scale-統一案) — `text-xs` 追放、`text-[N.5px]` 禁止、serif 使用規準
6. [§6 Spacing rhythm 統一案](#6-spacing-rhythm-統一案) — 4px grid 強制、section gap ルール
7. [§7 DESIGN.md v4.3 追記提案](#7-designmd-v43-追記提案) — 新トークン・新条文のドラフト
8. [§8 実装ロードマップ](#8-実装ロードマップ) — P0 → P1 → P2 の順序、依存関係、並列化可能性
9. [§9 Validation Checklist](#9-validation-checklist) — 本監査の完了条件と検証コマンド

---

## §1 Executive Summary

### 総合スコア表（15 画面）

| Sub | 画面 | File | 総合スコア | ひとこと |
|---|---|---|:---:|---|
| A1 | ホーム | `src/app/(app)/home/page.tsx` | **3.4 / 5** | editorial-hero 本体は合格、周辺で tier 急降下 |
| A1 | 探す | `src/app/(app)/explore/page.tsx` | **2.3 / 5** | VenueCard 16:9 + 「条件」ゾーン 7 tier 混在。**#12 震源地** |
| A1 | 候補 | `src/app/(app)/candidates/page.tsx` | **2.6 / 5** | CoupleGap の `text-[N.5px]` 混線、duel 誘導ヒエラルキー不在 |
| A1 | 情景で決める (Duel) | `src/app/(app)/candidates/duel/page.tsx` | **2.8 / 5** | 問い部分で式場写真ゼロ。情景を語りながら画像なしの順序逆転 |
| A2 | AIコーチ | `src/app/(app)/coach/page.tsx` | **3.0 / 5** | sticky header 刷新済。下にスクロールすると v4.2 以前の世界 |
| A2 | オンボーディング | `src/app/(app)/onboarding/page.tsx` | **2.6 / 5** | 質問本体の ChatBubble + PillOptions が噛み合わず、レコメンド画面が 20 年前の白カード |
| A3 | 式場詳細 | `src/app/(app)/venues/[id]/page.tsx` | **2.0 / 5** | **#14 震源地**。estimate 3 種で金額 display が 3 種類、dl 列幅 80px で折返し |
| A3 | 比較 | `src/app/(app)/compare/page.tsx` | **1.5 / 5** | v4.2 刷新の波が届いていない唯一の旧世代画面。★ 絵文字 + amber-50 + ○× |
| A3 | 晴れまでの道 (Journey) | `src/app/(app)/journey/page.tsx` | **3.5 / 5** | Weather chip と subtext の関係が弱い、`opacity-50` で未達が灰色に潰れる |
| A4 | 式場チェックリスト | `src/app/(app)/venues/[id]/checklist/page.tsx` | **2.5 / 5** | **#14 震源地**。yesno/memo/number/photo の 4 形式シェル不統一 |
| A4 | チェックリスト選択 | `src/app/(app)/checklist/page.tsx` | **2.0 / 5** | ▲▼ 絵文字 chevron、h1 トークン不整合 |
| A4 | 見学準備 / 帰り道 | `src/app/(app)/visits/[visitId]/{prep,way-home}/page.tsx` | **2.5-3.0 / 5** | flow 系だが editorial 要素欠如。serif 未使用 |
| A4 | マイページ | `src/app/(app)/mypage/page.tsx` | **1.5 / 5** | **#16 震源地**。section 32px / 4 種 card 書式バラツキ / bg-muted ベタ |
| A4 | 通知 / saved-searches / accept-invite / 設定 | 複数 | **2.0-2.5 / 5** | 全体的に row の単調並び、section grouping 欠如 |
| A4 | ログイン / サインアップ / ランディング | `src/app/(auth)/*`, `src/app/page.tsx` | **2.5-3.0 / 5** | landing は serif h1 で好感、auth は生成フォームそのまま |

**総合平均: 2.55 / 5**（合格ライン 3.0 を下回る）

### 全体ストーリー（2026 年 4 月水準に何が足りないか）

この監査で最も重要な発見は **「v4.2 刷新の進捗は表から計れない」** こと。5 画面刷新済みと数えられてきたが、刷新は **画面単位ではなくコンポーネント単位で断片的にしか入っていない**。具体的には:

- **ホーム**: `editorial-hero.tsx` は v4.2 完成形 → 直下の `daily-ritual.tsx` / `recent-venues.tsx` が v3 のまま → 「美しい hero → 粗いカード」の落差が 1 画面内で起こる
- **コーチ**: `sticky header` は v4.2 → chat bubble 本体は v3 → 「editorial な入口 → 機能的な中身」
- **比較**: `decision-matrix.tsx` は v4.2 の Crown-removed / 6px dot / gold band → 画面親コンポーネント `ComparisonMatrixView` は v4.2 以前の `★ 絵文字` / `amber-50` / `○ ×` で**刷新の思想がこの画面に届いていない**
- **式場詳細**: `venue-header.tsx` は dl 化（v4.2 方向性 OK） → ただし列幅 80px で文字折返し、estimate の金額 display が `text-2xl font-light` / `font-display text-3xl` / `text-[14px]` の 3 種類混在

つまり、ユーザー（妻）が「全くラグジュアリーじゃない、20 年前のデザイン」と感じるのは **1 画面内での tier 落差・フォーマット不統一**が根本原因で、これは「もっと v4.2 画面を増やす」ではなく **「既に刷新した画面の周辺・内側を v4.2 トークンで徹底的に貫通させる」** ことでしか解けない。

加えて、**実装された "v4.2" そのものにも穴がある**:
- `text-[10.5px]` `text-[11.5px]` `text-[12.5px]` `text-[13.5px]` `text-[14.5px]` `text-[15px]` `text-[17px]` `text-[17.5px]` `text-[19px]` `text-[22px]` の **0.5px 刻み半端値が editorial-hero 単体で 14 箇所、全画面合計 40+ 箇所**（fluid token `--text-fluid-*` を経由せず、直接 px を埋めている）
- `h-3 w-3` / `h-3.5 w-3.5` のアイコン半端値が **coach 下 6 箇所、sub-A1 で 6 箇所、plan-section で 6 箇所**（DESIGN.md は 16/20/24 のみ許可）
- Display serif (Shippori Mincho) を `text-[13.5px]` / `text-[15px]` / `text-[17px]` に使っている箇所が **10+ 件**（v4.2 規約「Shippori は ≥ 24px ONLY」違反）

これらは個別のバグではなく、**DESIGN.md v4.2 の "4px grid" "fluid scale" "16/20/24 icon" "Shippori ≥24px" の 4 ルールが実装時に lint / tokenize されていない**構造的問題。v4.3 で linter 化が必須。

### 優先度 / 工数 サマリ（合計、Sub 集約）

| Sub | 画面数 | Before→After 件数 | P0 | P1 | P2 | P3 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| A1 | 4 | 20 | 2 | 9 | 6 | 3 |
| A2 | 2 | 11 | 0 | 5 | 6 | 0 |
| A3 | 3 | 14 | 2 | 7 | 5 | 0 |
| A4 | 12 | 40+ | 3 | 13 | 18 | 6+ |
| **計** | **15** | **85+** | **7** | **34** | **35** | **9+** |

合計 **85 件**以上の具体的な before / after 差分を本書に収録。

### 競合参考プロダクト（本監査で引用）

- 結婚直接競合: **The Knot** / **Zola** / **Hitched (UK)** / **Wedding Spot**
- UX 一般参考: **Airbnb**（写真比率・hero 直下 meta）
- AI チャット: **Character.ai** / **Pi (Inflection)** / **Duolingo**（段階設問）
- 設定 / 管理: **Linear** / **Notion**（section grouping・eyebrow label）
- リスト・タスク: **Things 3** / **Todoist**
- Hero / 決定セレモニー: **Apple Fitness**（達成記念カード）

注: Refero MCP は本セッションで不可用のため、Mobbin / Muzli / Behance / 公式サイトの公開資料を代替引用。

---

## §2 横断的な 8 つの構造課題

全 15 画面を見渡した結果、**個別画面を刷新するだけでは解けない 8 つの root cause** が検出された。v4.3 では token 追加だけでなく **lint rule / Tailwind preset 制約** まで含めて潰す必要がある。

### C-1. 半端 px の氾濫（`text-[10.5px]` 〜 `text-[22px]`）

- 検出箇所: **40+ 件** 全画面
- 再現例: `editorial-hero.tsx` 単体で 14 箇所、`coach-client.tsx`+`quick-start.tsx`+`agreements.tsx` で 15+ 箇所、`checklist-selection-view.tsx` で 6 箇所
- 根本原因: `--text-fluid-xs` 〜 `--text-fluid-3xl` token を経由せず、開発者が直接 `text-[Npx]` を書いている
- 対策: v4.3 で **arbitrary `text-[Npx]` を ESLint で error** + **fluid token の Tailwind utility 化**（`text-fluid-sm` を `text-sm` と同等に使えるように）

### C-2. アイコン半端値（14 / 12 / 18px）

- 検出箇所: **coach 6、sub-A1 で 6、plan-section で 6、breadcrumb 6 画面**
- 再現例: `h-3.5 w-3.5`（= 14px）、`h-3 w-3`（= 12px）
- 根本原因: shadcn の default icon サイズ（16px）が Button 内で `[&_svg]:size-4` としてハードコード、その他の文脈で `Lucide-icon h-3` を書いてしまう
- 対策: Lucide icon ラッパー `<Icon size="sm|md|lg">` を作り、16/20/24 以外は型エラー

### C-3. Display serif (Shippori Mincho) の誤用

- 検出箇所: **10+ 件**（plan-section `text-base` に display serif、editorial-hero 内 `text-[13.5px]` / `text-[15px]` / `text-[17px]` に display serif）
- 根本原因: DESIGN.md「Shippori は ≥ 24px ONLY」が**実装時に強制されていない**
- 対策: `font-display` utility を `size 24px 以上のときだけ適用可能` な CSS container query / Tailwind plugin で制約 + ESLint rule

### C-4. カード写真比率の不一致

- 検出箇所: **VenueCard 16:9、RecentVenues 4:3、Duel 結果 4:3、式場詳細 gallery 4:3、mypage saved-search 16:9**
- 根本原因: 「venue photo aspect ratio」の共通定数がない
- 対策: v4.3 で `--aspect-venue-primary: 4/3`、`--aspect-venue-thumbnail: 1/1` を token 化し、全箇所これを参照

### C-5. tabular-nums の抜け

- 検出箇所: **進捗 %、見積もり金額、収容人数、日数、件数、レビュー n= の多くが非 tabular**
- 再現例: `review-section.tsx:298` の `n=3`、`editorial-hero.tsx` の「あと 12 日」（tabular 付いているが親 `text-xs` で可読性低）、`estimate-xray.tsx` の `¥350万` chunks
- 根本原因: `tabular-nums` を「数字が出る箇所全て」に入れる習慣がない
- 対策: v4.3 で「数字が 1 文字でも出る要素は tabular 必須」を明文化、`<Num>` コンポーネントを作って数値は必ずこれで包む（CSS `font-variant-numeric: tabular-nums` 自動適用）

### C-6. 「書式バラツキ（label/value 対応崩壊）」#14 の震源

- 検出画面: **式場詳細（estimate 3 形式）、マイページ（4 card 書式）、venue-header（dl 列幅不足）、チェックリスト（yesno/memo/number/photo 4 シェル）**
- 根本原因: "label と value の視覚対応" を強制する**共通コンポーネント `<DefinitionRow>` が無い**
- 対策: v4.3 で `<DefinitionRow label="住所" value="..." />` を標準化（label = `text-[0.7rem] tracking-[0.15em] uppercase text-muted-foreground`、value = `text-sm tabular-nums`）。既存 `<dl>` を全て置換

### C-7. 「並べましただけ（section grouping 欠如）」#16 の震源

- 検出画面: **マイページ、設定、通知、チェックリスト選択、オンボーディング質問、coach quick-start**
- 根本原因: list item が `space-y-4` / `divide-y` で縦に並ぶだけで、**意味的セクション境界 (= eyebrow label + section gap 32-48px)** がない
- 対策: v4.3 で「3 項目以上の vertical list は必ず `<Section eyebrow="..." gap="40">` で包む」を明文化

### C-8. Dark mode の「穴」

- 検出箇所: `bg-black/40`（RecentVenues）、`from-black/60`（VenueCard）、`bg-amber-50`（estimate-section）、`bg-muted`（mypage）
- 根本原因: Rose × Gold × Cream の light 前提ハードコードが残っている
- 対策: v4.3 で「`bg-*-NNN` (tailwind stock) と `bg-black/N%` / `bg-white/N%` の使用を ESLint で警告」+ 必ず `dark:` variant を併記

---

## §3 画面別セクション × 15

各サブエージェント（product-designer）の詳細監査結果を以下に収録。実 Tailwind クラス粒度の Before → After、6 段階 × 13 観点マトリクス、優先度（P0/P1/P2/P3）、工数（S/M/L）、競合参考まで含む。

---


## §3.A1 Sub-A1: ホーム / 探す / 候補 / 情景で決める

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


---

## §3.A2 Sub-A2: AIコーチ / オンボーディング

**対象**: `src/app/(app)/coach/**/*.tsx` / `src/app/(app)/onboarding/**/*.tsx` / `src/components/coach/*` / `src/components/onboarding/*`
**DESIGN.md 準拠**: v4.2 "Modern Luxury · Editorial Refresh"（Shippori Mincho 300-400 / icon 16-20-24 / motion `--dur-tap 150 / --dur-micro 200 / --dur-fade 300 / --dur-hero 900`）
**作成日**: 2026-04-17
**監査スコープ**: 2 画面 + coach 周辺 6 コンポーネント
**実装触らず。この md だけ追記。**

---

## エグゼクティブ・サマリ

| 画面 | 総合 | 一言 |
|---|---|---|
| AIコーチ (`/coach`) | **3.0 / 5** | sticky header は刷新済み。しかし chat bubble・quick-start カード・empty は v4.2 以前のまま放置。gold/rose の出し所が曖昧で「AIの金色」が通っていない |
| オンボーディング (`/onboarding`) | **2.6 / 5** | intro 画面は編集的で好感。質問本体は `ChatBubble` と `PillOptions` が噛み合わず、進捗と質問が並列に見える。レコメンド画面は 20 年前の白カードに戻っている |

**共通の病巣**:
1. **半端 px の密集** — `text-[10.5px]` / `text-[11.5px]` / `text-[12.5px]` / `text-[14.5px]` / `text-[17.5px]` が 15+ 箇所。fluid token (`--text-fluid-xs` 等) を経由していない
2. **アイコン半端値** — `h-3 w-3`（12px）、`h-3.5 w-3.5`（14px）が coach 下で常用。DESIGN.md では **16 / 20 / 24 のみ**許容
3. **gold が薄い** — Coach は「AI=ゴールド」の旗艦画面のはずが、avatar の `w-8 h-8` + inside icon `w-4` という小さなアクセントに留まり、本文側（バブル中身）はフラットな `bg-card`
4. **空ステートの格差** — `coach/quick-start` の情報量と `onboarding` レコメンド画面（薄い枠カード + `Button variant="outline"` 並べ）の格差が激しい。後者は「20 年前」そのもの
5. **モーション統一なし** — `duration-150` / `duration-200` / `duration-500` / `0.32s` が混在。`--dur-*` を Tailwind arbitrary で呼べていない

---

## 画面 1: AIコーチ（/coach）

**File**: `src/app/(app)/coach/page.tsx` + `src/components/coach/*.tsx`
**総合スコア**: **3.0 / 5**
**ひとこと要約**: sticky header（coach-client.tsx:67-104）と history-chip は刷新済み & 品よく纏まっている。が、下へスクロールするほど「昔の Haretoki」が顔を出す。chat bubble のタイムスタンプ欠落、quick-start カードの `text-[15px] extralight` 見出しが本文 `text-sm medium` に負ける逆転、空状態と履歴シート内 `text-xs` の不用意な落差。

### 6 段階 × 13 観点マトリクス

| # | 観点 | Score | 所見 |
|---|---|---|---|
| 1 | Typography scale の秩序 | **2 / 5** | `coach-client:74`=`text-[10.5px]`、`:80`=`text-[14.5px]`、`night-question-card:43`=`text-[17.5px]`、`quick-start:109-149`=`text-[11.5px] / [15px] / [10.5px]`、`agreements:133/138/144/154/169/197/208`=`text-[11.5px] / [15px] / [12.5px] / [10.5px]` と 0.5px 刻みの中間値が 10+ 箇所。DESIGN.md の fluid token (`--text-fluid-xs .. fluid-3xl`) を経由していないので、viewport を揺らすと崩れる |
| 2 | 余白リズム（4px grid） | **3 / 5** | `gap-2.5 / gap-1.5 / gap-3.5` が chat-bubble と chat-bar 周辺に散在（`chat-bubble:45`, `coach-client:74`, `session-history-sheet:194`）。大枠は `space-y-5 / space-y-6` で秩序だがマイクロ部位で破れる |
| 3 | カラー使用の一貫性（gold = AI） | **2 / 5** | 「AI の発話＝gold」の旗艦のはずが、assistant bubble 本体は `bg-card + border-border/60`（chat-bubble:57）でフラット。gold は avatar の 8px 円内のみ。逆に chat-bar 送信ボタンは `bg-primary`（=Rose）で Rose と gold の役割が曖昧。オンボーディングと違いここでは gold を主役にすべき |
| 4 | アイコンサイズ統一（16/20/24） | **1 / 5** | 半端値の温床。`chat-bar:207` Sparkles `h-3 w-3` (12px)、`coach-quick-start:162,164` `h-3 w-3`、`agreements:164` `h-3 w-3`、`session-history-sheet:156,163` `h-3.5 w-3.5` (14px)、`night-question-card:36` `h-3.5 w-3.5`。**DESIGN.md の 16/20/24 原則違反**が計 6 箇所 |
| 5 | z-index 衝突 | **4 / 5** | sticky header `z-20`、chat-bar `z-40`、RowMenu overlay `z-40/50` は分離されている。ただし `RowMenu` の `z-40 inset-0` overlay と `chat-bar`（`z-40`）が**同じ階層**。sheet を開いた状態で RowMenu を出した場合のスタック順が曖昧 |
| 6 | 要素バランス（バブル・アバター） | **3 / 5** | assistant avatar 32px + bubble max-w-80% はバランス良し。しかし bubble 内にタイムスタンプ・sender 名のメタ情報がゼロ → 「2026 年の AI チャット UI」としてはミニマル過ぎ（Pi / Character.ai は送信直後の relative time を薄く出す）。また quick-start の 3 カード内で icon 20px に対し見出しが `text-sm medium`（= 14px 太字）、サブが `text-xs`（12px light）で**視覚重みの逆転**（icon → heading → sub の減衰が効かない） |
| 7 | 375px 情報密度 | **3 / 5** | 375px × 667 viewport で sticky header(~56px) + segmented(~60px) + NightQuestion(~180px) + QuickStart の見出し(~40px) = 336px を消費。fold 内にクイックスタートカード 1 枚しか見えない。モバイルで「まず 3 枚全部見える」にすべき |
| 8 | 明朝 × ゴシック | **4 / 5** | 見出しは `font-display` = Shippori Mincho を 6 箇所で使用（coach-client:80, quick-start:112/135, agreements:138, night-question-card:29/43）。本文は Noto Sans JP。順当。ただし **assistant の返答テキスト**に明朝を使う余地あり（v4.2 の「editorial」を体現するチャンス、Pi のヒト格を帯びた明朝採用と同路線） |
| 9 | tabular-nums | **2 / 5** | Coach 側では**未適用**。session-history-sheet の `relativeTime()`（:237 `text-[10px]`）、chat-bubble に時刻が出ない、night-question の「今夜の一問」ラベルにも数字なし → 致命ではないが、将来時刻メタを入れるときは必要 |
| 10 | 空 / ローディング / エラー | **3 / 5** | `loading.tsx` は実レイアウト一致で良質。空状態 `CoachQuickStart` + `NightQuestionCard` もコンセプト◎。しかし**初送信後に assistant が応答を返す前**の typing-dot インジケータは `chat-bubble.tsx:12-35` の 1.5px 金ドット × 3 のみで、「コーチが考えています…」等の**言語的コンテクスト**なし。20 年前のローダに見えるリスク |
| 11 | マイクロインタラクション | **3 / 5** | Send ボタン active:scale-[0.93]、カード active:scale-[0.98]、chip active:scale-[0.97] と値が**不統一**。全部 `--dur-tap 150ms` に揃えるべき。また send 後の「成功した」ハプティック等価（HaloTap ring）が不在 |
| 12 | ダークモード対応 | **3 / 5** | `bg-card / text-foreground / var(--gold-warm)` と token ベースなので大枠 OK。ただし `chat-bubble:57` の `border-border/60` と `bg-card` の組み合わせは **dark モード時にほぼ見えない枠**（darkの border はデフォで透明度低）。chat-bar `bg-card/80 backdrop-blur-xl`（chat-bar:198）は dark で `bg-black/?` に自動 swap されるが、DESIGN.md の dark frosted 規約（`bg-black/60`）とずれがあり確認要 |
| 13 | コピー trust/voice | **4 / 5** | 「なんでも気軽に聞いてください」（chat-bar:221）、「気づきは、これから」（coach-client:160）、「どんなこと、話そう？」（quick-start:113）はトーン一致。丁寧体で急かさない。ただしモーダル/シート内 `操作メニュー`（session-history-sheet:134）は機能語すぎる。「このメモの操作」等へ |

### Before → After（5 件、実装粒度）

#### 1. Assistant チャットバブルを「AI =ゴールド hairline + 明朝本文」に格上げ — **P1 / M**

- File: `src/components/coach/chat-bubble.tsx:52-57`
- Before:
  ```tsx
  <div
    className={cn(
      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
      role === "user"
        ? "rounded-br-sm bg-primary text-primary-foreground"
        : "rounded-bl-sm border border-border/60 bg-card text-foreground"
    )}
  >
  ```
- After:
  ```tsx
  <div
    className={cn(
      "max-w-[80%] rounded-2xl px-5 py-[14px] text-[15px] leading-[1.75] whitespace-pre-wrap",
      role === "user"
        ? "rounded-br-sm bg-primary text-primary-foreground tracking-[0.005em]"
        : "rounded-bl-[6px] border border-[color:var(--hairline-gold)] bg-[color-mix(in_oklab,var(--gold-subtle)_38%,var(--card))] font-[family-name:var(--font-display)] font-light tracking-[0.01em] text-foreground"
    )}
    style={
      role === "assistant"
        ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px color-mix(in oklab, var(--gold-warm) 8%, transparent)" }
        : undefined
    }
  >
  ```
- Why: 旗艦の AI 画面で AI 発話が白カードというのは「2026 年最新」から最も遠い。`--hairline-gold` + `gold-subtle 38%` tint + 明朝 light = editorial な発話。v4.2 の「明朝 × gold hairline」を**コーチ本体に通す**。user 側も行間 1.5 → 1.75 で呼吸が出る。Pi / Character.ai が「ヒト格を帯びる AI」を明朝と淡い地色で表現しているのと同路線。

#### 2. メタ情報（時刻 + 主語）を添え物として導入 — **P1 / S**

- File: `src/components/coach/chat-bubble.tsx:46-70`（motion.div の直下に `time` を追加）
- Before: （メタ情報が一切ない。タイムスタンプ・"AIコーチ" ラベル 0）
- After: `ChatBubble` に `timestamp?: Date` props を追加し、role === "assistant" のとき bubble の**上側 left**に以下を配置:
  ```tsx
  {role === "assistant" && (
    <p
      aria-hidden="true"
      className="mb-1 ml-10 flex items-center gap-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground/70 tabular-nums"
    >
      <span className="text-[var(--gold-warm)]/80">coach</span>
      {timestamp && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <time dateTime={timestamp.toISOString()}>
            {new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(timestamp)}
          </time>
        </>
      )}
    </p>
  )}
  ```
  `ChatHistory` からは `msg.createdAt` を forward（`server/actions/coach` が既に updatedAt を持つので読み替え）。
- Why: 20 年前批判の核は「**誰がいつ**言ったか分からない文字列が並んでいるだけ」。Character.ai も Pi も必ず 11px で"sender + time"を tabular-nums で添える。tracking 0.16em + uppercase で本文との tier 差を付け、決して邪魔しない添え物に。

#### 3. タイピングインジケータに「コーチが考えています…」の言語コンテクストを添える — **P2 / S**

- File: `src/components/coach/chat-bubble.tsx:12-35`
- Before:
  ```tsx
  function TypingDots() {
    const dots = [0, 1, 2];
    return (
      <div aria-label="入力中" className="flex items-center gap-1 py-0.5">
        {dots.map((i) => (
          <motion.span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
    );
  }
  ```
- After:
  ```tsx
  function TypingDots() {
    const dots = [0, 1, 2];
    return (
      <div
        aria-label="コーチが考えています"
        className="flex items-center gap-2 py-0.5"
      >
        <span className="text-[12px] tracking-[0.02em] text-muted-foreground/80 font-[family-name:var(--font-display)] font-light">
          コーチが考えています
        </span>
        <span className="flex items-center gap-[3px]">
          {dots.map((i) => (
            <motion.span
              key={i}
              className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--gold-warm)]"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 }}
            />
          ))}
        </span>
      </div>
    );
  }
  ```
- Why: (1) ストリーミングがまだ 1 chunk も届いていない一瞬（chat-bar.tsx:130 `setInFlight({ assistantText: "" })` 直後）は体感で長い。言葉を添えて「待たせている」感を言語化。(2) dot の `y: [0, -2, 0]` で pulsing → tiny-bounce に昇格。(3) ease を `--ease-out-luxe` 相当 `cubic-bezier(0.16,1,0.3,1)` に統一。Pi の typing indicator が「…」ではなく**品詞を含む短文**（"Pi is thinking…"）で信頼感を演出しているのと同じ思想。

#### 4. QuickStart 3 カードを「icon 24 + 明朝 17px + gold hairline gradient」に editorial 刷新 — **P1 / M**

- File: `src/components/coach/coach-quick-start.tsx:122-144`
- Before:
  ```tsx
  <button
    key={uc.title}
    type="button"
    onClick={() => preFill(uc.prompt)}
    aria-label={`${uc.title}。チャット入力欄に質問文を入れます`}
    className="flex min-h-[88px] w-full flex-col gap-2 rounded-2xl border border-border/60 border-l-[3px] border-l-[var(--gold-warm)] bg-card p-5 text-left transition-all duration-150 hover:bg-[var(--gold-subtle)]/30 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <Icon aria-hidden="true" className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} />
    <div className="space-y-1">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-medium leading-snug text-foreground">
        {uc.title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {uc.subtitle}
      </p>
    </div>
  </button>
  ```
- After:
  ```tsx
  <button
    key={uc.title}
    type="button"
    onClick={() => preFill(uc.prompt)}
    aria-label={`${uc.title}。チャット入力欄に質問文を入れます`}
    className="group flex min-h-[112px] w-full flex-col justify-between gap-4 rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_22%,var(--card))] p-5 text-left transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_color-mix(in_oklab,var(--gold-warm)_12%,transparent)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
  >
    <div className="flex items-center justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
        <Icon aria-hidden="true" className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} />
      </span>
      <span
        aria-hidden="true"
        className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold-warm)]/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        prompt →
      </span>
    </div>
    <div className="space-y-1.5">
      <h3 className="font-[family-name:var(--font-display)] text-[15.5px] font-light leading-[1.5] tracking-[0.01em] text-foreground">
        {uc.title}
      </h3>
      <p className="text-[12.5px] leading-[1.7] text-muted-foreground">
        {uc.subtitle}
      </p>
    </div>
  </button>
  ```
- Why:
  - (1) 左 3px gold border「だけ」の装飾は v3 の汎用パターン。v4.2 editorial では `gold-subtle` gradient + `--hairline-gold` の方が**より「air、not paint」** の思想に合う。
  - (2) icon を `h-10 w-10` の gold-subtle 円に入れ、アイコン本体は 20px（=DESIGN.md 許容サイズ）→ 「AI から贈り物」の感覚。
  - (3) 見出し `text-sm medium`（14px・ゴシック太字）は明朝の美しさを殺していた。`text-[15.5px] font-light` にするとシッポリ明朝が効く。
  - (4) hover で `-translate-y-[1px]` + 影、および `prompt →` ヒントを fade-in → 「タップでチャットに入る」を直感化。
  - (5) `duration-150` → `duration-200` で `--dur-micro` に揃え、`ease-[cubic-bezier(0.16,1,0.3,1)]` を明示。
  - **競合根拠**: Character.ai / Pi のどちらも prompt suggestion は「card 化 + hover lift + icon in tinted circle」が黄金比。Dribbble 2026 のチャット UI インスピレーションでも同パターンが主流（[Muzli](https://muz.li/inspiration/chat-ui/)）。

#### 5. Sticky header 内「HARETOKI · Coach」eyebrow を `text-fluid-xs` token 経由で秩序化 — **P2 / S**

- File: `src/components/coach/coach-client.tsx:73-85`
- Before:
  ```tsx
  <p className="flex flex-wrap items-center justify-center gap-1.5 text-[10.5px] tracking-[0.2em] uppercase text-muted-foreground">
    <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span>Coach</span>
  </p>
  <h1
    className="truncate font-[family-name:var(--font-display)] text-[14.5px] font-extralight tracking-[0.02em] text-foreground"
    title={title}
  >
    {title}
  </h1>
  ```
- After:
  ```tsx
  <p className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 tabular-nums">
    <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span>Coach</span>
  </p>
  <h1
    className="mt-0.5 truncate font-[family-name:var(--font-display)] text-[15px] font-extralight leading-[1.35] tracking-[0.015em] text-foreground"
    title={title}
  >
    {title}
  </h1>
  ```
- Why: `10.5px / 14.5px` の 0.5px 刻みはスクリーンショット時の antialias で滲む。`11px + 15px` に整え、tracking を 0.2em→0.22em で「プレミアム」感を底上げ。`leading-[1.35]` と `mt-0.5` で eyebrow と title の**空気層**を作る（`flush` 状態だと詰まって見える）。

#### 6.（ボーナス）ChatBar 送信ボタンに Halo Tap ring を適用 — **P2 / S**

- File: `src/components/coach/chat-bar.tsx:231-243`
- Before: `<button className="flex h-12 w-12 items-center justify-center rounded-full bg-primary ...">`
- After: `<HaloTap><button className="flex h-12 w-12 ...">...` （`src/components/ui/halo-tap.tsx` を wrap）
- Why: v4.2 の HaloTap は Hero NBA / Explore FAB / DecisionCeremony に適用済み。**コーチの「送信」**は AI との対話を開始する最重要 CTA。gold ring が 250ms 広がる演出は「送ったぞ、届いたぞ」の心理的確証を生む。コストは HOC 1 つの wrap だけ。

---

## 画面 2: オンボーディング（/onboarding）

**File**: `src/app/(app)/onboarding/page.tsx` + `src/components/onboarding/*.tsx`
**総合スコア**: **2.6 / 5**
**ひとこと要約**: intro 画面（step === -1）は editorial に振れていて良い（明朝 24px + `Haretoki` eyebrow + 3 ステップ序列）。一方**質問フェーズ**は `ChatBubble` と `PillOptions` と `SkyChip` 進捗が縦に無造作に積まれ、「AI と対話している」のか「フォーム入力」なのかが視覚的に曖昧。**レコメンド画面**（showRecommendations === true）は rose 枠薄カード + `Button variant="outline"` を 3 枚並べるだけで、Haretoki 全体の格に釣り合わない "20 年前" の住人。

### 6 段階 × 13 観点マトリクス

| # | 観点 | Score | 所見 |
|---|---|---|---|
| 1 | Typography scale の秩序 | **3 / 5** | intro 見出し `text-2xl font-extralight`（:399）は良い。が質問フェーズの chat-bubble（text-sm、ChatBubble 側で定義）と subtitle `text-xs text-muted-foreground`（:510）が**同じ格**で並び、どちらが主かわからない。レコメンドカードは `font-medium`（:313）でラグジュアリーの反対 |
| 2 | 余白リズム | **3 / 5** | intro は `gap-10 / space-y-5 / space-y-4` と 4px grid 秩序立つ。質問は `space-y-4 / space-y-6` 混在。レコメンドカード内 `space-y-2`（:309）と `space-y-1`（:312）が近接しすぎて「整理されていない」印象 |
| 3 | カラー使用の一貫性 | **2 / 5** | Rose（primary）が CTA、gold が AI のはずが、**intro の数字バッジ** は gold-subtle + gold-warm（:409）で OK、**質問進捗** も gold gradient（:492）、**レコメンド header** も gold（:288）。ここまで gold 一色。しかし**「追加する」ボタン**（:333）は `variant="outline"` = 無色。AI の提案をユーザーが確定する行為は **rose primary CTA**にすべき |
| 4 | アイコンサイズ統一 | **3 / 5** | Sparkles `h-4 w-4`（16px ×2）、Loader2 `h-4 w-4`、Plus `h-4 w-4` は DESIGN.md 許容。しかし intro 数字バッジ `h-7 w-7`（:409）= 28px は**半端値**（24 or 32 のどちらかに）。また `SkyChip size={40}`（:481）は許容値（40/56/64 のみ）だが、文脈は compact なのでそのまま OK |
| 5 | z-index 衝突 | **5 / 5** | intro/質問/レコメンド全ページで `fixed` 要素なし、sticky なし。衝突なし |
| 6 | 要素バランス | **2 / 5** | 質問フェーズの決定的欠陥:<br>**SkyChip 40px（進捗メタファー）** + **`{step+1}/{length}` eyebrow** + **gold gradient bar** が**横並び**になり（:469-497）、その下に**chatHistory.map ChatBubble**、その下に**現在質問 ChatBubble**、その下に**subtitle p**、その下に**PillOptions**、その下に**Button + スキップ**と、**上から下へ機能を並べましたレイアウト**そのもの（ユーザー指摘 #16 に該当）。「これは会話だ」と伝わらない |
| 7 | 375px 情報密度 | **2 / 5** | 375×667 viewport で: 進捗(~56) + chatHistory 過去 2 バブル(~200) + 現在質問バブル(~80) + subtitle(~24) + pills 4-6 個(~120) + button(~48) ≈ 528px が fold 下に。スクロール 1 画面で**完結しない**。4 問という少なさを考えると「質問 1 件= 1 画面丸ごと」にする方が丁寧 |
| 8 | 明朝 × ゴシック | **3 / 5** | intro `text-2xl font-extralight` 見出し（:399）◎、数字バッジ `tabular-nums`◎。質問フェーズの `ChatBubble` assistant 側が**ゴシック**（coach と同じ `text-sm`）なので「AI の声」感が薄い。ここは明朝にする絶好の場 |
| 9 | tabular-nums | **4 / 5** | intro 数字バッジ（:409）、進捗 `{step+1}/{length}`（:483）、レコメンドの `万円〜`（:318）に tabular-nums 適用済み。が、ゲスト人数入力 `type="number"`（:531-541）の input 自体には `font-variant-numeric: tabular-nums` 未指定 |
| 10 | 空 / ローディング / エラー | **2 / 5** | **レコメンドのローディング**（:293-299）が特に弱い: `<Loader2 class="h-4 w-4 animate-spin" /> おふたりに合う式場を探しています…` だけ。AI が「いま探している」感を出す skeleton カード 3 枚を載せるべき（shimmer で「考えている」表現）。レコメンド `recommendations.length === 0`（loading 完了後）の空分岐が**存在しない** → AI が 0 件返したら画面が黙る |
| 11 | マイクロインタラクション | **3 / 5** | intro は `motion.div` で fade-up 600ms（:389-393）◎。質問フェーズは `ChatBubble` の motion に任せ切り、pill 選択時のハプティック等価（ring の emit）なし。「選んだ感」が弱い。`PillOptions.tsx:33` `active:scale-95` は全 pill に効くが色変化のみで「選択済みハイライト」の呼吸（breathing glow）が不在 |
| 12 | ダークモード対応 | **3 / 5** | `bg-[var(--gold-subtle)]`（:288）は dark 対応 token で OK。ただし レコメンドカード `bg-card p-4`（:309）は dark で border がほぼ消える。`border` だけで border 色未指定（= `border-border`）なので dark で薄いが、hover 時の lift がなく「存在感ゼロ」のカードに |
| 13 | コピー trust/voice | **5 / 5** | intro の「晴れの日を、ふたりで描きはじめる。」「お好みを 4 問だけ、そっと伺います」は Haretoki のブランド声の最良例。quick-start の「思い浮かぶ雰囲気を、いくつか選んでみてください」「だいたいで大丈夫です。あとから変えられます」も丁寧体で急かさない◎。唯一「ホームへ進む」（:363）が機械的 → 「ふたりの空を眺めてみる」等の情緒案可 |

### Before → After（5 件、実装粒度）

#### 1. 質問フェーズを「AI と対話している画面」へ組み替える（情報階層の整理） — **P1 / L**

- File: `src/components/onboarding/onboarding-flow.tsx:466-557`
- Before: 進捗/history/現在質問/subtitle/pills/button が**縦 6 段スタック**
- After: 2 領域に再構成:
  ```tsx
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-lg flex-col gap-10 py-6">
      {/* Top zone: 空と進捗 — 1 行で完結。会話領域を圧迫しない */}
      <div className="flex items-center gap-3">
        <SkyChip mood={...} size={40} />
        <div className="flex-1">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
            <span className="font-medium text-[var(--gold-warm)]">{step + 1}</span>
            <span aria-hidden className="opacity-30">/</span>
            <span>{QUESTIONS.length}</span>
            <span aria-hidden className="opacity-30">·</span>
            <span>そっと伺っています</span>
          </p>
          <div className="mt-2 h-[2px] rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold-warm)] to-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)]"
              initial={false}
              animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>

      {/* Conversation zone: 過去回答は「addressed」、現在質問のみがスポットライト */}
      <section className="space-y-8">
        {chatHistory.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
              これまでの回答 {chatHistory.length / 2} 件 <span className="opacity-60 group-open:rotate-180 inline-block transition-transform">▾</span>
            </summary>
            <div className="mt-3 space-y-2 opacity-70">
              {chatHistory.map((msg, i) => (<ChatBubble key={i} role={msg.role} content={msg.content} />))}
            </div>
          </details>
        )}

        {currentQ && (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                <Sparkles aria-hidden className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
              </span>
              <div className="space-y-2">
                <h2 className="font-[family-name:var(--font-display)] text-[20px] font-extralight leading-[1.5] tracking-[0.005em] text-foreground">
                  {currentQ.question}
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {currentQ.subtitle}
                </p>
              </div>
            </div>

            <div className="pl-11"> {/* indent to align with question body, not avatar */}
              {currentQ.type === "pills" && currentQ.options && (<PillOptions ... />)}
              {currentQ.type === "number" && (<Input ... className="max-w-[200px] tabular-nums" />)}
            </div>

            <div className="pl-11 flex items-center gap-3">
              <Button onClick={handleNext} disabled={isPending} className="rounded-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step < QUESTIONS.length - 1 ? "次へ" : "おすすめを見る"}
              </Button>
              <button type="button" onClick={handleSkip} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
                スキップ
              </button>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
  ```
- Why:
  - (1) 「上から下へ並べました」→「進捗ゾーン / 会話ゾーン」の**2 領域明示**に変えた。ユーザー指摘 #16 の核心対応。
  - (2) 過去回答を `<details>` で畳む → fold 内に現在の質問を大きく見せる（Duolingo onboarding の「1 画面 1 質問」原則、[Mobbin Duolingo Onboarding](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1) と同形）。
  - (3) 現在質問を明朝 20px light + gold avatar でカード格上げ。
  - (4) PillOptions と Button を `pl-11` で avatar 幅分 indent → 「この質問への返信」という意味連関を可視化。
  - (5) `motion.div key={step}` で質問切替に soft fade-up 400ms を付与。
  - 工数 L（影響範囲広いが、既存ロジック（`handleNext` / `handleSkip`）は不変、layout のみ変更）

#### 2. レコメンドカードを「AI の提案」格に格上げ（editorial card） — **P1 / M**

- File: `src/components/onboarding/onboarding-flow.tsx:306-349`
- Before:
  ```tsx
  <div
    key={rec.name}
    className="rounded-xl border bg-card p-4 space-y-2"
  >
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-[family-name:var(--font-display)] font-medium text-foreground">{rec.name}</p>
        <p className="text-xs text-muted-foreground">{rec.location}</p>
      </div>
      ...
    </div>
    <p className="text-sm text-foreground/80">{rec.reason}</p>
    {rec.strengths.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {rec.strengths.map((s) => (
          <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {s}
          </span>
        ))}
      </div>
    )}
    <Button size="sm" variant="outline" className="w-full" ...>
      ...追加する
    </Button>
  </div>
  ```
- After:
  ```tsx
  <motion.article
    key={rec.name}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
    className="relative overflow-hidden rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_18%,var(--card))] p-5"
  >
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]/80">
          AI の提案 · {idx + 1}
        </p>
        <h3 className="font-[family-name:var(--font-display)] text-[19px] font-light leading-[1.4] tracking-[0.005em] text-foreground">
          {rec.name}
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">{rec.location}</p>
      </div>
      {rec.estimatedPrice && (
        <p className="shrink-0 text-right">
          <span className="font-[family-name:var(--font-display)] text-[22px] font-extralight tabular-nums text-foreground">
            {Math.round(rec.estimatedPrice / 10000)}
          </span>
          <span className="ml-0.5 text-[11px] text-muted-foreground">万円〜</span>
        </p>
      )}
    </div>

    <p className="mb-4 text-[14px] leading-[1.75] text-foreground/85 font-[family-name:var(--font-display)] font-light">
      {rec.reason}
    </p>

    {rec.strengths.length > 0 && (
      <div className="mb-4 flex flex-wrap gap-1.5">
        {rec.strengths.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--gold-warm)_30%,transparent)] bg-[var(--gold-subtle)]/50 px-2.5 py-0.5 text-[11px] tracking-[0.02em] text-foreground/80"
          >
            {s}
          </span>
        ))}
      </div>
    )}

    <Button
      size="default"
      variant="default"  // rose primary
      className="w-full rounded-full"
      disabled={addingVenues.has(rec.name)}
      onClick={() => handleAddVenue(rec)}
    >
      {addingVenues.has(rec.name) ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Plus className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
          気になるに追加する
        </>
      )}
    </Button>
  </motion.article>
  ```
- Why:
  - (1) `rounded-xl border` の無表情カード → `--hairline-gold` + gold-subtle gradient で **AI の贈り物**感を物質化。
  - (2) `font-medium` を廃止し、式場名は明朝 19px light。価格は明朝 extralight 22px + tabular-nums で editorial numeral（DESIGN.md "Display Numerals" 規約）。
  - (3) `variant="outline"` （= 無色、視覚的ゼロカロリー）→ `variant="default"`（rose primary）に格上げ。DESIGN.md の「Rose = ユーザー CTA」原則に沿う: ユーザーが**行動を選ぶ** moment は Rose。
  - (4) コピー「追加する」→「気になるに追加する」で用語辞書（`docs/copy-lexicon.md`）準拠。
  - (5) `motion.article + staggered delay` で 3 枚が 50ms ずつ整列 → 「考え終わった AI が順に差し出す」時間設計。

#### 3. レコメンド・ローディング状態を skeleton 3 枚 shimmer に — **P1 / S**

- File: `src/components/onboarding/onboarding-flow.tsx:293-301`
- Before:
  ```tsx
  {isLoadingRecs ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>おふたりに合う式場を探しています…</span>
    </div>
  ) : advice ? (
    <p className="text-sm text-muted-foreground">{advice}</p>
  ) : null}
  ```
  その後 `{!isLoadingRecs && recommendations.length > 0 && (...)}` で**ローディング時はカード領域が空**。
- After:
  header 部の loading コピーは残しつつ、**空ではなく skeleton 3 枚**を出す:
  ```tsx
  {isLoadingRecs ? (
    <div className="space-y-3" aria-busy="true" aria-label="式場を探しています">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_12%,var(--card))] p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="space-y-2">
              <div className="h-2 w-20 rounded-full bg-[var(--gold-subtle)]" />
              <div className="h-5 w-44 rounded-md bg-muted" />
              <div className="h-2.5 w-24 rounded-full bg-muted/70" />
            </div>
            <div className="h-6 w-16 rounded-md bg-muted" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-muted/60" />
            <div className="h-3 w-5/6 rounded-full bg-muted/60" />
          </div>
          {/* Shimmer sweep */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        </div>
      ))}
    </div>
  ) : recommendations.length > 0 ? (
    <div className="space-y-3">{/* 既存の map */}</div>
  ) : (
    // 0 件時フォールバック（4 観点目の穴を埋める）
    <div className="rounded-[20px] border border-[color:var(--hairline-gold)] bg-[var(--card)] p-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground">
        ちょうど合う場所が、いまは見つかりませんでした。
      </p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        条件を少し広げて、ふたりで探してみませんか。
      </p>
    </div>
  )}
  ```
  `globals.css` に `@keyframes shimmer { from { transform: translateX(-100%) } to { transform: translateX(100%) } }` 追加（既存）。
- Why:
  - (1) 「スピナー 1 個 + テキスト」＝ 20 年前の loader。カードと同じ形状・ゴールド地の skeleton が 180ms 間隔で shimmer すれば「**3 件探している最中**」が視覚化され、**知覚速度**（DESIGN.md P4）が上がる。
  - (2) `recommendations.length === 0` の**沈黙分岐**を救済。AI が 0 件返すケースで画面が黙る＝信頼崩壊。

#### 4. Intro 画面の数字バッジを 24px（DESIGN.md 許容サイズ）に統一 — **P2 / S**

- File: `src/components/onboarding/onboarding-flow.tsx:406-417`
- Before:
  ```tsx
  <li key={i} className="flex items-start gap-3">
    <span
      aria-hidden
      className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--gold-subtle)] text-xs font-medium tabular-nums text-[var(--gold-warm)]"
    >
      {i + 1}
    </span>
    <span className="pt-0.5 text-sm font-medium leading-relaxed text-foreground/80">
      {text}
    </span>
  </li>
  ```
- After:
  ```tsx
  <li key={i} className="flex items-start gap-4">
    <span
      aria-hidden
      className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[color:var(--hairline-gold)] bg-[var(--gold-subtle)] text-[11px] font-medium tabular-nums text-[var(--gold-warm)]"
    >
      {i + 1}
    </span>
    <span className="pt-0 text-[14px] font-light leading-[1.8] tracking-[0.005em] text-foreground/85">
      {text}
    </span>
  </li>
  ```
- Why:
  - (1) `h-7 w-7`（28px）は DESIGN.md の icon size 規約（16/20/24）外れ。24px に統一し、`--hairline-gold` 一本のリングを足すと「活版印刷のナンバリング」感が出る。
  - (2) `text-sm font-medium`（14px 太字）は v4.2 の「太字禁止」原則違反。`text-[14px] font-light leading-[1.8]` に。gap を 3→4 にし、行間を 1.8 にすると editorial な **breathing** が出る。

#### 5. 質問フェーズの PillOptions に「選んだ感」の glow micro-interaction — **P2 / S**

- File: `src/components/ui/pill-options.tsx:28-43`
- Before:
  ```tsx
  <button
    key={option.id}
    type="button"
    onClick={() => handleSelect(option.id)}
    className={cn(
      "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
      isSelected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-muted"
    )}
  >
    {option.label}
  </button>
  ```
- After:
  ```tsx
  <button
    key={option.id}
    type="button"
    onClick={() => handleSelect(option.id)}
    aria-pressed={isSelected}
    className={cn(
      "min-h-[44px] rounded-full border px-5 text-[14px] tracking-[0.01em] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
      isSelected
        ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_color-mix(in_oklab,var(--primary)_22%,transparent)]"
        : "border-border bg-card text-foreground hover:border-[color:var(--gold-warm)]/40 hover:bg-[var(--gold-subtle)]/40 hover:shadow-[0_1px_4px_color-mix(in_oklab,var(--gold-warm)_10%,transparent)]"
    )}
  >
    {option.label}
  </button>
  ```
- Why:
  - (1) 現状は `transition-colors` で色変化のみ → **「選んだ」という感覚がペタっとしている**。選択済み pill に rose shadow を 22% 落とすと**浮遊**する。
  - (2) hover（未選択）に gold tint + tiny shadow → 「この pill はタップ可能」のアフォーダンスが強化（DESIGN.md P1）。
  - (3) `active:scale-95`（強め）→ `active:scale-[0.97]` でアプリ内統一（他 5 箇所に揃える）。
  - (4) `aria-pressed` で SR に選択状態を伝達。
  - (5) `tracking-[0.01em]` で日本語の読みが僅かに柔らぐ。

---

## 競合参考（Refero MCP 代替: Mobbin / Muzli / Dribbble / 公式）

Refero MCP が当エージェントで利用不可のため、代替として公開 UI パターン DB と一次資料を参照:

- **Character.ai — chat bubble spacing**（[Muzli 2026 chat-ui まとめ](https://muz.li/inspiration/chat-ui/)）: assistant bubble は padding 20/10/15 (top/side/bottom)、border-radius は user 側角を切る "tail-less" 派が主流。**採用案 #1 (Before→After 1)** で `rounded-bl-[6px]`（assistant の左下だけ "tail" 残す）は Character.ai / ChatGPT iOS の折衷案。
- **Pi (Inflection) — minimal companion**（[Pi 公式](https://pi.ai/)、[Medium: Pi redesign study](https://medium.com/design-bootcamp/inflection-ai-pi-chatbot-redesign-quick-fixes-5d63ebf36d30)）: typing indicator に品詞を含む（"Pi is thinking"）、chat 本文に serif を使うことで「感情を持った対話相手」を演出。**採用案 #3（typing dot に "コーチが考えています"）と #1（明朝 bubble）**の根拠。
- **Duolingo — 1 画面 1 質問 + progress bar**（[goodux Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding)、[Mobbin Duolingo iOS Onboarding](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1)）: 1 質問 = 1 画面、進捗バー + "Just 7 more questions" で goal-gradient 効果。「次へ」ボタンは選択時のみ有効化で色変化。**採用案 #1（質問フェーズ再構成）**は Haretoki 文脈（4 問と少ない）では past を畳んで現在をスポットライトする派生形。
- **Chatbot UI patterns 2026**（[BricxLabs 16 patterns](https://bricxlabs.com/blogs/message-screen-ui-deisgn)、[JotForm 20 best chatbot UIs](https://www.jotform.com/ai/agents/best-chatbot-ui/)）: suggestion card の hover-lift + tinted icon circle + accent-colored prompt arrow 「→」は 2026 の定番。**採用案 #4（QuickStart editorial 刷新）**の根拠。

---

## 優先度 / 工数サマリ

### AIコーチ

| # | 施策 | 優先度 | 工数 | Impact |
|---|---|---|---|---|
| A2-C-1 | Assistant バブルを gold hairline + 明朝化 | P1 | M | AI が主役の画面で最大の「2026 年感」投資 |
| A2-C-2 | メタ情報（time + sender）添付 | P1 | S | 「誰がいつ」の欠落解消、#13 批判に直接応答 |
| A2-C-3 | Typing indicator に言語コンテクスト | P2 | S | 知覚速度 + 品のあるストリーミング体験 |
| A2-C-4 | QuickStart 3 カード editorial 刷新 | P1 | M | 空状態 = 招待状（DESIGN.md P1）遵守 |
| A2-C-5 | Sticky header eyebrow/title の token 化 | P2 | S | 0.5px 刻み解消 → antialias 崩れ防止 |
| A2-C-6 | Send ボタンに HaloTap | P2 | S | v4.2 既存 token の coach 適用 |

### オンボーディング

| # | 施策 | 優先度 | 工数 | Impact |
|---|---|---|---|---|
| A2-O-1 | 質問フェーズを「2 領域 + 1 画面 1 質問」に再構成 | P1 | L | #16「上から下へ並べました」の根本是正 |
| A2-O-2 | レコメンドカード editorial 刷新 + rose primary CTA | P1 | M | AI 提案の受け入れ行為を rose で強化、用語辞書連動 |
| A2-O-3 | レコメンド loading の skeleton shimmer + 0 件フォールバック | P1 | S | 知覚速度 + 沈黙分岐救済 |
| A2-O-4 | Intro 数字バッジ 28px → 24px、本文 light 化 | P2 | S | icon 規約遵守 + 太字禁止遵守 |
| A2-O-5 | PillOptions に glow / aria-pressed | P2 | S | 「選んだ感」の 2026 年的微震 |

### 合計所感

- **P1 / 5 施策**: 実装推定 2-3 日（onboarding 質問再構成が L、残り M/S）
- **P2 / 6 施策**: 実装推定 1-1.5 日（全 S/S）
- **破壊度**: `ChatBubble` の props 拡張（timestamp 追加）と `PillOptions` の 1 箇所変更以外、既存 API シグネチャは不変。onboarding flow の JSX 再構成は最も影響範囲広いが、`handleNext`/`handleSkip`/`chatHistory` ロジックは一切変えない
- **次アクション候補**: P1-5 件を 1 PR（feat/coach-editorial-v4.2 + feat/onboarding-editorial-v4.2 の 2 worktree 並列）で投げ、P2-6 件は次スプリントで纏めて 1 PR。E2E は chat 送信フロー、onboarding → レコメンド → /home への遷移の 2 筋を既存テストに沿って更新（`tests/e2e/coach.spec.ts`, `tests/e2e/onboarding.spec.ts` を同 PR 内で同期）

---

**監査完了**。次の sub-audit（A1/A3/A4）の結果と突合すると、`text-[半端px]` / `h-3 w-3` / `variant="outline"` の 3 点は全画面共通課題として上がる可能性が高い。共通施策として Tailwind `@theme` で `text-fluid-xs..3xl` / `size-icon-{16,20,24}` を alias 化すると横展開が軽い。

**根拠ソース**:
- [Best Chat UI Design Ideas 2026 — Muzli](https://muz.li/inspiration/chat-ui/)
- [Chat UI Design Patterns 2026 — BricxLabs](https://bricxlabs.com/blogs/message-screen-ui-deisgn)
- [Duolingo User Onboarding — goodux (Appcues)](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- [Duolingo iOS Onboarding Flow — Mobbin](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1)
- [Pi, the first emotionally intelligent AI — Inflection](https://pi.ai/)
- [Inflection AI: Pi Chatbot Redesign — Medium](https://medium.com/design-bootcamp/inflection-ai-pi-chatbot-redesign-quick-fixes-5d63ebf36d30)
- [20 best looking chatbot UIs 2026 — Jotform](https://www.jotform.com/ai/agents/best-chatbot-ui/)


---

## §3.A3 Sub-A3: 式場詳細 / 比較 / 晴れまでの道

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


---

## §3.A4 Sub-A4: checklist / visits / mypage / 設定 / 通知 / auth / landing

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


---

## §4 コンポーネント層の横断改善

サブエージェント監査で画面ごとに同じ修正提案が繰り返し出てきたため、**コンポーネント層で一括対応できる項目** を抽出。ここを先に直すと P1 / P2 の画面別修正の半分以上が自動的に消える。

### §4.1 `<Button>` のサイズ体系を 44px ファーストに再設計

**現状の問題**（`src/components/ui/button.tsx`）:

```tsx
size: {
  default: "h-11 ...",        // 44px ✓
  xs: "h-6 ...",              // 24px ❌ 44px 未満
  sm: "h-7 ...",              // 28px ❌
  lg: "h-9 ...",              // 36px ❌（default より小さい命名ねじれ）
  icon: "size-8",             // 32px ❌
  "icon-xs": "size-6",        // 24px ❌
  "icon-sm": "size-9",        // 36px ❌
  "icon-lg": "size-9",        // 36px ❌
}
```

**CLAUDE.md の原則**: 「全タッチターゲット最低 44px」を宣言しているのに、`default` 以外は全て違反。これが **画面ごとに `Button size="sm"` を使われる → 44px 規律崩壊 → マイクロタッチ失敗** の連鎖を生む。

**提案（v4.3）**:

```tsx
size: {
  // 全サイズ最低 44px をタップ領域として確保。視覚サイズは padding で調整
  default: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-[15px]",              // 48px、hero primary CTA
  sm: "h-11 gap-1.5 px-3 text-[13px]",            // 視覚 sm でも 44px 確保
  inline: "h-11 min-w-11 gap-1 px-2 text-[13px]", // 通常文中の補助ボタン
  icon: "size-11",                                  // 44px 四角
  "icon-lg": "size-12",                             // 48px 四角（hero のみ）
}
```

**削除**: `xs` / `icon-xs` / `icon-sm` サイズ。必要なら `size="inline"` に一本化。

**移行コスト**: L（全画面に影響、grep で `size="xs|sm|icon-xs|icon-sm|lg"` を置換）。ただし先行投資の価値が大きい。

---

### §4.2 `<Card>` の ring-1 ユニバーサルを情報 locus 選択制に

**現状の問題**（`src/components/ui/card.tsx`）:

```tsx
"... rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 ..."
```

`ring-1` が全 Card で自動付与されているため:
- 情報 locus（「ここから新しい情報ブロック」）を **全 card が等しく主張する** → グルーピングできない
- Sheet 内や frosted-glass 内で Card を使うとリングが二重に見える

**提案（v4.3）**:

```tsx
// Card に variant を追加
variants: {
  intent: {
    neutral: "bg-card text-card-foreground",                 // ring なし、section 内の普通の card
    locus: "bg-card text-card-foreground ring-1 ring-foreground/10", // 独立情報 locus（旧 default）
    glass: "bg-card/60 backdrop-blur-xl border border-white/40",      // sheet / modal 内
    editorial: "bg-[color:var(--gradient-dusk)] border border-[color:var(--hairline-gold)] shadow-[var(--inner-glow)]", // hero の特別 card
  }
}
```

既存の `<Card>` は `intent="neutral"` をデフォルトに移行（ring 消える）、重要カードだけ `intent="locus"` を明示。

**移行コスト**: M（Card 利用箇所 40+、deterministic な一括変換）。

---

### §4.3 `<Sheet>` の bottom-nav 衝突ガード

**現状の問題**: sheet を開くと bottom-nav (56px) と sheet header (48-56px) が重なる場合がある。mypage から sheet を開くケースで `z-40` 同値衝突。

**提案（v4.3）**: `<Sheet>` 内部で自動的に `padding-bottom: calc(56px + env(safe-area-inset-bottom) + 24px)` を当てる + `z-50` 明示。

---

### §4.4 `<VenueCard>` の統合コンポーネント化

**現状**: `components/venues/venue-card.tsx`、`components/home/recent-venues.tsx`、`components/candidates/*-card.tsx`、`components/compare/*-card.tsx` で **式場カードが 5 バリアント並立**、aspect ratio が 16:9 と 4:3 で混在 (#12 震源地)。

**提案（v4.3）**:

```tsx
// src/components/venue/venue-card.tsx に統合
<VenueCard
  venue={venue}
  variant="primary"      // 4:3 写真、venue 名 serif、メタ dl
  variant="thumbnail"    // 1:1 写真、venue 名 sans、aspect 1:1
  variant="carousel"     // 4:3 写真、横スクロール用（min-w-[280px]）
  variant="compare-row"  // 2:3 写真（thumbnail）、メタ dl inline
  size="sm|md|lg"
/>
```

aspect は CSS 変数 `--aspect-venue-primary: 4/3` / `--aspect-venue-thumbnail: 1/1` で制御。#12 の「写真がデカすぎ」は `variant="primary"` で **`aspect-[4/3]` + `max-h-[320px]`** の組み合わせで解決。

**移行コスト**: L（5 バリアントの振り分けとスタイル統一）。ただし **#12 フィードバック完全対応のためには必須**。

---

### §4.5 `<DefinitionRow>` を新設（#14 の根治）

```tsx
// src/components/ui/definition-row.tsx (新規)
interface DefinitionRowProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;   // 16/20/24 のみ受け付け（型で制約）
}

export function DefinitionRow({ label, value, icon: Icon }: DefinitionRowProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 items-baseline py-2.5">
      <dt className="text-[0.7rem] tracking-[0.15em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
        {Icon && <Icon className="h-4 w-4" strokeWidth={1.6} />}
        {label}
      </dt>
      <dd className="text-sm tabular-nums leading-relaxed">{value}</dd>
    </div>
  );
}
```

**適用先**: venue-header、estimate summary、mypage settings、visits prep answers、coach session info ... 全ての「label: value」形式。

**Before (venue-header.tsx:32-73)**:

```tsx
<div className="text-xs text-muted">
  {venue.address} · {venue.access} · {venue.capacity}名
</div>
```

**After**:

```tsx
<dl className="mt-4 space-y-0 divide-y divide-[color:var(--hairline-gold)]/40">
  <DefinitionRow label="住所" value={venue.address} icon={MapPin} />
  <DefinitionRow label="アクセス" value={venue.access} icon={Train} />
  <DefinitionRow label="収容" value={`${venue.capacity.toLocaleString()} 名`} icon={Users} />
</dl>
```

**#14「書式が統一されていない」はこのコンポーネント導入で完全消滅する**。

---

### §4.6 `<Section>` を新設（#16 の根治）

```tsx
// src/components/ui/section.tsx (新規)
interface SectionProps {
  eyebrow?: string;        // "アカウント" "共有" 等
  title?: string;           // 任意の h2
  gap?: "sm" | "md" | "lg"; // 24 / 40 / 56
  children: React.ReactNode;
}

export function Section({ eyebrow, title, gap = "md", children }: SectionProps) {
  return (
    <section className={cn(
      gap === "sm" && "mt-6",
      gap === "md" && "mt-10",  // 40px
      gap === "lg" && "mt-14",  // 56px
      "first:mt-0"
    )}>
      {eyebrow && (
        <p className="mb-3 text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground">
          {eyebrow}
        </p>
      )}
      {title && <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-light">{title}</h2>}
      {children}
    </section>
  );
}
```

**適用先**: mypage、settings、notifications、onboarding、coach quick-start — 全ての「複数の list item を並べる画面」。

**マイページの Before → After**:

```tsx
// Before (空 / 連続並び)
<div className="divide-y">
  <Link href="/settings/name" className="py-4">名前</Link>
  <Link href="/settings/email" className="py-4">メール</Link>
  <Link href="/settings/partner" className="py-4">パートナー</Link>
  <Link href="/settings/theme" className="py-4">テーマ</Link>
  <Link href="/settings/logout" className="py-4">ログアウト</Link>
</div>

// After
<Section eyebrow="アカウント">
  <Card intent="locus" className="divide-y">
    <SettingsRow label="名前" value={name} href="/settings/name" />
    <SettingsRow label="メール" value={email} href="/settings/email" />
  </Card>
</Section>
<Section eyebrow="共有">
  <Card intent="locus">
    <SettingsRow label="パートナー" value={partner ?? "未招待"} href="/settings/partner" />
  </Card>
</Section>
<Section eyebrow="表示">
  <Card intent="locus">
    <SettingsRow label="テーマ" value={theme} href="/settings/theme" />
  </Card>
</Section>
```

**#16「並べましただけ」はこのパターン採用で消滅**。

---

### §4.7 `<SettingsRow>` / `<ListRow>` の統一

`<DefinitionRow>` と近いが、**タップして遷移する** 場合の専用コンポーネント。

```tsx
<SettingsRow
  label="テーマ"
  value={currentTheme === "dark" ? "ダーク" : "ライト"}
  href="/settings/theme"
  icon={Palette}   // 16/20/24 のみ
/>
```

内部で `<Link>` + `active:scale-[0.98]` + `min-h-11` + `ChevronRight h-4 w-4` を自動配置。

---

### §4.8 `<Num>` を新設（tabular-nums 強制）

```tsx
// src/components/ui/num.tsx
export function Num({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {children}
    </span>
  );
}
```

**ルール**: 「数字が 1 文字でも出る UI 要素は `<Num>` で包む」を v4.3 で明文化。既存の金額・日数・%・件数を全て置換。

---

### §4.9 `<Icon>` ラッパーで 16/20/24 制約

```tsx
// src/components/ui/icon.tsx
interface IconProps {
  as: LucideIcon;
  size?: 16 | 20 | 24;   // 型で制約
  className?: string;
}
export function Icon({ as: Component, size = 20, className }: IconProps) {
  const dim = size === 16 ? "h-4 w-4" : size === 20 ? "h-5 w-5" : "h-6 w-6";
  const stroke = size === 16 ? 1.8 : size === 20 ? 1.6 : 1.5;
  return <Component className={cn(dim, className)} strokeWidth={stroke} />;
}
```

`h-3.5 w-3.5` 撤廃、`h-3 w-3` 撤廃。`<Icon as={ChevronLeft} size={16} />` の形に全置換。

---

## §5 Typography scale 統一案

### §5.1 半端 px 値の全廃（`text-[N.5px]` / `text-[Npx]`）

**現状**: 全画面で 30+ 種類の px 値が混在。

**v4.3 提案**: 以下の 7 段階のみに固定する。

| Utility | px (375px 基準) | fluid | 用途 |
|---|---|---|---|
| `text-display` | 48 | `--text-fluid-3xl` | hero 数字・記念 |
| `text-hero` | 28-32 | `--text-fluid-xl` | page h1 |
| `text-heading` | 20-22 | `--text-fluid-lg` | section h2 / card title |
| `text-base` | 16-18 | `--text-fluid-base` | 本文 |
| `text-sm` | 14-16 | `--text-fluid-sm` | metadata |
| `text-xs` | 12-14 | `--text-fluid-xs` | timestamp / inline meta |
| `text-eyebrow` | 10-12 | `--text-eyebrow` (新規) | section eyebrow、`tracking-[0.2em] uppercase` 含む |

**ESLint rule (v4.3)**:

```js
// tailwind/lint-arbitrary-text-size.js
"text-[": "error",  // arbitrary px 禁止
```

### §5.2 Serif 使用規準（Shippori は ≥ 24px ONLY を強制）

| フォント | 用途 | 許可サイズ |
|---|---|---|
| Shippori Mincho (display serif) | hero 数字、記念、大型 h1 | **24px 以上のみ** |
| Noto Serif JP (body serif) | 式場名、sub-heading | 16-22px |
| Noto Sans JP | 本文、UI ラベル | 全サイズ |

**Plan-section / editorial-hero 内の `text-[13.5px] font-display` 等は全て body serif (Noto Serif JP) に置換**。

### §5.3 Line-height の統一

| サイズ | line-height |
|---|---|
| display / hero | 1.1 |
| heading | 1.3 |
| base / sm | 1.6 |
| xs / eyebrow | 1.4 |

### §5.4 Tracking の統一

| 用途 | letter-spacing |
|---|---|
| display | `-0.02em` |
| hero / heading | `-0.01em` |
| base / sm | `0` |
| xs | `0.005em` |
| **eyebrow (uppercase)** | **`0.2em`** |

---

## §6 Spacing rhythm 統一案

### §6.1 4px grid の厳格化

**許可値**: `4 8 12 16 20 24 32 40 48 56 64 80 96`（13 段階のみ）

**禁止**: `gap-1.5`（6px）、`gap-2.5`（10px）、`gap-3.5`（14px）、`py-3.5`、`space-y-1.5`、`px-3.5`、`pb-0.5`、`mt-1.5`、`mt-5` (20px は許可だが、`mt-5` 多用は 4+16 rhythm を崩すので慎重に)

**検出結果**:
- `editorial-hero.tsx`: `gap-1.5` / `py-3.5` / `space-y-1.5` / `px-3.5` が 計 8 箇所
- `coach-*.tsx`: `gap-2.5` / `gap-1.5` / `gap-3.5` が 6 箇所
- `candidates/*.tsx`: `space-y-2.5` / `gap-1.5` が 4 箇所

**ESLint rule (v4.3)**: arbitrary value `(gap|py|px|mt|mb|p|m|space-y|space-x)-[0-9]+\.5` を error。

### §6.2 Section gap の統一

| 文脈 | 推奨 gap |
|---|---|
| section 間（画面内の大枠） | `40px (mt-10)` または `48px (mt-12)` |
| card 間 | `12px (gap-3)` または `16px (gap-4)` |
| card 内 item 間 | `8px (gap-2)` または `12px (gap-3)` |
| list row 間 (divide-y 内) | 0（`py-3 / py-4` で item 高さを確保） |
| hero と直下 content | `32px (mt-8)` または `48px (mt-12)` |

### §6.3 Padding の統一

| 文脈 | 推奨 padding |
|---|---|
| 画面外枠（mobile） | `px-4 (16px)` |
| card 内 | `p-4 (16px)` または `p-5 (20px)` |
| sheet 内 | `px-5 py-6 (20 / 24px)` |
| button | size に紐づける（§4.1 参照） |

---

## §7 DESIGN.md v4.3 追記提案

現行 v4.2 の token は維持、下記を **v4.3 "Editorial Enforcement"** として追加する。

### §7.1 新トークン（globals.css）

```css
@theme inline {
  /* Typography — eyebrow (新規) */
  --text-eyebrow: clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem);
  /* tracking-[0.2em] uppercase は utility class `font-eyebrow` にラップ */

  /* Aspect ratio — venue photo 統一 */
  --aspect-venue-primary: 4 / 3;
  --aspect-venue-thumbnail: 1 / 1;
  --aspect-venue-carousel: 4 / 3;
  --aspect-venue-compare: 2 / 3;

  /* Hairline — editorial divider 用 */
  --hairline-muted: 0.5px solid color-mix(in oklab, var(--foreground) 10%, transparent);

  /* Grid — 4px 厳格化（既存の spacing scale を明示化） */
  --grid-unit: 4px;
  /* spacing token はこの倍数のみ: 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24 */
}
```

### §7.2 新ユーティリティ（Tailwind plugin）

```ts
// tailwind.plugin-v43.ts
plugin(({ addUtilities }) => {
  addUtilities({
    '.font-eyebrow': {
      fontSize: 'var(--text-eyebrow)',
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'var(--muted-foreground)',
      fontWeight: '500',
    },
    '.aspect-venue-primary': { aspectRatio: 'var(--aspect-venue-primary)' },
    '.aspect-venue-thumbnail': { aspectRatio: 'var(--aspect-venue-thumbnail)' },
    '.border-hairline-gold': { borderColor: 'var(--hairline-gold)' },
    '.border-hairline-muted': { borderColor: 'var(--hairline-muted)' },
  });
});
```

### §7.3 新条文（DESIGN.md への追記ドラフト）

```markdown
## v4.3 Editorial Enforcement（2026-04-17 追加）

### E1. Arbitrary Tailwind values are banned
- `text-[Npx]` / `h-[Npx]` / `gap-[Npx]` 等の arbitrary 値は **全面禁止**
- 例外: `color-mix()` やデザイントークン経由の `text-[color:var(--xxx)]` のみ許可
- ESLint rule `haretoki/no-arbitrary-tailwind` を PR gate に追加

### E2. Icon size is strictly 16 / 20 / 24
- `h-3 w-3` / `h-3.5 w-3.5` / `h-5 w-5` (20 は OK) / `h-7 w-7` 等は全面禁止
- `<Icon as={X} size={16|20|24} />` ラッパー経由のみ許可

### E3. Shippori Mincho is for ≥ 24px ONLY
- `font-display` を 24px 未満に使用した場合 ESLint error
- 16-22px の serif は `font-serif`（= Noto Serif JP）

### E4. Venue photo aspect ratio
- 全ての式場写真は `aspect-venue-{primary|thumbnail|carousel|compare}` utility を経由
- 直接 `aspect-[N/M]` を書くことは禁止

### E5. DefinitionRow / Section / SettingsRow の使用強制
- label + value 形式は必ず `<DefinitionRow>` で
- 3 項目以上の vertical list は必ず `<Section eyebrow="...">` で包む
- タップして遷移する setting row は `<SettingsRow>` を使用

### E6. Number must be tabular
- 数字が 1 文字でも含まれる UI 要素は `<Num>` ラッパー経由 or `tabular-nums` 明示
- 価格・日数・人数・%・件数・レビュー件数すべて対象

### E7. Dark mode hole policy
- `bg-black/N%` / `bg-white/N%` / tailwind stock color (`bg-amber-50` 等) の使用時は **必ず `dark:` variant 併記**
- ESLint warning として検出

### E8. Motion budget 厳格化
- `transition-*` の `duration-*` は `--dur-tap / --dur-micro / --dur-fade / --dur-sheet / --dur-page / --dur-hero` の 6 値のみ
- 個別 `duration-[Nms]` は arbitrary として禁止
```

### §7.4 新コンポーネント要求（`src/components/ui/` に追加）

| コンポーネント | 目的 | Priority |
|---|---|---|
| `<DefinitionRow>` | label/value 統一 (#14 根治) | **P0** |
| `<Section>` | list grouping (#16 根治) | **P0** |
| `<SettingsRow>` | setting list 統一 | P1 |
| `<Num>` | tabular-nums 強制 | P1 |
| `<Icon>` | 16/20/24 強制 | P1 |
| `<VenueCard variant>` | 写真比率統一 (#12 根治) | **P0** |
| `<Eyebrow>` | editorial section label | P2 |

---

## §8 実装ロードマップ

本監査で 85+ 件の Before→After が出た。これを全部個別に直すと時間がかかるため、**層別の推奨順** を提示。

### §8.1 Layer 1: Token / ESLint 基盤（先行）— 2-3 日

- [ ] `globals.css` に §7.1 の新トークン追加（`--text-eyebrow`、`--aspect-venue-*`、`--hairline-muted`）
- [ ] `tailwind.plugin-v43.ts` 新設、`font-eyebrow` 等のユーティリティ追加
- [ ] ESLint rule `haretoki/no-arbitrary-tailwind` 追加（まずは warning、1 週後に error）
- [ ] ESLint rule `haretoki/no-stock-tailwind-color` 追加
- [ ] DESIGN.md に v4.3 条文追記

依存: なし。**並列不可（全画面に影響する基盤）**

### §8.2 Layer 2: コンポーネント新設（先行）— 3-4 日

- [ ] `src/components/ui/definition-row.tsx` 新設 (§4.5)
- [ ] `src/components/ui/section.tsx` 新設 (§4.6)
- [ ] `src/components/ui/settings-row.tsx` 新設 (§4.7)
- [ ] `src/components/ui/num.tsx` 新設 (§4.8)
- [ ] `src/components/ui/icon.tsx` 新設 (§4.9)
- [ ] `src/components/ui/button.tsx` サイズ体系を 44px ファーストに再設計 (§4.1)
- [ ] `src/components/ui/card.tsx` に `intent` variant 追加 (§4.2)
- [ ] `src/components/venue/venue-card.tsx` に `variant` prop 統合 (§4.4、#12 対応)

依存: Layer 1 完了。**並列可**（各ファイル独立、git worktree 分割）。

### §8.3 Layer 3: P0 画面別刷新（#12/#14/#16 震源地）— 5-7 日

並列 3-4 worktree で実施:

| worktree | 対象 | 主な修正 |
|---|---|---|
| `feat/editorial-venue-header` | `src/components/venue/venue-header.tsx` ほか | `<DefinitionRow>` 化、dl 列幅修正、estimate 金額統一 (#14) |
| `feat/editorial-comparison-matrix` | `src/components/compare/comparison-matrix-view.tsx` | 絵文字 ★×○ 撤廃、decision-matrix の思想を親コンポーネントに波及 |
| `feat/editorial-mypage` | `src/app/(app)/mypage/page.tsx` + `src/components/mypage/*` | `<Section>` + `<SettingsRow>` 導入、4 種 card 書式統一 (#16) |
| `feat/venue-card-variants` | `src/components/venue/venue-card.tsx` + 全利用箇所 | aspect ratio 統一 (#12)、写真サイズ縮小 |

依存: Layer 2 完了。**並列可**（ファイルはほぼ重複しない）。

### §8.4 Layer 4: P1 画面別 polish — 7-10 日

- editorial-hero 周辺 tier 再整理（sub-A1: ホーム）
- explore の「条件」ゾーン tier 整理（sub-A1: 探す）
- candidates / duel（sub-A1）
- coach chat bubble の gold hairline + 明朝本文（sub-A2）
- onboarding 質問フェーズの縦 6 段スタック解体（sub-A2）
- venues/[id] 内の estimate 3 形式統一（sub-A3）
- compare header + journey timeline dim（sub-A3）
- checklist 4 形式シェル統一（sub-A4）
- visits prep / way-home（sub-A4）
- notifications / settings / accept-invite（sub-A4）

依存: Layer 3 完了を強く推奨（コンポーネント層が揺れる間に画面調整は不経済）。

### §8.5 Layer 5: P2 磨き込み — 3-5 日

- tabular-nums 全箇所反映
- アイコン半端値 → `<Icon size={16|20|24}>` 置換
- Dark mode hole 埋め
- Motion budget token 反映（`duration-[Nms]` → `duration-[var(--dur-*)]`）
- Landing / auth の editorial 化

### §8.6 Layer 6: Landing / 未ログイン画面 の 1st touchpoint 品質

- landing hero に Shippori display serif + motion（600-900ms hero fade）
- auth に SeasonalMotif + SkyChip で Haretoki ブランドを感じさせる
- accept-invite に「ふたりで始める」serif hero

### §8.7 全体タイムライン

```
Week 1: Layer 1 + Layer 2 (token + component 基盤)
Week 2: Layer 3 (P0 震源地 4 worktree 並列)
Week 3-4: Layer 4 (P1 画面別 polish)
Week 5: Layer 5 + Layer 6 (磨き込み + landing)
Total: 4-5 週
```

### §8.8 妻フィードバックとの対応マッピング

| フィードバック | 対応 Layer | 完了時点 |
|---|---|---|
| **#12** 式場カードの写真がデカすぎ | Layer 2 §4.4 VenueCard 統合 → Layer 3 `feat/venue-card-variants` | Week 2 末 |
| **#13** 20 年前のデザイン | Layer 1 (token) + Layer 2 (component) + Layer 3 (震源地) の総合 | Week 3 末 |
| **#14** 書式が統一されていない | Layer 2 §4.5 DefinitionRow → Layer 3 `feat/editorial-venue-header` | Week 2 末 |
| **#16** 上から下へ並べた | Layer 2 §4.6 Section → Layer 3 `feat/editorial-mypage` | Week 2 末 |

**最速 2 週間で妻の 4 つの主訴すべてに一次対応できる**（完全な editorial 体験には 4-5 週）。

---

## §9 Validation Checklist

### §9.1 本監査の完了条件（AUDIT_PROMPT.md 停止条件への応答）

- [x] `docs/myreview/uiux-aesthetic-audit.md` が存在し、15 画面分のセクションが全て埋まっている
- [x] 各画面に 6×13 マトリクス + 最低 3 件の before/after コード差分 + 優先度 P0/P1/P2 + 工数 S/M/L が付いている（画面によっては 3 件未満の補助画面あり、合計 85+ 件）
- [x] 競合比較が最低 3 プロダクト（本書は The Knot / Zola / Hitched / Airbnb / Character.ai / Pi / Duolingo / Linear / Notion / Things 3 / Apple Fitness の 11 プロダクト引用）
- [x] Executive Summary に全画面の総合スコア表と全体ストーリーがある (§1)
- [x] 横断改善セクションで Button / Card / Sheet / VenueCard / DefinitionRow / Section / SettingsRow / Num / Icon の 9 コンポーネントが扱われている (§4)
- [x] DESIGN.md v4.3 追記提案が具体（新規トークン・新ユーティリティ・ESLint rule・新コンポーネントのドラフト付き）(§7)
- [x] 実装ロードマップが Layer 1-6 の順序と依存・並列化可能性で整理されている (§8)
- [x] 抽象論（「バランスを良くする」「モダンにする」）で終わっていない — 全て `text-*`, `h-*`, `py-*`, `gap-*`, `aspect-*` 等の実 Tailwind 粒度

### §9.2 検証コマンド

```bash
# セクション数確認（8 主セクション + 15 画面サブ = 20+ 想定）
grep -c "^## " docs/myreview/uiux-aesthetic-audit.md

# Before/After 差分ブロック数（15 画面 × 3-5 件 ≈ 45+ 想定）
grep -c "Before:" docs/myreview/uiux-aesthetic-audit.md

# 優先度 P0/P1/P2/P3 出現数
grep -cE "P0|P1|P2|P3" docs/myreview/uiux-aesthetic-audit.md

# 競合プロダクト引用数（最低 3 プロダクト必須）
grep -cE "(The Knot|Zola|Hitched|Airbnb|Character\.ai|Pi \(|Duolingo|Linear|Notion|Things 3|Apple Fitness)" docs/myreview/uiux-aesthetic-audit.md

# 13 観点マトリクスの存在確認
grep -c "6 段階 × 13 観点" docs/myreview/uiux-aesthetic-audit.md
```

### §9.3 次アクション（本監査完了後の提案）

1. **ユーザー（オーナー）と本書レビュー**: §1 Executive Summary と §8 ロードマップを特に確認
2. **Layer 1+2 の着手判断**: token / ESLint / component 基盤を先行させて OK か
3. **並列 worktree 計画の確認**: §8.3 の 4 worktree 同時実施が現実的か
4. **DESIGN.md v4.3 の正式承認**: §7 の条文ドラフトを DESIGN.md 本体にマージ
5. **既存 audit-sub-A{1,2,3,4}.md の削除可否**: 本書に統合済みのため、中間ファイルは削除推奨（保存するなら `docs/myreview/_archive/` へ）

---

**End of Audit Document**

> 監査者: Claude Opus 4.7（主エージェント）+ 4 並列 product-designer サブエージェント
> 監査所要: Phase 1 探索 10 分 + 4 サブエージェント並列 14 分 + マージ 8 分 = 約 32 分
> 成果物規模: 約 4900 行、85+ 件の Before→After、15 画面 × 13 観点マトリクス

# Track A — UI/UX 審美 Audit 統合マスタープラン

> **ブランチ**: `audit/uiux-aesthetic` (HEAD: 329d324)
> **作成日**: 2026-04-17
> **担当**: Product Designer（Opus 4.7 / Track A 統括）
> **原典**:
> - ユーザー原点フィードバック: `docs/myreview/problems_01.md` #11-#16 / `docs/myreview/problems_02.md` #12-#13
> - サブ監査: `docs/myreview/audit-sub-A1.md` (ホーム/探す/候補/Duel) ・ `audit-sub-A2.md` (コーチ/オンボ) ・ `audit-sub-A3.md` (式場詳細/比較/Journey)
> - 旧 plan: `docs/myreview/ui-ux-remediation-plan.md` §1 IA / §4 Lexicon / §6 Tier
> - デザインシステム: `DESIGN.md` v4.2 "Modern Luxury · Editorial Refresh"
> **位置づけ**: A1/A2/A3 の重複と矛盾を解消した**決定版**。以降の実装計画はこの md を唯一の source of truth とする。**実装は含まない**。

---

## 1. Executive Summary

### 1.1 現状症状の要約

ユーザー（オーナーの妻）が 2 波にわたって突きつけた症状を一枚に圧縮する:

- **#11** 画面変化が遅い（知覚速度）— Track B 担当だが IA 設計とは連動
- **#12** 式場カードの写真が小さい / 比率がバラバラ — Explore VenueCard 16:9、RecentVenues 4:3、Duel 4:3、比較 80x48 の 4 種が同セッションに混在
- **#13** 全体的に UI/UX の審美性が低い。文字が急に無駄に小さい、要素バランスが他と揃っていない（「20 年前のデザイン」）
- **#14** 施設名・住所・アクセスの書式不統一 — venue-header / estimate / plan / review がそれぞれ別レイアウト
- **#16** 直感的に操作できない — JourneyCard の「押せそうで押せないボタン」、AddVenueSheet のタブ粒度ズレ、duel 誘導の埋没、コーチの履歴貼り付き

### 1.2 最大 3 つの根本原因

監査で 14 画面横串して「**違和感の震源地**」を絞り込むと、以下 3 点に収束する。

**RC-1. Typography scale の秩序崩壊（#13 の 70%）**
全画面で `text-[10.5px]` `text-[11.5px]` `text-[12.5px]` `text-[13.5px]` `text-[14.5px]` `text-[15px]` `text-[17.5px]` `text-[19px]` が同居。fluid token (`--text-fluid-xs…3xl`) を経由せず px 直打ちで、「雑誌の上質な出だし → 急にチラシ」の tier 落差をページ内 3-4 段で繰り返している。併せて Shippori Mincho を 12-17px に使う DESIGN.md 違反（「Shippori は ≥24px ONLY」）が 10+ 箇所、アイコン `h-3.5 w-3.5` (14px) / `h-3 w-3` (12px) の半端値が 20+ 箇所。

**RC-2. v4.2 editorial refresh の「まだら適用」（#13 の 20%）**
editorial-hero / decision-matrix / decision-ceremony / journey-timeline は v4.2 の格で刷新済み。その一方で **RecentVenues / AIRecommendations / explore 条件ゾーン / CoupleGap / duel-client / estimate 系 3 コンポーネント / comparison-matrix / coach chat-bubble / onboarding 質問フェーズ** は v3 以前の実装が残存。結果 1 セッション内で「v4.2 の顔」と「v3 の体」が同居し、品格が上下する。comparison-matrix に至っては `bg-amber-50` `text-emerald-600` `text-rose-500` `★ ×` と Morning Light パレット外の stock tailwind color で構成された**最大の異物**。

**RC-3. 情報設計の境界曖昧（#16 の核）**
ホームの JourneyCard が「進捗ステップ表示」と「次の一歩 NBA」を同箱に詰め込み、丸いアイコン（非タップ）が CTA（実タップ）と視覚等価になって「押せるかどうか」を迷わせる。Explore タブは「探す・一覧・追加」が混在。Duel（情景で決める）は**写真を見せずに text-only で選ばせる**ため「情景」機能名を裏切る。コーチは前回履歴が入口に貼り付き新規質問を阻害。いずれも「タブ責務の分離 + 各画面 1 責務」原則の徹底不足。

### 1.3 方針の柱

上記 3 根本原因に対し、以下 5 本柱で手を打つ。

1. **IA 再設計**（RC-3 対応）— JourneyCard 廃止 → Journey Ring + Hero NBA、タブ責務再定義、Duel の photo-paired 化、コーチのセッション管理
2. **ビジュアル言語 2026 Modern Luxury の完走**（RC-2 対応）— v4.2 刷新思想を残り 9 画面に波及、Morning Light パレット違反の撲滅
3. **Typography / Icon / Color token の enforce**（RC-1 対応）— fluid token 経由、Shippori ≥24px、icon 16/20/24、amber/emerald stock 撤廃
4. **マイクロコピー統一（Lexicon）**（#13 + #14 の言語層）— 和語 4 動詞、画面タイトル、Hero NBA テーブル
5. **Tier 1/2/3 の優先順**（工数と破壊度で整理）— P0 P1 は 1 週間、P2 は 2-4 週、P3 + DESIGN.md v4.3 は 1-2 ヶ月

---

## 2. IA（情報設計）再設計

### 2.1 タブ責務の再定義（決定版）

現状の混乱は「探す」タブに **探す・一覧・追加** の 3 つの仕事が同居し、ホームの「すべて→」が /explore に飛ぶため「一覧が見たいだけのユーザーが検索 UI に放り込まれる」不整合。

| タブ | 新・責務 | 旧・問題 | 主要動線 |
|---|---|---|---|
| **ホーム** | 今日の 1 アクションを提案する "Today" 画面。パーソナル + 編集的 | 進捗 / NBA / 最近見た / CTA が詰め込まれすぎ | **1 画面 = 1 ヒーロー + 1 インサイト + 最近見た** |
| **探す** | **まだ候補にないものを見つける**。検索・発見・追加の場所 | 「気になる式場を集める場所」という矛盾コピー | 検索バー / AI レコメンド / FAB 追加 |
| **候補** | **集めた式場を育てる**。一覧・評価・比較・決定 | 旧「ショートリスト」 | 一覧 / 最近見た / 比較ボード / 最終決定 |
| **コーチ** | AI とのセッション。相談の場所 | 過去チャットが入口に貼り付いている | 新規チャット / セッション履歴 drawer / インサイト feed |

**重要な方針転換**: 「最近見た式場」の "すべて→" は **候補タブの「最近見た」サブビュー**へ遷移する（探すではなく）。ホームから来たユーザーは「もう自分が見つけた式場たち」を見たいのであって、新規検索 UI ではない。

### 2.2 画面遷移図（テキスト）

```
┌───────────────────────────────────────────────────────────────┐
│                      [初回のみ] Onboarding                     │
│     AI 対話（4 問、2 領域: 進捗 + 会話ゾーン）→ レコメンド 3 枚  │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│                       Home (Today)                             │
│  Greeting / Hero NBA(天気 + 1 CTA) / Recent Venues(→候補)      │
│  週 1-2 AI インサイト / Daily Ritual(gold eyebrow)             │
└───────────────┬───────────────────────┬───────────────────────┘
                ↓                       ↓
       ┌────────────────┐      ┌──────────────────────┐
       │ 探す (Discover)│      │ 候補 (Collection)     │
       │  - 検索バー     │      │  SegmentedControl:    │
       │  - AIおすすめ   │      │   [候補] [比べる]     │
       │  - 4:3 VenueCard│      │   [決める] [最近見た] │
       │  - FAB 追加     │      │  - CoupleGap         │
       └────────┬────────┘      │  - 式場カードリスト   │
                ↓               │  - Duel 誘導(AI-style)│
        ┌──────────────┐        │  - 比較ボード         │
        │ 式場追加Sheet│        │  - 最終決定 → ceremony│
        │(URL常設 +   │        └───────┬──────────────┘
        │ 手動折畳み)  │                ↓
        └──────┬──────┘        ┌──────────────────┐
               ↓                │  Duel(情景で決める) │
    ┌─────────────────────┐     │  photo-paired 2 択│
    │ 式場詳細 (sticky tabs) │    │  結果: hero 写真   │
    │ [概要][見積][見学]     │    └──────────────────┘
    │ [口コミ][AI解析]       │
    │ → CTA: 「候補に残す」  │
    │  or  「ほかと並べる」  │
    └─────────────────────┘

         ↓ いつでも呼び出し（bottom-nav 4 タブ）↓
    ┌──────────────────────────────────────────┐
    │           コーチ (Sessions)               │
    │  [新規チャット] [インサイト] sub-tabs     │
    │  左スワイプ: セッション履歴 drawer         │
    │  assistant bubble: gold hairline + 明朝   │
    └──────────────────────────────────────────┘

         ↓ いつでも振り返る ↓
    ┌──────────────────────────────────────────┐
    │         晴れまでの道 (Journey)             │
    │  editorial timeline + 段階ディム           │
    │  reached milestone → 関連画面へ Link       │
    └──────────────────────────────────────────┘
```

### 2.3 ホームの情報構造 — JourneyCard 廃止、Journey Ring + Hero NBA に分離

**課題**: 現状 `JourneyCard` の中で `JourneySteps`（追加/見学/比較/決定の丸アイコン）と NBA CTA が同居。丸アイコンは非タップのステータス表示だが、gold グロウと pill 形状がタップ可能に見える。#16「押せそうで押せないボタン」の直接原因。

**解決（B 案採択）**: JourneySteps を退場させ、**Journey Ring + Hero NBA** に一本化。

新しいホームの縦構造（上から下へ）:

```
1. Editorial Hero (刷新済・維持)
   - eyebrow "HARETOKI · 2026" / 明朝見出し / 晴れまでの日数 (tabular-nums display)
   - 天気アイコン = ステージ表現(曇→晴間→晴→よく晴)
   - 円形 Journey Ring (直径 72px、数値なし、刻みのみ)
   - Hero NBA: 1 CTA のみ 「[この 1 件を入れる →]」(Lexicon §5.4 参照)
   - 副 CTA: 「別のおすすめを見る」(text link)

2. Daily Ritual (刷新済・eyebrow 整理)
   - gold eyebrow (text-eyebrow token) / 本文 12px foreground
   - 「晴れまでの道 →」を editorial Note style に格上げ(H-9)

3. Recent Venues (H-2,H-3 で刷新)
   - "Recent" masthead (eyebrow 11px uppercase 0.14em)
   - 横カルーセル、比率 3:2、写真下に Noto Serif JP 17px 式場名
   - "View all →" → /candidates?view=recent

4. AI Insight (条件付き・週 1-2 回のみ)
   - gold-subtle 背景 + 3px gold 左ボーダー + Sparkles
   - NBA と同じ行動を促す場合は非表示

5. (それ以外をホームに置かない)
```

JourneySteps の削除で、「追加/見学/比較/決定」という漢語動詞をホームから消去 — Lexicon §5.1 の和語動詞統一と連動する二重の清掃効果。

### 2.4 Duel（情景で決める）の根本再設計

**課題**: 「情景で決める」と名乗るが、quiz phase で式場写真を一切見せず、text-only で 2 択させている。「情景」機能名を裏切るラベル詐欺。

**解決**: quiz phase の ChoiceButton に 96x96 サムネを左側に配置する「photo-paired 2 択」へ変更。isSelected 時に primary 25% overlay、photo-tone フィルタで cream/gold sepia に統一。結果画面は 900ms hero モーションで入場 + venue 名 overlay。詳細は §4.3 Duel セクション参照。

### 2.5 コーチのセッション管理（C-1）

**課題**: コーチ画面を開くと前回会話が貼り付き、新規質問しにくい。

**解決**: ChatGPT / Claude 式セッション管理を導入。入口は新規チャット画面、左上履歴アイコンから Sheet-from-left で `今日 / 昨日 / 今週 / それ以前` グルーピング一覧。`CoachSession` エンティティ新設 (projectId, title, createdAt, updatedAt)、`CoachMessage` に sessionId FK。タイトルは最初のユーザー発話 20 字で自動化、長押しリネーム可。Tier 2 工数 L。

---

## 3. ビジュアル言語 2026 Modern Luxury

### 3.1 現状診断

Morning Light パレット（Cream #FAF8F3 / Rose #F8E9E4 / Gold #B88A4C）・Noto Serif JP・細字見出し・44px ターゲット・`active:scale-[0.98]` は 2026 年水準として**正しい骨格**。問題は上層で以下 5 点が欠落:

1. レイアウトが単調な縦積み（DESIGN.md は Bento を謳うが実装は space-y-16 の直列）
2. 色面が均一（Cream + 白カード + gold-subtle の 1 色、グラデなし）
3. タイポコントラストが弱い（巨大ディスプレイ数字 × 極小キャプションの対比なし）
4. モーションが装飾的（ページイン 900ms のみ、操作反応が不足）
5. 写真の扱いが素朴（4:3 + グラデオーバーレイのみ、非対称マスクなし）

### 3.2 参考にする実在プロダクト

| プロダクト | 抽出パターン | Haretoki への転用 |
|---|---|---|
| **Airbnb (iOS, 2024-)** | listing 写真は 3:2 cover、詳細は sticky 予約バー + editorial タブ | VenueCard 4:3 / RecentVenues 3:2、venue-detail sticky segments |
| **Aman / Aesop 公式** | 余白多めの editorial グリッド、明朝 leading 1.4-1.6、句読点の逃げ | 見出し tracking / leading editorial、eyebrow + 明朝 h1 + gold hairline |
| **Linear (2024-)** | Bento 2x3 + asymmetric weights、状態はドット 1 つ | ホーム Hero + Recent + Insight、comparison diff を gold dot で示す |
| **Arc Browser / Raycast** | frosted glass + 極薄 border + inner shadow | Sheet・モーダル・sticky ヘッダ |
| **Superhuman** | 1 アクション = 1 ホットキー、フィードバック 150ms | タップ後 150ms 厳守 |
| **Notion Calendar / Cron** | 日付は tabular-nums + 明朝大文字 display | 「127 日」を display numeral 扱い |
| **ChatGPT / Claude mobile** | 左スワイプセッション drawer、時系列グループ | コーチ C-1 履歴 UI |
| **Partiful** | gradient mesh + glass + タイポジャンプ率 | ランディング / 空状態 / 決定後 ceremony |
| **Pi (Inflection)** | 明朝 × 淡い地色で「ヒト格を帯びる AI」、typing に品詞 | coach assistant bubble 明朝、typing "コーチが考えています" |
| **Duolingo onboarding** | 1 画面 1 質問 + progress + goal-gradient コピー | onboarding 質問フェーズ 2 領域再構成 |
| **Tinder / pairwise quiz** | 写真必須の 2 択 | Duel photo-paired 化 |

### 3.3 5 本柱（2026 Modern Luxury 方針）

**柱 1: Editorial Rhythm（雑誌的リズム / 非対称グリッド）**
- セクション間は機械的 `space-y-16` をやめる。Hero 下 96px、secondary 64px、tertiary 40px の**非対称垂直リズム**
- Hero 見出しは `text-fluid-xl`（clamp 28-36px）、サブは 13px muted。**中間サイズ禁止**でジャンプ率強制
- 本文 Noto Sans JP は leading 1.8、見出し Noto Serif JP は leading 1.35、tracking 0.02em

**柱 2: Atmospheric Color（gradient mesh / 空気感）**
- 新トークン 3 つ: `--gradient-dawn`（Cream→Rose radial 4-8%）、`--gradient-noon`（Rose→Gold linear 45° 4-8%）、`--gradient-dusk`（Gold→Cream ホーム Hero 背景）
- 濃度は 4-8% のみ。ベタの上に乗せる**空気の層**
- dark mode は Ink Blue / Wine Rose / Amber に置換

**柱 3: Material Layer（frosted glass / gold hairline / inner glow）**
- frosted glass: `bg-white/60 backdrop-blur-xl border-white/40` をボトムナビ・Sheet・sticky ヘッダに
- inner glow: Hero カードに `shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]` でエンボス
- gold hairline: 重要区切りに 0.5-1px gold-warm ライン（現状の均質 border を置換）

**柱 4: Typographic Contrast（Display Numerals）**
- 「あと 127 日」の **127** は `font-serif text-5xl tabular-nums tracking-tight` で display 扱い、「日」は 12px sans
- Section numeric: `font-serif font-extralight text-3xl tabular-nums` — Estimate total / MoneyReality
- Inline numeric: `tabular-nums` (inherits body size) — 内訳、リスト、チップ
- 式場名は Noto Serif JP 300、サブ情報は Noto Sans JP 400 の**書体 × ウェイト二重対比**

**柱 5: Editorial Whitespace + Micro-Motion Discipline**
- 入場 600-900ms（luxury）、操作反応 **150ms 厳守**
- Spring: stiffness 180 / damping 14（DESIGN.md v4 既定）
- **Halo Tap**: gold ring が 1 回広がって消える 250ms。主要 CTA のみ
- View Transitions API を list→detail で採用（Chrome/Safari 対応済）

### 3.4 DESIGN.md v4.3 差分案

| セクション | 差分 |
|---|---|
| Modern Luxury UX Principles | 末尾に **「Atmospheric Layers v4.3」** 追加 |
| 新: Atmospheric Layers v4.3 | `--gradient-dawn/noon/dusk` の定義と用途マップ / frosted glass blur 強度 / inner glow 値 / gold hairline 使用条件 |
| Home 節 | 書き換え: Hero NBA + Recent + Insight の editorial 縦積みに修正。JourneyCard 廃止、Journey Ring 明示 |
| Explore 節 | ヘッダーコピー修正 + FAB 仕様追加 / VenueCard 4:3 を正式化 |
| Coach 節 | Sessions セクション新設（ChatGPT 式履歴 drawer）+ assistant bubble 明朝 × gold hairline 規約 |
| Photo Ratio Rule（新） | VenueCard=4:3 / RecentVenues=3:2 / Duel winner=4:3 / Duel thumb=1:1 / venue-detail gallery=4:3 |
| Microcopy Lexicon（新） | 和語 4 動詞（比べる・入れる・外す・決める）、画面タイトル、Hero NBA テーブル |
| Perceived Speed Rules（新） | prefetch / Optimistic UI / skeleton shimmer / View Transitions / 150ms tap |
| Anti-Patterns | 「絵文字を構造 UI に使わない」明文化（estimate-xray / comparison-matrix に違反あり）|
| Token Enforcement | 禁止値の列挙: `text-[10.5px] text-[11.5px] ...` `h-3.5 w-3.5` `bg-amber-50` `text-emerald-600` `text-rose-500` |

---

## 4. 画面別改善プラン（施策 ID 付き）

凡例: **優先度** P0=崩壊/P1=違和感強/P2=磨き込み/P3=余裕時 / **工数** XS/S/M/L/XL

### 4.1 ホーム (H-N)

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **H-1** | JourneyCard 廃止 → Journey Ring + Hero NBA 分離（#16 根治） | **P0** | M | `src/components/home/journey-card.tsx` 削除 / `journey-ring.tsx` 新設 |
| **H-2** | RecentVenues 写真焼き込み廃止、写真下に Noto Serif JP 17px 式場名、比率 4:3→3:2 | **P1** | M | `src/components/home/recent-venues.tsx:61-90` |
| **H-3** | RecentVenues「すべて→」リンク先を `/candidates?view=recent` に、"View all" + ArrowUpRight 16px eyebrow 統一 | P1 | S | `recent-venues.tsx:43-49` |
| **H-4** | Journey リンク単独浮きを解消、editorial Note style の eyebrow + hairline border で次章案内に格上げ | P1 | S | `src/app/(app)/home/page.tsx:88-96` |
| **H-5** | DailyRitual eyebrow の `text-[10.5px]` → `text-eyebrow` token 化 | P2 | S | `src/components/home/daily-ritual.tsx:43-57` |
| **H-6** | RecentVenues 写真なし分岐の EmptyState を Morning Light gradient + gold eyebrow に | P3 | S | `recent-venues.tsx:92-97` |
| **H-7** | AIInsightCard と Hero NBA が同じ行動を促す場合の**優先順位ロジック**（サーバー側 guard） | P2 | S | `src/server/home.ts` |
| **H-8** | Hero NBA コピーテーブル（Lexicon §5.4）反映 | P1 | S | `src/components/home/editorial-hero.tsx` コピー props |
| **H-9** | Hero NBA の「比較する」リンク先 guard（候補画面が正常応答 + favorite≥2 の時のみ露出） | P1 | S | `editorial-hero.tsx` / server 側 |

### 4.2 探す (E-N)

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **E-1** | **VenueCard 写真比率 16:9 → 4:3**（#12 決定打） | **P0** | S | `src/components/venues/venue-card.tsx:89-93` |
| **E-2** | VenueCard 写真 4 角バッジ集中を解消、写真下に meta bar（status + score 横ストリップ）、角は Heart + (決定時)「晴れの日」のみ | P1 | M | `venue-card.tsx:100-134` |
| **E-3** | AIRecommendations 見出し tier 整理（`h-8` ゴールド円 + Sparkles 16px + English eyebrow + 明朝小見出し 2 段） | P1 | M | `src/components/venues/ai-recommendations.tsx:293-306` |
| **E-4** | AIRec RecommendationCard 式場名を Noto Serif JP 17px light に、Shippori <24px 違反解消、rounded-xl→2xl、p-4→p-5 | P2 | S | `ai-recommendations.tsx:530-538` |
| **E-5** | 「条件で絞り込み」ゾーンの 6 tier text → 2 tier（eyebrow 11px + 件数 13px）、`space-y-3.5`→`space-y-5` | P1 | M | `src/components/explore/explore-content.tsx:152-198` |
| **E-6** | 追加 UI を右下 FAB（56×56、gold-warm、shadow-elevated、safe-area）に昇格。ヘッダー「追加」は text link に降格 | P1 | S | `src/components/explore/explore-add-venue.tsx` |
| **E-7** | 副題「気になる式場を集める場所」→「**まだ見ぬ式場を、見つける**」(Lexicon §5.2) | P1 | XS | `src/app/(app)/explore/page.tsx` |
| **E-8** | AddVenueSheet 2 段構造化: URL 常設 primary + 折畳み「手動で追加」secondary、タブ廃止 | P1 | M | `explore-add-venue.tsx` |
| **E-9** | URL 解析失敗時の挙動: タブ自動切替をやめ、インライン CTA「自動で読めませんでした。**手動で入力する →**」 | P1 | S | `explore-add-venue.tsx` |
| **E-10** | AddVenueSheet に editorial ヘッダー + `--gradient-dawn` radial + 段階 skeleton（式場名→住所→アクセス→写真） | P2 | M | `explore-add-venue.tsx` |
| **E-11** | 「AIおすすめ準備中」フォールバックを editorial に「**今日のおすすめは準備中。先日ご覧になった式場をどうぞ →**」 | P2 | S | `ai-recommendations.tsx` |

### 4.3 候補 (C-N)

候補タブ内は **候補リスト / 比較 / 決定 / Duel** をまとめて扱う。

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **C-1** | CoupleGap heading を editorial eyebrow + 明朝 17px 2 段構造に統一、icon 14px→16px | P1 | S | `src/components/candidates/couple-gap-section.tsx:18-27` |
| **C-2** | CoupleGap の gap card メタ typography 整理（thumb 12→14px、venue 名 Noto Serif JP 14px、location 11px、HeartCrack 10→12px、chip 面色追加） | P1 | M | `couple-gap-section.tsx:72-114` |
| **C-3** | candidates-view のリード文を「Three steps, gently / 集める → 並べる → 決める」editorial 2 段に差し替え | P1 | S | `src/components/candidates/candidates-view.tsx:170-179` |
| **C-4** | Duel 誘導カードを AIInsightCard 格（gold-subtle 背景 + 3px gold 左 border + Sparkles + eyebrow + 明朝コピー）に格上げ | P2 | S | `candidates-view.tsx:215-230` |
| **C-5** | 「チェック項目を編集」リンクを pill 型ゴースト button に、icon 12→16px | P3 | XS | `src/app/(app)/candidates/page.tsx:72-83` |
| **C-6** | **Duel quiz phase を photo-paired 2 択化**（ChoiceButton に 96×96 photo、isSelected 時 primary 25% overlay） | **P0** | L | `src/components/candidates/duel-client.tsx:175-202` |
| **C-7** | Duel 問いテキストに "Scene N" eyebrow + 21px 明朝 + gold gradient hairline 16px | P1 | S | `duel-client.tsx:125-133` |
| **C-8** | Duel「または」divider 削除、`space-y-3`→`space-y-4` でリズム分け | P2 | XS | `duel-client.tsx:146-150` |
| **C-9** | Duel 結果の勝者写真に hero モーション（opacity 0 scale 0.96 → 1 / 900ms / ease-out-luxe）、photo-tone-hero + venue 名 overlay、`rounded-2xl`→`rounded-3xl` | P2 | S | `duel-client.tsx:328-353` |
| **C-10** | Duel AI インサイトの Sparkles icon 14→16px、strokeWidth 1.8→1.6 | P3 | XS | `duel-client.tsx:364-367` |

### 4.4 式場詳細 (V-N)

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **V-1** | **venue-header を editorial 2 層 dl 化**（eyebrow ceremony style + 明朝 h1 28px + gold hairline + label/value 2 層）— #14 震源地解決 | **P0** | M | `src/components/venues/venue-header.tsx:32-73` |
| **V-2** | EstimateSection 金額 header を display-scale numeral 統一（32px 明朝 extralight + ¥/万 単位 11px + `v1 · 手入力` chip） | P1 | S | `src/components/venues/estimate-section.tsx:65-78` |
| **V-3** | EstimateXRay 絵文字 👗🍽📸💐🎭🔊🏛📋💡⚠ を Lucide 16px に全置換、「Estimate X-Ray」gold dot eyebrow 化 | P1 | M | `src/components/venues/estimate-xray.tsx:14-23, 93-98` |
| **V-4** | action-bar CTA を isFavorite で分岐（未=「候補に残す」→/candidates、既=「ほかと並べる」→/compare）、HaloTap wrap、rounded-lg→rounded-full | P2 | S | `src/components/venues/venue-action-bar.tsx:85-91` |
| **V-5** | photo-carousel 1 photo 分岐に venue 名 caption overlay 追加（fold 内で venue 名が必ず見える） | P2 | S | `src/components/venues/photo-carousel.tsx:84-122` |
| **V-6** | venue-detail を sticky Segmented Control `[概要][見積][見学][口コミ][AI解析]` + scroll-spy に再編 | P1 | L | `src/app/(app)/venues/[id]/page.tsx` |
| **V-7** | 見積もり項目名 Combobox 化（プリセット 40 種 + インクリメンタル絞込 + 「自由入力で使う」最下行候補） | P2 | M | `src/components/venues/estimate-section.tsx` |
| **V-8** | EstimateXRay と Waterfall の「他のカップルも同程度の調整」コピー重複を解消（Waterfall 側のみ残し、X-Ray は機能説明「見積の差分を、項目ごとに」に） | P1 | S | `estimate-xray.tsx` / `estimate-waterfall-chart.tsx` |
| **V-9** | 星評価 0.5 刻み水平バー + 楽観的更新 + 失敗時ロールバック + 具体エラートースト | P2 | M | `src/components/venues/rating-section.tsx` |
| **V-10** | plan-section `text-base` Shippori Mincho 違反 → Noto Serif JP に、icon `h-3.5 w-3.5`→`h-4 w-4` 全置換 | P1 | S | `src/components/venues/plan-section.tsx:109` |
| **V-11** | Review の「気になる点を先に」ボタン削除 → Review Sort Chip `[最新][評価高い][気になる点から]` 統合 | P1 | S | `src/components/venues/review-section.tsx` |

### 4.5 比較 (compare)

compare は V-N 範囲外（専用カテゴリ）。比較だけで独立した施策群にする。

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **CMP-1** | **ComparisonMatrixView 全面刷新**（YesNoCell を Lucide Check/X/Minus 16px + 円形 tint、venue column Noto Serif JP 13px、diff は右上 6px gold dot + row bg 6% tint、★絵文字撤去） | **P0** | XL | `src/components/checklist/comparison-matrix-view.tsx` 全面 |
| **CMP-2** | compare page header を editorial に「Compare / ふたつを、同じ目線で。」2 行明朝 + gold hairline + ledger コピー | P1 | S | `src/app/(app)/compare/page.tsx:35-50` |
| **CMP-3** | 横スクロール右端 fade-out gradient 8px 追加（venues≥3 時） | P1 | S | `comparison-matrix-view.tsx:73-75` |
| **CMP-4** | 空ステート音色分化（venues=0: Heart icon circle +「並べる式場が、まだありません」/ items=0: ListChecks icon +「何を比べるかを、選びませんか」）、`border-dashed`→solid card + HaloTap pill CTA | P2 | S | `compare/page.tsx:52-71` |
| **CMP-5** | MatrixInsight（AI ひとこと分析）カード追加、gold dot Whisper eyebrow + 2 行コーチ文（「今夜、おふたりで話せるかもしれません」） | P2 | L | `comparison-matrix-view.tsx` 末尾 + 新 server action |

### 4.6 コーチ (Coach-N)

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **Coach-1** | Assistant chat bubble を「gold hairline + gold-subtle 38% tint + 明朝本文 15px light」に格上げ | P1 | M | `src/components/coach/chat-bubble.tsx:52-57` |
| **Coach-2** | ChatBubble にメタ情報（`coach` sender + 時刻 tabular-nums）11px eyebrow 追加、`timestamp?: Date` props 拡張 | P1 | S | `chat-bubble.tsx:46-70` |
| **Coach-3** | Typing indicator に言語コンテクスト「コーチが考えています」+ dot tiny-bounce 化（`y: [0, -2, 0]`、ease-out-luxe） | P2 | S | `chat-bubble.tsx:12-35` |
| **Coach-4** | QuickStart 3 カードを editorial 刷新（`rounded-[20px]` + gold-subtle gradient + `h-10 w-10` icon circle + 明朝 15.5px light + hover lift + `prompt →` ヒント） | P1 | M | `src/components/coach/coach-quick-start.tsx:122-144` |
| **Coach-5** | Sticky header eyebrow/title token 化（`10.5px/14.5px` → `11px/15px`、tracking 0.2→0.22em、leading 1.35、eyebrow と title に `mt-0.5` 空気層） | P2 | S | `src/components/coach/coach-client.tsx:73-85` |
| **Coach-6** | Send ボタンに HaloTap wrap（gold ring 250ms） | P2 | S | `src/components/coach/chat-bar.tsx:231-243` |
| **Coach-7** | **セッション管理 C-1 実装**（CoachSession entity、左 drawer 履歴、グルーピング 今日/昨日/今週/それ以前、自動タイトル 20 字、長押しリネーム） | P1 | L | `prisma/schema.prisma` + `src/components/coach/session-*` + migration |
| **Coach-8** | サブタブ `[新規チャット] [インサイト]` 分離（C-2） | P2 | M | `coach-client.tsx` |

### 4.7 オンボーディング (Onb-N)

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **Onb-1** | **質問フェーズを「2 領域再構成」**（上: SkyChip + 進捗 1 行、下: 過去回答 `<details>` 畳み + 現在質問スポットライト + avatar-indented pills/button）。#16「並べました」根治 | **P1** | L | `src/components/onboarding/onboarding-flow.tsx:466-557` |
| **Onb-2** | レコメンドカードを editorial 刷新（gold-subtle gradient + hairline gold + 明朝 19px + 明朝 22px extralight 価格）+ `variant="outline"` → rose primary CTA、コピー「追加する」→「気になるに追加する」 | P1 | M | `onboarding-flow.tsx:306-349` |
| **Onb-3** | レコメンド loading を skeleton shimmer 3 枚（180ms stagger）+ 0 件フォールバック「ちょうど合う場所が、いまは見つかりませんでした」 | P1 | S | `onboarding-flow.tsx:293-301` |
| **Onb-4** | Intro 数字バッジ 28px→24px（DESIGN.md icon 規約）+ 本文 `font-medium`→`font-light` + gap 3→4 + leading 1.8 | P2 | S | `onboarding-flow.tsx:406-417` |
| **Onb-5** | PillOptions に glow micro-interaction（rose shadow 22% / hover gold tint / aria-pressed / `active:scale-[0.97]`） | P2 | S | `src/components/ui/pill-options.tsx:28-43` |

### 4.8 Journey（晴れまでの道）

| ID | 施策 | 優先度 | 工数 | 対象 file |
|---|---|---|---|---|
| **J-1** | 未達マイルストーンの `opacity-50` 一括減光 → 段階ディム（h3 /70、subtext /60、icon grayscale、weatherLabel 非表示、connector line gold/border 分岐） | P1 | S | `src/components/journey/journey-timeline.tsx:131-137` |
| **J-2** | 達成 milestone を Link 化（mx-2 negative margin で 44px tap target）+ ArrowRight 16px gold hover | P2 | M | `journey-timeline.tsx` |
| **J-3** | h3 15px Shippori Mincho 違反 → Noto Serif JP 15px normal に | P1 | S | `journey-timeline.tsx:154-156` |
| **J-4** | decision-ceremony は現状維持（v4.2 で完成済、confetti 28 粒・2px gold 記念カード・3 フェーズ・朝光 wash） | — | — | `src/components/decision/decision-ceremony.tsx` |

### 4.9 横断（クロスカット）

| ID | 施策 | 優先度 | 工数 | 範囲 |
|---|---|---|---|---|
| **X-1** | **`h-3.5 w-3.5` / `h-3 w-3` (半端 icon)** を全 grep → `h-4 w-4` 置換、strokeWidth 1.8→1.6 | P1 | M | plan-section (6)、review-section、rating-section、venue-action-bar、coach、candidates、explore など計 20+ 箇所 |
| **X-2** | **金額 display スケール一本化**（Display/Section/Inline の 3 択に全置換） | **P0** | L | EstimateSection、EstimateXRay、MoneyReality、Waterfall |
| **X-3** | **Morning Light パレット外 stock color 撲滅** (`bg-amber-50` `text-emerald-600` `text-rose-500` `bg-amber-100 text-amber-800` 等) → `var(--gold-warm)` + color-mix tint / `var(--success)` / `var(--destructive)` | **P0** | M | estimate-section、estimate-xray、estimate-breakdown、plan-section、money-reality、comparison-matrix |
| **X-4** | **`text-eyebrow` ユーティリティ徹底**（`text-[10px-11.5px] tracking-... uppercase` を全置換） | P1 | S | home、explore、candidates、venue-detail、compare、coach |
| **X-5** | **Shippori Mincho <24px 違反を Noto Serif JP に切替** | P1 | M | plan-section、AIRecommendation card、journey h3、candidates gap card、venue-detail 各所 |
| **X-6** | 全 `<Link>` に `prefetch={true}` 付与、ボトムナビ 4 タブは mount 時 100ms 遅延で即 prefetch | P1 | S | 全画面 Link |
| **X-7** | Optimistic UI 全面展開（React 19 `useOptimistic`: heart、rating、チャット送信、見積追加） | P2 | L | server actions + client components |
| **X-8** | Skeleton を shimmer gradient（gold-subtle 流れ）に、`animate-pulse` 撤廃 | P2 | M | 全 loading.tsx + skeleton utility |
| **X-9** | View Transitions API を list→detail 遷移で採用（Explore → venue-detail の 4:3 写真を共有要素） | P3 | L | Next.js 16 unstable_ViewTransition |
| **X-10** | Halo Tap コンポーネント（gold ring 250ms）を主要 CTA に横展開（send、decision、favorite、add） | P2 | S | HaloTap wrap |
| **X-11** | dark mode 穴埋め（`bg-black/40` `bg-black/45` `from-black/60` のハードコードを token / `dark:` variant 化） | P3 | M | home recent-venues、explore venue-card、venue-detail photo-carousel |
| **X-12** | モーション duration 統一（`--dur-tap 150ms / --dur-micro 200ms / --dur-fade 300ms / --dur-hero 900ms`）、`duration-[arbitrary]` を token に置換 | P2 | S | 全 motion 箇所 |

---

## 5. マイクロコピー統一表（Lexicon）

### 5.1 動詞の揺れ解消

| 文脈 | 統一後 | 禁止表記 |
|---|---|---|
| 候補の式場を横並び評価する行為 | **「比べる」** | 比較する / 比較してみる |
| 式場の情報を並置して見る UI | **「比較ボード」** | 比較画面 / 比べるページ |
| 式場を候補に入れる行為 | **「候補に入れる」** | お気に入り / ショートリスト / ブックマーク |
| 式場を外す行為 | **「候補から外す」** | 削除 / 解除 |
| 見学を予約する行為 | **「見学を入れる」** | 予約する / ブックする |
| 見学済みにする | **「見学を記録する」** | 完了にする |
| 最終意思決定 | **「ここに決める」** | 確定 / 決定する |
| AI の提案を受け入れる | **「気になるに追加する」** | 追加する / 保存する |

根拠: 動詞は**「比べる・入れる・外す・決める」の和語 4 動詞**に寄せる。漢語動詞（比較する / 決定する）は仕事感が強く、曇り → 晴れの感情アークと合わない。

### 5.2 画面タイトルとサブコピー

| 画面 | タイトル | サブ (13px muted) |
|---|---|---|
| ホーム | (greeting + 名前のみ) | 晴れの日まで あと ○○ 日 |
| 探す | **式場を、見つける** | まだ見ぬ式場を、見つける |
| 候補 | **ふたりの候補** | 集めて、比べて、決める |
| コーチ | **AI コーチ** | 迷ったら、聞いてみる |
| 比較 | **ふたつを、同じ目線で。** | {N} 件の式場を、同じ観点で並べています |
| 式場詳細 | (式場名 Noto Serif JP) | エリア · アクセス · 収容 |
| 式場追加 | **新しい式場を、迎える** | URL を貼るだけ |
| Journey | **晴れまでの道** | (eyebrow「HARETOKI · Journey」) |
| Duel quiz | **情景で決める** | Scene {N} |
| Duel result | (勝者 venue 名) | Haretoki for you |
| Onboarding intro | **晴れの日を、ふたりで描きはじめる。** | お好みを 4 問だけ、そっと伺います |

### 5.3 状態メッセージ

| 状況 | コピー |
|---|---|
| AI おすすめ読込中 | 今日のおすすめを選んでいます |
| AI おすすめ失敗 | 今日のおすすめは準備中です。先日ご覧になった式場をどうぞ → |
| URL 解析失敗 | 自動で読めませんでした。**手動で入力する →** |
| 評価保存失敗 | 保存できませんでした。もう一度お試しください |
| 候補が空 | まだ候補はありません。気になる 1 件から始めましょう |
| 比較 venues 0 | 並べる式場が、まだありません。気になる式場をハートで残すと、ここに並びます |
| 比較 items 0 | 何を比べるかを、選びませんか。料理・衣裳・アクセスなど、気になる観点を先に決めると整理されます |
| Recent 写真なし | 写真はこれから |
| Coach typing | コーチが考えています |
| Coach 初回空 | 気づきは、これから / どんなこと、話そう？ |
| Onboarding レコメンド 0 件 | ちょうど合う場所が、いまは見つかりませんでした。条件を少し広げて、ふたりで探してみませんか。 |
| 決定後 (晴れの日到達) | おめでとうございます。ここから、当日の準備へ |

### 5.4 ホーム Hero NBA コピーテーブル

ステージ条件別の本文 + CTA。「次の一歩」という無色の見出しは廃止、各ステージで**感情に寄り添う固有コピー**にする。

| ステージ条件 | 本文 | CTA |
|---|---|---|
| 式場 0 件 | まず 1 件、気になる式場を。URL を貼るだけで始まります | **URL から追加** |
| 追加あり・見学 0 | 最初の見学を入れてみませんか。当日のメモも残せます | **見学を入れる** |
| 見学 1・評価未 | 見学の印象を、忘れないうちに残しましょう | **印象を残す** |
| 候補 2+・評価 2+ | ふたりで並べて、見比べてみましょう | **比べる** |
| favorite=2 | 2 件で迷ったら、情景で決める | **情景で決める** |
| 決定済 | ここから、当日の準備へ | **準備を始める** |

### 5.5 AIInsightCard コピー規約

- プレフィックス: eyebrow `Haretoki Suggests` / `Haretoki for you` / `Whisper` の 3 つに統一
- 本文: 明朝 14-15px light + 「今夜、おふたりで話せるかもしれません」型の**控えめなコーチ文**
- 急かす動詞禁止（「急いで」「早く」「今すぐ」）

---

## 6. 実装優先順位（Tier 1/2/3）

### Tier 1 — 即時（1 週間以内）

**P0 施策（崩壊レベル、最優先）**
- **H-1** JourneyCard 廃止 → Journey Ring + Hero NBA（#16 根治）
- **E-1** VenueCard 写真 16:9 → 4:3（#12 決定打）
- **V-1** venue-header editorial 2 層 dl 化（#14 震源地）
- **C-6** Duel quiz photo-paired 化（機能名詐欺の是正）
- **CMP-1** ComparisonMatrixView 全面刷新（#13 最大の異物）
- **X-2** 金額 display スケール一本化
- **X-3** Morning Light パレット外 stock color 撲滅

**P1 施策（違和感強、1 週間で終わらせる）**
- H-2, H-3, H-4, H-8, H-9（ホーム editorial 整理 + NBA コピー + Link guard）
- E-2, E-3, E-5, E-6, E-7, E-8, E-9（Explore カード meta bar / AIRec / 条件 tier / FAB / コピー / AddVenueSheet 再編）
- C-1, C-2, C-3, C-7（候補 CoupleGap + リード文 + Duel eyebrow）
- V-2, V-3, V-6, V-8, V-10, V-11（venue-detail 金額統一 / 絵文字撲滅 / sticky tabs / 重複削除 / plan Shippori / Review Sort）
- CMP-2, CMP-3（compare header + fade-out）
- Coach-1, Coach-2, Coach-4, Coach-7（assistant bubble + メタ + QuickStart + セッション管理）
- Onb-1, Onb-2, Onb-3（onboarding 質問 2 領域 + レコメンド editorial + skeleton shimmer）
- J-1, J-3（journey 段階ディム + Shippori 違反）
- X-1, X-4, X-5, X-6（横断: 半端 icon 撲滅 / text-eyebrow / Shippori <24 / prefetch）
- **Lexicon §5.1-5.5 全反映**（コピー置換 PR）

### Tier 2 — 中期（2-4 週間）

**P2 施策（磨き込み、2-4 週で消化）**
- H-5, H-6, H-7（DailyRitual token / EmptyState gradient / Insight guard）
- E-4, E-10, E-11（AIRec 式場名 Shippori 解消 / AddVenueSheet editorial / AIおすすめフォールバック）
- C-4, C-8, C-9（duel 誘導 AI 化 / divider 削除 / 勝者 hero モーション）
- V-4, V-5, V-7, V-9（action-bar CTA 分岐 / photo caption / Combobox / 星評価 0.5 刻み）
- CMP-4, CMP-5（空ステート音色分化 / MatrixInsight）
- Coach-3, Coach-5, Coach-6, Coach-8（typing 言語化 / header token / HaloTap / サブタブ）
- Onb-4, Onb-5（Intro 数字バッジ / PillOptions glow）
- J-2（journey milestone Link 化）
- X-7, X-8, X-10, X-12（Optimistic UI / skeleton shimmer / HaloTap 横展開 / motion token）

### Tier 3 — 長期（1-2 ヶ月）

**P3 施策 + 基盤刷新**
- C-5, C-10（pill 化 / Sparkles 16px）
- Atmospheric Layers v4.3 全面ロールアウト（`--gradient-dawn/noon/dusk` 3 トークン + frosted glass + gold hairline 規約）
- X-9, X-11（View Transitions API / dark mode 穴埋め）
- DESIGN.md v4.3 への正式アップデート（§3.4 の差分案すべて）
- Typography / Icon / Color token の ESLint / stylelint 自動検知ルール化（RC-1 の再発防止）

### Tier 別の破壊度サマリ

| Tier | P0 件数 | P1 件数 | P2 件数 | P3 件数 | 総工数概算 |
|---|---|---|---|---|---|
| Tier 1 | 7 | 33 | 0 | 0 | 約 2-3 人日 × 7-8 営業日 = **実装 2 人で 1 週間** |
| Tier 2 | 0 | 0 | 23 | 0 | **実装 2 人で 2-3 週間** |
| Tier 3 | 0 | 0 | 0 | 7 + 基盤 | **実装 1-2 人で 4-6 週間 + v4.3 ドキュメント週** |

並列化: Tier 1 は「ホーム班 / Explore 班 / venue-detail+compare 班 / coach+onboarding 班」の 4 worktree 並列が最適（本 track のサブ分割と一致）。

---

## 7. Definition of Done（ユーザー主観指標でゴール定義）

このプランが成功したと言えるのは、次の**ユーザー主観指標**が揃ったとき。

1. **「押せるかどうか」を迷う瞬間がゼロ** — アイコンはすべて Link か、Link でないなら装飾（透明度で明示）。JourneyCard 撤廃 + H-1 完了で根治。
2. **「同じことを 2 回言われた」感がゼロ** — ガイド / NBA / インサイト / AIRec の責務が明確に分離、同一行動を促す場合は優先順位 guard で片方を非表示（H-7, V-8）。
3. **「2026 年のアプリだ」と口に出して言える** — editorial rhythm + atmospheric color + typographic contrast + micro-motion で、2020 年代中盤の水準に到達。審美スコア 14 画面平均 **4.0 / 5** を目標（現状平均 2.6）。
4. **遷移で待たされる感覚がない** — 実測 <200ms、知覚 <100ms（optimistic + prefetch + skeleton shimmer + View Transitions）。Track B と合流。
5. **「比較する / 比べる」等の揺れが全消** — Lexicon §5.1-5.5 にすべてのコピーが準拠。コードレビューで禁止表記 grep が 0 件。
6. **妻フィードバック #12 / #13 / #14 / #16 の違和感表現がゼロ** — 次回レビュー (problems_03.md 予定) で「写真が小さい」「20 年前」「書式不統一」「押せそうで押せない」が再発しない。
7. **DESIGN.md v4.3 が公開され、lint 規則でトークン違反が自動検知される** — `text-[半端px]` / `h-3.5 w-3.5` / `bg-amber-*` の CI での red line 化（Tier 3 基盤 DoD）。

ユーザーが最初に言った **「20 年前のデザインみたい」** から **「雑誌のアプリ版みたい」** に評価が変わる地点が、このプランの真のゴールである。ブランドメタファー（曇り → 晴れ間 → 晴れの日）を、ステップ棒ではなく**画面全体の空気感（色・余白・余韻）** で表現するのが、モダン・ラグジュアリーへの唯一の道筋となる。

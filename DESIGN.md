# Haretoki Design System v4.2 — "Modern Luxury · Editorial Refresh"

> Single Source of Truth for all design decisions.
> v3: Morning Light palette (Rose × Gold × Cream)
> v4: Modern Luxury UX Principles — affordance、知覚速度、micro-interactions
> **v4.2 (Sprint 2-5, 2026-04-15): editorial 刷新 5 画面、モーション予算 token 化、コピー辞書連動**
> 実装は必ずこのドキュメントに準拠する。

---

## v4.2 Changelog — Sprint 2-5 の主要アップデート

### 画面刷新（Sprint 2）
- **ホーム** (`editorial-hero.tsx`): 白枠カード廃止、editorial layout（日付 eyebrow + 明朝 light 見出し + 横 1 行メトリクス + SkyChip illustration + 小リング + flat primary CTA + gradient hairline）
- **コーチ** (`coach-client.tsx` / `session-history-sheet.tsx`): sticky frosted header（backdrop-blur-xl）+ 履歴 chip + gold-subtle「新しい会話」chip
- **追加 Sheet** (`add-venue-sheet.tsx`): 見出しを text-3xl → 17px に縮小、URL 入力を主役（gold→rose gradient frame）
- **比較マトリクス** (`decision-matrix.tsx`): Crown icon 撤去 → bg tint 10% + 総合/費用行は 2px gold band + 観点行は右上 6px dot、観点ごとのベスト block + AI ひとこと分析カード
- **決定セレモニー** (`decision-ceremony.tsx`): 朝光 wash + 2px gold 記念カード（明朝 30px 細字）+ confetti 28 粒に控えめ化

### 新コンポーネント
- `EditorialHero` — ホームの hero セクション（Stage 別 headline/sub/CTA）
- `SkyChip` — 56px 円形ブランドメタファー（cloud → sun-rays の 4 段階）
- `ChecklistStarterCTA` — `/checklist` 空状態の 16 項目一括 CTA
- `ReflectionHint` — `/checklist` 非空時の「反映先」ストリップ
- `MatrixInsight` — 決定マトリクス下の AI ひとこと分析カード

### 新トークン
- **Motion budget** (globals.css): `--ease-out-luxe`, `--ease-out-standard`, `--dur-tap 150ms`, `--dur-micro 200ms`, `--dur-fade 300ms`, `--dur-sheet 400ms`, `--dur-page 600ms`, `--dur-hero 900ms`, `--stagger 50ms`
- prefers-reduced-motion: reduce は既存ルールで全 transition を 0.01ms に潰す

### コピー
- `docs/copy-lexicon.md` に置換表と Tone of Voice を定義
- 全画面の UI 文言を「プロジェクト→ふたりの式場さがし」「保存→残す」「削除→消す」等に置換
- 絵文字 ✨ を削除、明朝 + eyebrow 構造で格を出す
- 詳細は [docs/copy-lexicon.md](./docs/copy-lexicon.md)

### 用語マッピング（UI / コード）
- UI「気になる」/ DB `Venue`（status='considering' 系）
- UI「印象メモ」/ DB `VenueScore`（source='user_rating'）
- UI「本命」/ DB `VenueFavorite`
- UI「晴れの日」/ DB `Decision`（Venue.status='selected' も同等）
- UI「ふたりの式場さがし」/ DB `Project`

---

## Modern Luxury UX Principles (v4 追加、最重要)

全ての実装でこれらを厳守する。プロダクトを「堅実な道具」から「プレミアム体験」に引き上げる原則。

### P1: 空ステートは招待状である
「〜がありません」で終わらせない。タップすると次に進める **Drop Zone** や **Inline Action** にする。
- NG: 静的テキスト「写真はまだありません」
- OK: タップ可能な写真追加ボタン + Camera アイコン + 破線枠

### P2: 情報設計は無意識に正しい
アイコンとラベルの意味が一致する。ユーザーが考えなくていい。
- 歯車アイコン = 設定（システム設定）
- 人/UserCircle アイコン = マイページ（個人情報）
- NG: 歯車アイコン + 「マイページ」ラベル（矛盾）

### P3: フィードバックは即時かつ複層
タップから **150ms 以内** に何かが変わる。楽観的更新を多用。
- 色変化 + スケール変化 + 影 の複数レイヤー
- サーバー応答を待たずUI先行更新

### P4: 知覚速度 > 実測速度
- 全 `<Link>` に `prefetch` 明示
- skeleton は実レイアウトと一致（レイアウトシフトなし）
- ページ間の白画面をゼロに

### P5: タッチターゲット44px + 視覚48-56px
指の楽さで設計。ラベルは `text-xs` (12px) 以上。

### P6: アニメーション速度
- ホバー/タップ反応: **200ms**（400msは遅すぎる）
- ページ入場: 600-900ms（ラグジュアリー感）
- マイクロ動作（スケール、色変化）: 150-250ms
- Spring: stiffness 150-200 / damping 12-18（キビキビ）

---

## Atmospheric Layers v4.1

> Added Phase 3 (2026-04-14). Layered on top of Morning Light v3 palette — never replaces existing tokens.

### Overview

The "Atmospheric Layers" system adds translucent gradient color planes, frosted-glass surfaces, and gold hairlines that evoke the light quality of a clear morning. Every layer sits at 4-8% opacity maximum — air, not paint.

### New Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--gradient-dawn` | radial-gradient, cream→rose-subtle (5%) | Section backgrounds; most delicate, use sparingly |
| `--gradient-noon` | linear 45°, rose-subtle→gold-subtle (5-6%) | Card interiors; mid-day energy |
| `--gradient-dusk` | linear 180°, gold-subtle→cream (4-5%) | **Home Hero card background** — warmth before rest |
| `--hairline-gold` | 0.5px solid gold-warm/35% | Section separators in venue detail; Sheet internal dividers |
| `--glass-surface` | rgba(255,255,255,0.60) | Reference value for frosted glass surfaces |
| `--inner-glow` | inset 0 1px 0 rgba(255,255,255,0.60) | Hero card top edge — soft emboss |

#### Dark mode equivalents
Dawn → Ink Blue tint (oklch hue 270), Noon → Wine Rose (hue 350), Dusk → Amber (hue 70). All at equivalent low opacity.

### Material Layer Rules

#### Frosted Glass (backdrop-blur-xl)
Apply to surfaces that float above page content:
- BottomNav: `bg-white/60 backdrop-blur-xl border-white/40`
- Sheet (bottom/side): same `bg-white/60 backdrop-blur-2xl` + `border-white/40`
- Sticky segmented nav headers: `bg-white/60 backdrop-blur-xl`

Rules:
- Never apply to inline cards (they do not float above content)
- Dark mode: swap `bg-white/60` for `bg-black/60`, `border-white/40` for `border-white/10`
- Do not stack two frosted glass layers (avoid double blur)

#### Inner Glow
Use `var(--inner-glow)` only on prominent Hero cards (Home HeroNba). Creates an embossed top edge that lifts the card visually.

#### Gold Hairline
Use `border-[var(--hairline-gold)]` for:
- Section separators inside venue detail sheets (e.g., between Estimate and Notes)
- Horizontal rule between Sheet header and Sheet body
- `h-px w-16 bg-gradient-to-r from-[var(--gold-warm)]/60` decorative accent under venue name

Do **not** use for structural borders (use `border-border` there).

### Halo Tap

The `<HaloTap>` component (`src/components/ui/halo-tap.tsx`) wraps any CTA and fires a gold ring ripple on touch/click. Duration: 250ms, easing: cubic-bezier(0.16, 1, 0.3, 1).

**Apply to:**
- Home Hero NBA primary CTA
- Explore Add-Venue FAB
- DecisionCeremony primary CTAs

**Rules:**
- `aria-hidden` + `pointer-events-none` on the ring element — purely decorative
- Compatible with `active:scale-[0.98]` on child buttons
- Respects `prefers-reduced-motion` via global CSS animation kill

### Typography Contrast — Display Numerals

Three-size scale only. No middle-ground sizes allowed between levels.

| Scale | Spec | Usage |
|-------|------|-------|
| **Display** | `font-serif font-extralight text-5xl tabular-nums tracking-tight` | "晴れの日まで 127日" counter; single hero numerals |
| **Section numeric** | `font-serif font-extralight text-3xl tabular-nums tracking-tight` | Estimate summary amounts (¥350万), progress % |
| **Inline numeric** | `tabular-nums` (inherits body size) | Lists, table cells, minor counts |

Units (「日」「万」「名」) use `text-[11px]` sans-serif muted, vertically baseline-aligned with the number.

### Motion — Luxury Ease

Standard easing: `cubic-bezier(0.16, 1, 0.3, 1)` — exported as `LUXURY_EASE` from `src/lib/motion-variants.ts`.

| Context | Duration | Notes |
|---------|----------|-------|
| Hero section entry | 600ms | Down from 900ms for snappier feel |
| Secondary sections | 400ms | 50ms stagger between items |
| Tap feedback (Halo ring) | 250ms | Fast, not lingering |
| General micro-interactions | 150-200ms | Unchanged from v4 |

---

## Product Vision

**「二人で自然に、迷わず、後悔なく式場を選べるプロダクト」**

Haretoki (晴れ時) is not a listing site. It is a premium decision companion that guides couples through venue selection with AI-powered insights, transparent estimates, and collaborative tools. The brand metaphor is a journey from cloudy uncertainty to sunny confidence.

### Core Insights (Research-backed)

| Stat | Source | Design Implication |
|------|--------|--------------------|
| 80% experience estimate gap (+¥84-110万) | ゼクシィ結婚トレンド調査 | Estimate transparency is #1 feature |
| 66% fight during wedding prep | ハナユメ調査 | Partner experience must reduce friction |
| 68.5% regret venue selection process | Wedding Table | Decision confidence > decision speed |
| Average 2.6 venue visits | ゼクシィ調査 | Online comparison must be powerful |

### Target Persona

**Primary**: 20-30代カップル。こだわりたいが時間がない。IT リテラシーは高め（前提）。右も左も分からないが、妥協はしたくない。

### Competitive Position

Haretoki is **not** a media/advertising platform (unlike Zexy, Hanayume). It is a **neutral decision tool** — no venue pays for placement. The design must convey this independence through data transparency and AI attribution.

---

## User Journey

### Core Flow: AI-Guided → Free Navigation

```
[初回] AI対話オンボーディング (3-4問)
  ↓ 好み・条件を把握 → 式場を自動提案
[2回目以降] ホーム中心の自由ナビゲーション
  ↓ AIコーチが「次のおすすめ」をカードで提案
  ↓ ユーザーは自由にどのタブからでも行動
```

**設計原則**:
- ステップ番号は見せない（仕事感の排除）
- 進捗は控えめなリング表示のみ
- AIが行動を見て先回りで提案（プロアクティブ）
- どの画面からでも自由にジャンプ可能

### Emotion Arc

```
不安 → 発見 → 比較 → 確信 → 祝福
"何から始めれば?" → "こんな式場が!" → "データで納得" → "二人で決めた!" → "おめでとう!"
```

---

## Navigation

### Bottom Navigation (4 tabs)

| Tab | Icon | Label | Content |
|-----|------|-------|---------|
| 1 | Home | ホーム | パーソナライズグリーティング + AIインサイトカード + 進捗リング + 最近見た式場 + クイックアクション |
| 2 | Search | 探す | 式場カードブラウズ + フィルタチップ + 式場追加（URL/手動）|
| 3 | Heart | 候補 | ショートリスト + 比較ボード + 最終決定 |
| 4 | MessageSquare | コーチ | AIインサイトカード（フィード）+ チャットバー |

**設計ルール**:
- アイコン + テキストラベル（アイコンのみ禁止）
- アクティブタブ: gold-warm (#C9A84C) アイコン + ラベル
- 非アクティブ: muted-foreground (#64748B)
- バッジ: 候補タブに件数、コーチタブに未読インサイト数
- 高さ: 56px + env(safe-area-inset-bottom)
- タッチターゲット: 各タブ最低48x48px

---

## Screen Specifications

### 1. AI Onboarding (初回のみ)

**Pattern**: Jasper AI式チャットバブル + Intercom式プログレス

```
┌─────────────────────────────┐
│  Step 1 of 4  ████░░░░      │ ← thin progress bar
│                             │
│  ┌─────────────────────┐   │
│  │ 🤖 AIアバター        │   │
│  │ おめでとうございます！  │   │ ← chat bubble (left-aligned)
│  │ まず教えてください。   │   │
│  │ どんな式場が気になり   │   │
│  │ ますか？              │   │
│  └─────────────────────┘   │
│                             │
│  ┌──────┐ ┌──────┐        │ ← pill buttons
│  │チャペル│ │ガーデン│        │
│  └──────┘ └──────┘        │
│  ┌──────┐ ┌──────────┐   │
│  │ホテル │ │レストラン │   │
│  └──────┘ └──────────┘   │
│                             │
│  [スキップ]                  │ ← always available
└─────────────────────────────┘
```

**設計ポイント**:
- 3-4問で必ず終わる。5問以上にしない
- 各質問にコンテキスト副題（「あなたにぴったりの式場をお勧めするために」）
- Skip動線を全ステップに配置
- 回答はチャットバブルとして蓄積表示（会話感）
- 最終ステップ後に「パーソナライズ完了」→ おすすめ式場カード表示 → ホームへ

### 2. Home (ホーム)

**Pattern**: Asana式グリーティング + Bento式グリッド + Tripadvisor式横スクロール

```
┌─────────────────────────────┐
│ VenueLens            🔔 👤  │ ← header
├─────────────────────────────┤
│                             │
│ こんにちは、○○さん           │ ← greeting (Noto Serif JP, 300, 24px)
│ 結婚式まであと 127日         │ ← subtitle (muted, 14px)
│                             │
│ ┌────────────────┬────────┐│
│ │ ✨ AIコーチ     │ 進捗    ││ ← bento grid (2/3 + 1/3)
│ │ 見積もりが出揃い │  62%   ││
│ │ ました。比較し  │ ○──○   ││ ← progress ring
│ │ てみましょう    │ 4/7    ││
│ │ [比較する][質問] │        ││ ← suggestion chips
│ └────────────────┴────────┘│
│                             │
│ [🔍式場検索][💰見積比較]     │ ← quick actions (4 grid)
│ [📋チェック][❤️候補一覧]     │
│                             │
│ 最近見た式場      すべて → │ ← section header
│ ┌────┐┌────┐┌────┐        │ ← horizontal scroll cards
│ │ 📷 ││ 📷 ││ 📷 │        │    280x180px photo + info
│ │名前││名前││名前│        │
│ │★4.2││★4.5││★3.8│        │
│ └────┘└────┘└────┘        │
│                             │
├─────────────────────────────┤
│ 🏠  🔍  ❤️  💬             │ ← bottom nav
└─────────────────────────────┘
```

**AIインサイトカード**:
- 背景: gold-subtle (rgba(201,168,76,0.08))
- 左ボーダー: 3px gold-warm
- アイコン: Sparkles (Lucide), gold-warm
- チップ: 白背景, border #E0E5EB, 32px高, 14px text
- タップでコーチタブまたは該当画面に遷移

**進捗リング**:
- 直径: 80px, ストローク6px
- 背景トラック: border色
- プログレス: primary色
- 中央: % (24px, 700)
- 下部: "4/7完了" (12px, 400, muted-foreground)
- アニメーション: 0→現在値, 600ms ease-out

**クイックアクション**:
- 4等分グリッド, gap 12px
- 各: 白背景, 角丸12px, shadow-card, padding 16px
- アイコン24px (primary) + ラベル12px/500 中央揃え
- タップ: scale(0.98) 120ms

### 3. Explore (探す)

**Pattern**: Airbnb式カード + Fresha式フィルタチップ

```
┌─────────────────────────────┐
│ 式場を探す          [+ 追加]│
├─────────────────────────────┤
│ [エリア▼][人数▼][予算▼][+]  │ ← filter chips (horizontal scroll)
├─────────────────────────────┤
│ ┌───────────────────────┐  │
│ │ [3:2 Photo]       [♡] │  │ ← venue card
│ │ [見学済]               │  │ ← status badge (pill, top-left)
│ │ ← ● ● ● →             │  │ ← carousel dots
│ ├───────────────────────┤  │
│ │ アニヴェルセル表参道     │  │ ← Noto Serif JP, 16px, 500
│ │ ★ 4.5 (128件) · 表参道  │  │ ← rating + location
│ │ 着席80名 · ¥350万〜     │  │ ← capacity + price (gold-warm)
│ │ [チャペル] [ガーデン]    │  │ ← style tags
│ └───────────────────────┘  │
│                             │
│ ┌───────────────────────┐  │
│ │ [3:2 Photo]       [♡] │  │ ← next card
│ │ ...                    │  │
│ └───────────────────────┘  │
├─────────────────────────────┤
│ 🏠  🔍  ❤️  💬             │
└─────────────────────────────┘
```

**式場カード仕様**:

| Element | Spec |
|---------|------|
| Card width | 100% (mobile 1col), 50% (tablet 2col), 33% (desktop 3col) |
| Photo ratio | 3:2, object-fit: cover (myreview-02 item 12 — 4:3 made the feed feel top-heavy) |
| Photo占有率 | ~60% of card height |
| Border radius | 16px |
| Shadow (rest) | 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06) |
| Shadow (hover) | 0 4px 12px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.1) |
| Hover | translateY(-4px) 300ms cubic-bezier(0.4,0,0.2,1) |
| Tap | scale(0.98) 150ms |
| Heart icon | 右上, 白半透明背景円(32px), アイコン20px |
| Heart color | 未選択: white, 選択: #FF385C |
| Heart animation | scale 1→1.2→1.0, 200ms ease-out |
| Badge | pill, 左上, 白背景, 黒文字, font-size 11px, px-2 py-0.5 |
| Venue name | Noto Serif JP, 16px, weight 500, letter-spacing 0.05em |
| Price | gold-warm color, tabular-nums |
| Style tags | pill chips, muted background, 11px |

**カード内カルーセル** (Trulia式):
- 写真部分を左右スワイプで切替
- ドットインジケーター（写真下部中央）
- 式場の異なる写真（チャペル、披露宴会場、料理）

**フィルタチップ**:
- 水平スクロール, gap 8px
- pill形状, 高さ36px, padding 8px 16px
- 未選択: 白背景 + border色ボーダー
- 選択済み: primary背景 + 白文字
- タップでボトムシート展開 (mobile) / ドロップダウン (desktop)

**式場追加**:
- ヘッダー右の「+ 追加」ボタン
- URL貼り付け → AI自動抽出 or 手動入力の選択

### 4. Candidates (候補)

**3つのサブビュー**: ショートリスト / 比較ボード / 最終決定

#### 4a. ショートリスト

- ハートで追加した式場のカードリスト
- 各カードに二人のクイックリアクション（♥/🤔/✗）表示
- 「比較する」ボタンで比較ボードへ (2-3件選択)

#### 4b. 比較ボード

**Pattern**: Tesla式Help Me Choose + DJI式差分トグル + Teal式スコア

```
┌─────────────────────────────┐
│ 比較ボード [AIにおすすめを聞く]│ ← Tesla-style CTA
├─────────────────────────────┤
│ [式場A ▼] [式場B ▼] [+ 追加]│ ← venue selector dropdowns
├─────────────────────────────┤
│ Quick Look                   │ ← Apple-style summary
│ ┌──────────┬──────────┐     │
│ │ 📷 式場A  │ 📷 式場B  │     │
│ │ ○ 82点   │ ○ 75点   │     │ ← circular progress score
│ │ 料理◎    │ アクセス◎│     │ ← top strengths (3 items)
│ │ 雰囲気◎  │ コスパ◎  │     │
│ │ ¥380万   │ ¥320万   │     │
│ └──────────┴──────────┘     │
├─────────────────────────────┤
│ カテゴリ別スコア              │
│ [差分のみ表示 ○]              │ ← DJI-style toggle
│                             │
│ 雰囲気    ████████░░ 4.2    │ ← progress bars per dimension
│           ██████░░░░ 3.5    │
│ 料理      █████████░ 4.8    │
│           ███████░░░ 3.8    │
│ ...                         │
├─────────────────────────────┤
│ ▼ 基本情報                   │ ← accordion sections
│ ▼ 費用・見積もり              │
│ ▼ アクセス・設備              │
│ ▼ 持ち込みポリシー            │
├─────────────────────────────┤
│ ✨ AIインサイト               │ ← Grammarly-style inline card
│ 「式場Aは料理が高評価。       │
│  式場Bはコスパが優秀。        │
│  予算重視なら式場Bが...」     │
│ [詳しく聞く]                  │ ← links to Coach tab
└─────────────────────────────┘
```

**比較スコア表示**:
- 円形プログレス: 直径64px, ストローク5px
- カテゴリ別バー: 高さ8px, 角丸4px
- カラーコード: 4.0+ gold-warm, 3.0-3.9 warm-gray, <3.0 muted-rose
- 「差分のみ表示」トグルで同値行を非表示

**モバイル対応**:
- 2式場まで横並び、3式場目は横スクロール
- ヘッダー行（式場名）: sticky top
- 各セクションはアコーディオン

#### 4c. 最終決定

**Pattern**: Riverside式コンフェッティ + Instacart式タグチップ + Zapier式旅路サマリ

**3フェーズ構成**:

1. **セレブレーション (0-2秒)**: フルスクリーンコンフェッティ (800ms, Navy+Gold粒子) + 「おめでとう、○○さん!」
2. **決定サマリカード**: 式場写真 + 名前 + 旅路サマリ（「10会場調査 → 5候補 → 3比較 → [会場名]に決定」）
3. **理由記録 (任意)**: タグチップ選択 (「雰囲気」「料理」「コスパ」「アクセス」「サービス」) + 自由テキスト + 「スキップ」リンク

### 5. Coach (コーチ)

**Pattern**: カード + チャットのハイブリッド

```
┌─────────────────────────────┐
│ AIコーチ                     │
├─────────────────────────────┤
│ ┌───────────────────────┐  │
│ │ ✨ 見積もりインサイト    │  │ ← insight card (gold border)
│ │ アニヴェルセルの見積もり  │  │
│ │ 料理が最低ランクです。   │  │
│ │ 一般的に+15〜30万円      │  │
│ │ 上がります。             │  │
│ │ [詳しく見る] [了解]      │  │
│ └───────────────────────┘  │
│                             │
│ ┌───────────────────────┐  │
│ │ 💑 パートナー比較       │  │ ← partner insight card
│ │ 料理で2点差あり。       │  │
│ │ 話し合ってみませんか？   │  │
│ │ [比較を見る]            │  │
│ └───────────────────────┘  │
│                             │
│ ┌───────────────────────┐  │
│ │ 📋 見学準備             │  │ ← visit prep card
│ │ 明日の見学で確認すべき   │  │
│ │ 5つのポイント           │  │
│ │ [チェックリストを見る]   │  │
│ └───────────────────────┘  │
│                             │
│ ─────────────────────────  │
│ [質問を入力...]         [↑] │ ← chat input bar
└─────────────────────────────┘
```

**インサイトカード種別**:

| Type | Icon | Border Color | Trigger |
|------|------|-------------|---------|
| 見積もり | Receipt | gold-warm | 見積もり入力後 |
| パートナー | Users | primary | 評価差分検出時 |
| 見学準備 | ClipboardCheck | success | 見学3日前 |
| 比較分析 | BarChart3 | secondary | 候補2件以上時 |
| リマインダー | Bell | muted-foreground | 見学後未評価時 |

**チャットUI**:
- AI回答: 左寄せ、muted背景、角丸12px (左下のみ4px)
- ユーザー入力: 右寄せ、primary背景、白文字
- サジェストチップ: チャット下に最大3個、pill形式

### 6. Venue Detail (式場詳細 — ドリルダウン)

式場カードタップで遷移。全情報をここに集約。

**セクション構成**:
1. フォトギャラリー (横スワイプ、3:2 — カードと詳細で比率を揃える)
2. 基本情報 (名前、住所、アクセス、収容人数、スタイル)
3. 評価 (6次元星評価 + パートナー比較ビュー)
4. 見積もり (バージョン一覧 + AI分析)
5. 見学記録 (メモ、写真、チェックリスト)
6. 口コミAI要約

### 7. Partner Experience (パートナー体験)

**段階的エンゲージメント (3レベル)**:

| Level | Trigger | UI | Account Required |
|-------|---------|-----|-----------------|
| 1. 招待 | LINEリンク共有 | 式場カード + 👍/🤔/👎 リアクション | No (guest) |
| 2. 関心 | リアクション後の誘導 | 6次元星評価 + 一言コメント | Yes |
| 3. 本気 | 自発的 | フルアプリ（全機能） | Yes |

**招待フロー (Revolut式)**:
- シェアバー: LINE (最優先) → コピーリンク → メッセージ → More
- Daze式空きスロット: パートナー未招待 = 空き円形アバター

**パートナー評価比較ビュー**:
- 各次元で二人の星を並べて表示
- 2点以上の差分をハイライト (amber背景)
- AIが「雰囲気では一致。料理で意見が分かれています」とサマリ

---

## Design System

### 1. Color System — "Morning Light" Palette

コンセプト: 夜明けから朝日が差し込む瞬間。Rose = ユーザーのアクション、Gold = AIの贈り物。

#### Light Mode (oklch)

| Token | Value | Hex Approx | Usage |
|-------|-------|------------|-------|
| `--background` | `oklch(0.97 0.01 80)` | `#FBF7F1` | Page background (warm cream) |
| `--foreground` | `oklch(0.22 0.02 50)` | `#2A2320` | Primary text (warm charcoal) |
| `--card` | `oklch(0.99 0.005 80)` | `#FFFCF8` | Card surfaces (ivory) |
| `--card-foreground` | `oklch(0.22 0.02 50)` | `#2A2320` | Card text |
| `--primary` | `oklch(0.62 0.12 45)` | `#C4816E` | Rose terracotta — CTA, active states |
| `--primary-foreground` | `oklch(0.99 0 0)` | `#FFFCF8` | Text on primary |
| `--secondary` | `oklch(0.45 0.06 50)` | `#6B5A4E` | Warm brown — secondary actions |
| `--accent` / `--gold-warm` | `oklch(0.70 0.13 80)` | `#C9A44C` | Gold — AI features, logo, special moments |
| `--accent-foreground` | `oklch(0.22 0.02 50)` | `#2A2320` | Text on accent |
| `--muted` | `oklch(0.95 0.01 75)` | `#F3EDE4` | Muted backgrounds (linen) |
| `--muted-foreground` | `oklch(0.52 0.02 60)` | `#7A7068` | Secondary text |
| `--border` | `oklch(0.91 0.02 70)` | `#E8E0D6` | Default borders |
| `--destructive` | `oklch(0.55 0.15 25)` | `#C75B5B` | Errors (soft red) |
| `--success` | `oklch(0.58 0.14 155)` | `#5BA87A` | Positive (gentle green) |

#### Gold Accent Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--gold-warm` | `oklch(0.70 0.13 80)` / `#C9A44C` | AI insights, logo, star ratings |
| `--gold-light` | `oklch(0.80 0.10 80)` / `#E2CC8A` | AI card backgrounds |
| `--gold-subtle` | `oklch(0.70 0.13 80 / 0.10)` | AI card backgrounds, featured items |

**Color Usage Rules**:
- **Rose** = user actions (buttons, hearts, tap targets)
- **Gold** = AI features (insights, recommendations, coach)
- When both appear: Gold for text/icons only, Rose for buttons/interactive only

#### Score Color Scale

| Range | Color | Meaning |
|-------|-------|---------|
| 4.5-5.0 | `--gold-warm` | Excellent |
| 4.0-4.4 | `--gold-light` | Very Good |
| 3.5-3.9 | `#9B8E7E` | Good |
| 3.0-3.4 | `--muted-foreground` | Average |
| < 3.0 | `--destructive` | Below Average |

#### Dark Mode

| Token | Value |
|-------|-------|
| `--background` | `oklch(0.15 0.01 50)` (warm dark) |
| `--card` | `oklch(0.20 0.01 50)` |
| `--foreground` | `oklch(0.95 0.005 80)` |
| `--border` | `rgba(255,255,255,0.06)` |
| `--accent` | brighter gold for dark bg |

### 2. Typography

#### Font Stack

| Role | Font | CSS var | Weights | Usage |
|------|------|---------|---------|-------|
| Display serif (JP) | Shippori Mincho | `--font-display` | 400, 500, 600 | Hero copy, greeting h1, venue-name h1 ONLY (≥24px) |
| Body serif (JP) | Noto Serif JP | `--font-noto-serif-jp` | 300, 400, 500 | All other headings, section titles, subtitles |
| Body (JP/EN) | Noto Sans JP | `--font-noto-sans-jp` | 300, 400, 500, 700 | Body text, labels, UI, data |
| Numbers | Geist | `--font-geist` | 400, 500, 600, 700 | Prices, scores, stats (tabular-nums) |

**Display serif rule**: Shippori Mincho is the display serif reserved for the
most prominent headings where the extra character matters. Use via
`font-[family-name:var(--font-display)]` paired with `font-extralight`.
Do **not** apply to body text, subtitles, or any text smaller than 24px —
Noto Serif JP remains the body serif and is more legible at small sizes.

#### Heading Treatment (Luxury)

```css
h1 { font-weight: 300; letter-spacing: 0.15em; line-height: 1.8; }
h2 { font-weight: 400; letter-spacing: 0.1em;  line-height: 1.6; }
h3+ { font-weight: 400; letter-spacing: 0.05em; line-height: 1.5; }
```

**Key**: Light weight (300-400), NOT Bold. Wide tracking + generous line-height = Japanese luxury.

#### Fluid Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-fluid-3xl` | `clamp(1.75rem, 1.25rem + 2.5vw, 3rem)` | Hero/display |
| `--text-fluid-xl` | `clamp(1.25rem, 1rem + 1.5vw, 2rem)` | Page headings |
| `--text-fluid-lg` | `clamp(1.125rem, 1rem + 0.75vw, 1.375rem)` | Card titles, venue names |
| `--text-fluid-base` | `clamp(1rem, 0.9rem + 0.5vw, 1.125rem)` | Body text |
| `--text-fluid-sm` | `clamp(0.875rem, 0.8rem + 0.3vw, 1rem)` | Metadata |
| `--text-fluid-xs` | `clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem)` | Labels |

#### Tabular Numbers

All numeric data: `font-variant-numeric: tabular-nums;`

### 2b. Photos — Unified Tone Rule

All venue photos and hero images MUST be rendered through the
`VenueImage` wrapper (`src/components/ui/venue-image.tsx`), which applies
a shared CSS filter so that wildly different source materials resolve to
a single warm, cinematic luxury-hotel-brochure register.

| Tone | Class | Filter | When to use |
|------|-------|--------|-------------|
| `default` | `.photo-tone` | `saturate(0.92) contrast(1.04) brightness(1.01) sepia(0.03)` | Venue cards, gallery thumbnails, non-active carousel slides, empty-state art |
| `hero` | `.photo-tone-hero` | `saturate(0.95) contrast(1.06) brightness(1.01) sepia(0.04)` | Active carousel photo, single-photo hero, landing-page hero background |
| `none` | _(no class)_ | — | Escape hatch — do not pass through VenueImage in the first place |

**Do NOT apply to**:
- App logo (`/icons/logo.png`)
- Lucide icons
- Profile avatars (once they exist)
- `GoldSparkle` and other decorative SVGs

**Rationale**: Saturation slightly down prevents over-saturated wedding
reds/golds from feeling tacky. Contrast slightly up adds crispness.
Mild sepia provides a warm tint that matches the Morning Light palette,
regardless of each venue's original photography style. Same tone across
400+ venues → brand cohesion even with crowd-sourced imagery.

Respects `prefers-contrast: more` (filter is dropped for high-contrast users).

### 3. Spacing & Layout

**Base unit**: 4px — `4 8 12 16 20 24 32 40 48 64 80 96`

| Context | Value |
|---------|-------|
| Card internal padding | 16px (mobile), 24px (desktop) |
| Card gap | 12px (mobile), 16-24px (desktop) |
| Section gap | 32-48px (mobile), 64-80px (desktop) |
| Page padding | 16px (375px), 24px (768px+) |
| Touch target gap | 8px minimum |
| Content max-width | 64rem / 1024px |

**Breakpoints**: 375 / 768 / 1024 / 1440

**Border Radius**: 4px (badges) / 8px (inputs, chips) / 12px (buttons) / 16px (cards, modals)

### 4. Shadows

```css
--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.1);
--shadow-modal: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
--shadow-gold: 0 0 20px rgba(201,168,76,0.15); /* featured items only */
```

### 5. Motion

| Category | Duration | Easing |
|----------|----------|--------|
| Micro (hover, press) | 120-150ms | ease-out |
| State change (tabs, accordion) | 200-250ms | ease-in-out |
| Card hover | 300ms | cubic-bezier(0.4,0,0.2,1) |
| Page transition | 400-600ms | cubic-bezier(0.16,1,0.3,1) |
| Celebration | 800-1400ms | ease-out |

**Spring config (framer-motion)**:
```typescript
const springStandard = { type: "spring", stiffness: 400, damping: 30 };
const springPremium = { type: "spring", stiffness: 300, damping: 25 };
const springLuxury = { type: "spring", stiffness: 200, damping: 20 };
```

**Rules**:
- Enter: ease-out. Exit: ease-in (70% of enter duration)
- Card tap: `scale: 0.98` (instant feedback)
- Page enter: `y: 20 → 0, opacity: 0 → 1`
- `prefers-reduced-motion`: all animations disabled
- Max simultaneous animated elements: 3-5

### 6. Icons

**Library**: Lucide Icons (SVG only). No emoji in structural UI.

**Sizing**: Match text visual weight. 20px for nav, 24px for actions, 16px for inline.

### 7. V3 Brand Motifs (Visual V3)

V3 introduces three CSS/SVG-only brand flourishes grounded in the 晴れ時 metaphor (曇り → 晴れ間 → 晴れ). No external photos or videos required.

#### Seasonal Motifs

Four tiny gold-hairline SVGs rotate automatically by current month via `<SeasonalMotif />` (`src/components/ui/seasonal-motif.tsx`):

| Months | Motif | Meaning |
|--------|-------|---------|
| Jan–Mar | 梅 (plum) | Early-year hope |
| Apr–Jun | 桜 (cherry) | Beginnings |
| Jul–Sep | 紫陽花 (hydrangea) | Quiet summer |
| Oct–Dec | 紅葉 (maple) | Warm close |

**Usage rules**:
- Decorative only (`aria-hidden` by default). Pass `ariaLabel` only if the motif is the sole carrier of meaning.
- Default opacity 0.5. Never full-opacity — the motif is an accent, not a focal element.
- `size="sm"` (16px) for inline flourishes (EmptyState constellation, chip).
- `size="md"` (32px) for hero moments (auth brand panel, post-decision celebration).
- Color inherits from `currentColor` / `text-[var(--gold-warm)]`. Do not recolor to primary.
- Use 1 motif per region. Two or more feels ornamental.

**Where applied (canonical)**: `/login` & `/signup` brand panels, `JourneyCard` decision state, `EmptyState`.

#### Sunlight Layer

Warm radial glow that reinforces the "morning light" brand. Token: `--hero-sunlight` in `globals.css` (light + dark variants). Helpers: `.hero-sunlight` (full) and `.hero-sunlight-sm` (60% opacity).

**Scope rules — strict**:
- LP hero section (`landing-page.tsx`) only.
- Home hero wrapper (`Greeting` + `JourneyCard`) only.
- Never apply to `<body>`, app layout shell, or any secondary section.
- Never stack with other radial overlays.
- Disabled automatically under `prefers-contrast: more`.
- Dark mode uses a cooler, dimmer warm tone (`oklch(0.3 0.02 85 / 0.3)`).

Implemented as a `::before` pseudo-element so the glow sits behind content without mutating layout. Container must be `position: relative; isolation: isolate` (the helper classes set this).

#### Journey Dot Transitions

Contract for `JourneySteps` (`src/components/home/journey-steps.tsx`):

| Trigger | Animation | Duration |
|---------|-----------|----------|
| Step transitions `upcoming/current → completed` | Scale-up 1 → 1.15 → 1 spring + opacity pulse + expanding gold halo ring | 600ms |
| Step is `current` (steady) | Soft scale pulse 1 → 1.06 → 1 | 800ms |
| `prefers-reduced-motion: reduce` | Instant color change only — no scale, no halo | 0ms |

Spring config: `stiffness: 180, damping: 14`. The halo uses `ring-2 ring-[var(--gold-warm)]` and fades while expanding to 1.8×. Detection is diff-based (previous-status ref), so the celebration fires exactly once per real transition.

#### Photo Caption Overlay

`PhotoCarouselEmbla` (2+ photos only) shows a small bottom-left caption band on the active slide: venue name + `N/M` counter in gold-warm, on `white/85 + backdrop-blur`. Fades in over 500ms. `pointer-events: none` to keep Embla's touch handling untouched.

---

## AI Features Architecture

### Cost Model (商用化考慮)

| Feature | API Calls | Frequency | Cost Strategy |
|---------|-----------|-----------|---------------|
| Onboarding | 1 call | Once per user | Free tier |
| URL extraction | 1 call per URL | Low | Free tier (limit 10/month) — **R1から使用（唯一のAI例外）** |
| Estimate analysis | 1 call per PDF | Low | Free tier (limit 5/month) |
| Comparison analysis | 1 call per comparison | Medium | Free/Premium threshold |
| Coach chat | 1 call per message | High | Premium feature or rate-limited |
| Review summary | 1 call per venue | Low | Background batch |

### Privacy

- PII stripped before API calls
- No review original text stored (AI summaries only)
- API key: `ANTHROPIC_API_KEY` env var
- Server Actions only (never client-side)

---

## Persuasion Layer

| Element | Implementation |
|---------|---------------|
| **Hook** (3 sec) | AI onboarding: instant personalized venue suggestion |
| **Story Arc** | 不安→発見→比較→確信→祝福 |
| **Objection: "ゼクシィと何が違う?"** | 中立・比較特化・AI分析。広告モデルではない |
| **Objection: "見積もりが不安"** | 80%上がる問題をAIが先回り。具体的な金額予測 |
| **Objection: "パートナーが使ってくれない"** | LINE1リンク、3タップから。段階的エンゲージメント |
| **Trust: AI根拠** | 「328件の口コミを分析」等のソース表示 |
| **Trust: データ** | 見積もり上昇率の統計データ表示 |
| **Memorable** | 決定セレモニー（コンフェッティ+旅路サマリ） |

---

## Soul — VenueLensの独自性

80% proven patterns (Airbnb cards, Tripadvisor scroll, Tesla comparison) + 20% unique:

1. **二人のベン図** — パートナー評価の重なりを可視化。一致を祝い、違いを建設的に扱う
2. **見積もりX線** — AIが見積もりPDFを透視。「料理は最低ランク。+15万想定」と具体的に警告
3. **決定セレモニー** — コンフェッティ + 旅路サマリ + 理由記録。式場選びの「ゴール」を祝う
4. **AIコンシェルジュ** — カード+チャットのハイブリッド。開くだけで価値が見える

---

## Anti-Patterns (Never Do)

- Indigo/violet as primary (AI slop indicator)
- Pink theme (Zexy differentiation)
- Generic blob/wave backgrounds
- "残りわずか!" urgency messaging (wrong for weddings)
- Stock illustrations (use Lucide icons)
- Desktop-first design
- Information hiding ("Contact us for price")
- Bold headings (luxury = light weight 300-400)
- Single-shadow cards (always multi-layer)
- Fast bouncy animations (luxury = smooth, deliberate)
- 6-step progress bar (abolished — replaced by organic AI guidance)
- Radar chart as primary comparison (use progress bars)

---

## Cultural Design Patterns (Japan)

- **情報密度は高めに保つ**: 過度なホワイトスペースは「情報不足 = 信頼できない」
- **費用の早期表示**: 概算でも数字を出す。「お問い合わせください」は禁止
- **急かさないUX**: フェア当日即決を前提としない。「じっくり比較しましょう」のトーン
- **UIコピーは丁寧体**: 「予約する」→「見学してみる」、「決定」→「この式場に決めましょう」

---

## Implementation Priorities

| Priority | Screen | Key Components |
|----------|--------|----------------|
| 1 | Bottom Nav + Layout | 4タブ構造、SafeArea、タッチターゲット |
| 2 | Venue Card | 写真カード、ハート、カルーセル、バッジ |
| 3 | Home | グリーティング、AIカード、進捗リング、横スクロール |
| 4 | Explore (探す) | カードリスト、フィルタチップ、式場追加 |
| 5 | Coach | インサイトカードフィード、チャットバー |
| 6 | AI Onboarding | チャットバブル、ピル選択、プログレス |
| 7 | Comparison Board | Quick Look、スコアバー、差分トグル、AIインサイト |
| 8 | Candidates (候補) | ショートリスト、比較への遷移 |
| 9 | Rating Input | 6次元星評価、感情ラベル、auto-save |
| 10 | Venue Detail | フォトギャラリー、セクション、見積もり |
| 11 | Partner | 招待フロー、評価比較ビュー |
| 12 | Decision Ceremony | コンフェッティ、旅路サマリ、理由記録 |
| 13 | Estimate Analysis | PDF/手動入力、AI分析、ウォーターフォール |

---

## Steal List (Reference)

> Full list of 25 design patterns adopted from Refero research.

| # | Source | Pattern | Applied To |
|---|--------|---------|-----------|
| 1 | Asana | パーソナライズグリーティング | Home |
| 2 | GlossGenius | AIチップサジェスト | Home, Coach |
| 3 | Chargetrip | プログレスリング | Home |
| 4 | Tripadvisor | 横スクロールカード | Home |
| 5 | Bento | ベントグリッド | Home |
| 6 | Airbnb | ハートトグル | Cards |
| 7 | Trulia | カード内カルーセル | Cards |
| 8 | Fresha | pillフィルタチップ | Explore |
| 9 | Onefinestay | セリフ体式場名 | Cards |
| 10 | Airbnb | ステータスバッジ | Cards |
| 11 | Tesla | "AIにおすすめを聞く" CTA | Comparison |
| 12 | DJI | 差分のみ表示トグル | Comparison |
| 13 | Teal | 円形プログレス+カテゴリバー | Comparison |
| 14 | Apple | Quick Look サマリ | Comparison |
| 15 | Grammarly | インラインAIインサイト | Comparison, Coach |
| 16 | Jasper AI | チャットバブル型オンボーディング | Onboarding |
| 17 | Intercom | ピル型選択肢+Skip | Onboarding |
| 18 | Yelp | カテゴリ別タグ+星評価 | Rating |
| 19 | Kitchen Stories | 感情ラベル | Rating |
| 20 | Pi | 温かみカードグリッド | Onboarding |
| 21 | Riverside | パーソナライズコンフェッティ | Decision |
| 22 | Instacart | タグチップ理由記録 | Decision |
| 23 | Zapier | 旅路サマリ | Decision |
| 24 | Revolut | モバイルシェアバー | Partner |
| 25 | Daze | 空きスロット可視化 | Partner |

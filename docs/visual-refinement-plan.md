# Haretoki ビジュアル洗練化計画

> 実ユーザーの声「ホーム画面とか他の画面も普通に洗練されてる感がない。ダサい」への応答。
> 作成日: 2026-04-14 / Status: Draft / 前提: ロジック/a11y の P0-P2 は潰し済み。残課題は **審美性**。
> 注: 本レビュー時点で Refero MCP と WebSearch が利用不可だったため、参考は著名プロダクト名+画面種別で代替（Mejuri PDP, Aesop product grid, Airbnb stay detail, Linear onboarding, Arc Browser landing, Notion gallery, Cash App home, Apple Wallet, 星のや mobile, Calm home）。Refero 引用は次スプリントで補完する。

---

## 0. 要約 (TL;DR)

**"ダサい" の正体**: (1) 全画面が `rounded-2xl bg-card shadow-card` の一律スタンプで **質感の階層が無い**、(2) タイポスケールの対比が弱く、セクション見出し/本文/キャプションが **ほぼ同じサイズ感**、(3) 余白が `space-y-8/12` の機械的一律で **「ここに目を止めろ」という呼吸が存在しない**。結果、情報は並んでいるが "デザインされている" 印象に届かない。

**最優先対策 (V1)**:
1. **タイポ対比の再構築** — 見出しを `clamp(28px→44px)` extralight serif、本文は 15px/1.85、eyebrow を導入してセクション冒頭に常設
2. **サーフェス階層の 3 段化** — `bg-background / bg-card / bg-card-elevated` + 専用 shadow トークン 4 段（hairline / card / elevated / hero）
3. **式場カードの再設計** — 4:3 固定 → 3:2（映画的）、下辺にホテルブロシュア風の hairline + gold 細線、写真外の情報を 1 行圧縮

---

## 1. 現状のビジュアル分析（ファイル参照）

### ホーム (`src/app/(app)/home/page.tsx`)
- L23 `<div className="space-y-12">` でセクションが **均等間隔**。Greeting と JourneyCard の間にも、JourneyCard と RecentVenues の間にも **リズムの強弱が無い**。
- `greeting.tsx:40` h1 が `text-fluid-xl`（clamp 1.25→2rem）。**ヒーローとして弱い**。24-32px 帯では「アプリ名を名乗る資格」が無いサイズ感。ラグジュアリーホテルの TOP は 36-48px extralight serif が定石。
- `journey-card.tsx:88` — `rounded-2xl bg-card border border-border p-6 shadow-[var(--shadow-card)]`。**探すページの他のカードと完全に同じ容器**。「今日のヒーロー」なのに視覚的に主役に見えない。
- `journey-card.tsx:95-98` アイコン枠 `h-10 w-10 rounded-full bg-muted` にアイコン `h-8 w-8` が **はみ出んばかり**に詰まっている（padding 1px）。ブランドモチーフ（曇り→晴れ）が玩具のアイコンバッジに縮退。

### 探す (`src/app/(app)/explore/page.tsx` + `venue-card.tsx`)
- L110 `space-y-8` → ヘッダー / 検索 / Chips / AI Recs / Grid が **等間隔フラット**。AI Rec セクションが他セクションと同格に沈む。
- `venue-card.tsx:30` `rounded-2xl` + `shadow-card` + hover `-translate-y-0.5`。**Airbnb のカード模倣として "角丸が大きすぎ & 影が弱すぎ"**。写真 4:3 は日本の不動産ポータル感（＝凡庸）。
- L69 `font-serif text-lg font-medium tracking-[0.05em]`。DESIGN.md 「太字禁止」に対し `font-medium (500)` を式場名に使用。**ラグジュアリー感の源泉である細字を自ら潰している**。
- L81 費用 `text-[var(--gold-warm)]` で gold 単色ベタ。価格が浮いて "広告っぽい"。
- L112 style chips `bg-muted text-xs`。全チップ同色で **情報の優先度がフラット**。

### 候補 (`candidates-view.tsx`)
- L136 `space-y-5` → SegmentedControl 直下にすぐ EmptyState/リストが始まる。**タブ切替とコンテンツの間に「呼吸」が無い**。
- L312 decision 確定画面 `rounded-2xl bg-card p-8`。人生の最終決定画面が **普段のカード筐体**のまま。最終決定は専用サーフェス（全幅グラデ背景 + gold hairline frame）が要る。

### 式場詳細・コーチ・マイページ
- `insight-card.tsx:32` `rounded-2xl border-l-[3px] bg-[var(--gold-subtle)]`。gold-subtle は alpha 0.10 で **ほぼクリーム背景に溶けて AI 特別感ゼロ**。
- `bottom-nav.tsx:70` `bg-card/80 backdrop-blur-xl` + border-t 0.4。**境界が曖昧**で、ナビが浮いているのかカードなのか不明。iOS の標準タブバーに比べ "手作り感" が漏れる。
- `recent-venues.tsx:47` min-width 300px の横スク。375px 画面で **1.25 枚見え**の中途半端な見切れ。Mejuri/Airbnb は 85vw 設計でピーク感を作る。

### グローバル (`globals.css`)
- L72-75 shadow は 3 種（card / card-hover / modal / gold）。**立体感の階層不足**。ヒーロー/カード/チップ/ボタンの影が同じトーンなので画面全体が平板。
- L120 `--radius: 0.75rem`。全角丸が 12-16px に揃う。**ホテル系は 4px(hairline) / 10px(card) / 22px(hero) のミックスが上品**。
- L74 `box-shadow: 0 1px 3px rgba(42,35,32,0.04)` — alpha 0.04 は淡すぎ。「影がある気がする」レベルで、離れて見ると "のっぺり"。

---

## 2. "ダサい" の言語化（根本課題）

| # | 課題 | 症状 | なぜダサいか | 参考 |
|---|------|------|-------------|------|
| C1 | **タイポ対比不足** | h1/h2/body の差が ~1.2x 刻み | ラグジュアリーは "詩と散文" の 2-2.5x 対比で緊張感を作る。フラットは新聞紙的 | Aesop product grid の hero 48px vs meta 11px |
| C2 | **サーフェス階層の欠如** | すべて `bg-card rounded-2xl shadow-card` | ホテル系は紙/革/ガラスの 3 質感を使い分け。単一質感は "テンプレ" の印象 | Apple Wallet のカード重なり |
| C3 | **影が淡すぎ・均質** | `alpha 0.04-0.06` 1-2 段階のみ | 影の階層＝情報の階層。平らな影は "無料テーマ感" | Linear dashboard の 4 段影 |
| C4 | **角丸の一律 16px** | 全要素 rounded-2xl | 同寸角丸は子供っぽい／Instagram UI 感 | Arc Browser の 4px + 28px ミックス |
| C5 | **写真比率の単調** | 全カード 4:3 固定 | 映画的緊張は 3:2 / 16:9。4:3 は不動産ポータル定番＝凡庸 | Airbnb stay cover 16:10 |
| C6 | **余白リズムの機械性** | space-y-8/12 均等 | 余白は "主役に光を当てる舞台" の役割。均等は照明ゼロの倉庫 | 星のや site の 96/48/16 3段 |
| C7 | **gold アクセントが弱い** | gold-subtle alpha 0.10 / border-l 3px のみ | 晴れ時の "晴れ間" が視覚化されない。金が光っていない | Cartier mobile の 0.5px gold hairline |
| C8 | **見出しに太字を混用** | venue名 `font-medium (500)` | DESIGN.md 「太字禁止」違反。ラグジュアリーの源泉を自損 | Mejuri PDP 200weight |
| C9 | **アイコン一律 Lucide** | 全画面 lucide-react、strokeWidth 1.5-1.75 | 個性無し。ブランドモチーフ（天気/曇→晴）が不在 | Calm の筆致イラスト + 季節モチーフ |
| C10 | **空ステート貧弱** | `EmptyState` テキスト中心、png 1 枚 | 空ステートこそ世界観を語る唯一の余白。現状は "機能停止中" の貼紙 | Notion gallery empty illustration |
| C11 | **AI Insight が背景に溶ける** | gold-subtle alpha 0.10 | "AI 特別感" の視覚差が無い。ただの薄ベージュ箱 | Superhuman AI summary の左 gold bar + noise texture |
| C12 | **ナビのガラスが中途半端** | backdrop-blur-xl + border-t/40 | blur だけでは浮かない。上辺の光 (inset highlight) が無い | Apple Music mini-player |

---

## 3. ゴール

- **一瞥で "こだわっているアプリ"**: 5 秒スクショで「ホテル公式アプリ or Mejuri 系のブランド」と誤認されるレベル
- **ブランドを壊さない**: 曇り→晴れの静謐、丁寧体、押し売り禁止、温度感を保ったまま質感だけ 2 段上げる
- **非目標**: 派手なアニメ、ネオモーフ、グラス UI 過剰、ダークテーマへのブランド変更

---

## 4. 改善対策（優先度順）

### 対策1. タイポスケールの再構築 — S
- **WHAT**: 現行 4 段（fluid-xl/lg/base/sm）を 7 段に拡張。対比 1.3-1.5x。
- **HOW** (`globals.css` + 各画面の h1/h2/h3 置換):
  ```
  --text-display : clamp(32px, 6vw, 44px); weight 200; tracking -0.02em; leading 1.15;   // ヒーロー / Greeting
  --text-h1      : clamp(24px, 5vw, 32px); weight 300; tracking -0.01em; leading 1.25;   // 画面タイトル
  --text-h2      : 20px;  weight 300; tracking 0;       leading 1.4;                     // セクション見出し
  --text-h3      : 17px;  weight 400; tracking 0;       leading 1.5;                     // カード内タイトル
  --text-body    : 15px;  weight 400; tracking 0.01em;  leading 1.85;                    // 本文（現状1.6 → 1.85）
  --text-meta    : 13px;  weight 400; tracking 0;       leading 1.5;                     // キャプション
  --text-eyebrow : 11px;  weight 500; tracking 0.16em; uppercase; color: gold-warm;      // セクション冠 (NEW)
  ```
- **WHY**: C1 / C8。eyebrow (「TODAY」「YOUR JOURNEY」「SAVED」) を各セクション冒頭に常設すると、それだけで雑誌的リズムが生まれる。
- **適用例**: Home `<p>今日のおふたりの式場選び</p>` を `<span class="eyebrow">YOUR MORNING</span>` + 大見出し「{userName} さん、おはようございます」へ。

### 対策2. サーフェス階層の 3 段化 + 影 4 段 — S
- **WHAT**: CSS 変数に以下追加、各コンポーネントで使い分け。
  ```
  --shadow-hairline: 0 0 0 1px oklch(0.91 0.02 70 / 0.6);
  --shadow-card    : 0 1px 2px rgba(42,35,32,0.03), 0 8px 24px rgba(42,35,32,0.06);     // 現行より 24px 広げる
  --shadow-elevated: 0 2px 4px rgba(42,35,32,0.04), 0 24px 48px rgba(42,35,32,0.10);
  --shadow-hero    : 0 4px 8px rgba(42,35,32,0.05), 0 40px 80px rgba(42,35,32,0.14), inset 0 1px 0 rgba(255,255,255,0.6);
  --gold-hairline  : 0 0 0 1px oklch(0.70 0.13 80 / 0.35);
  ```
- **使い分け**: 通常カード=card / JourneyCard・AIInsight=elevated / Decision最終画面=hero / 控えめ区切り=hairline。
- **WHY**: C2 / C3。情報の重要度が影の深さで瞬時に伝わる。

### 対策3. 角丸のトーク — S
- **WHAT**: 現行 radius=0.75rem 一律を **用途別に 3 段** (4px/12px/24px) に。
  - `rounded-hairline` (4px): chips, tags, inline badges
  - `rounded-card` (12px): 汎用カード（現行 16 → 12 に絞る、密度感向上）
  - `rounded-hero` (24px): JourneyCard, Decision画面, Sheet
- **WHY**: C4。Arc / Linear は意図的にミックスして "整っているのに単調でない" 質感を作る。

### 対策4. 式場カードの再設計（ホテルブロシュア風） — M
- **WHAT** (`venue-card.tsx`):
  1. 写真比率 4:3 → **3:2** (`aspect-[3/2]`)
  2. カード外周 `rounded-card` (12px) + `shadow-card`、**写真と情報の境界に 0.5px gold hairline**（`after:` 疑似要素）
  3. 式場名 `font-serif text-[17px] font-light tracking-[0.04em]` (weight 500→300)
  4. 価格行を **eyebrow スタイル** に格上げ: 「FROM ¥320-450万 · 着席 60-120名」を 1 行で、tracking 0.08em
  5. style chips は `rounded-hairline` + border 0.5px + 透明背景、gold 枠にマークして "バッジではなくフレーム" 感
  6. 写真左下の Score を、右上の Heart と対角で沈黙させ、**左下に映画タイトル風の式場名オーバーレイ**を写真に載せる（下部グラデと連携）
- **WHY**: C5 / C7 / C8。ホテル公式パンフの視覚言語に寄せる。

### 対策5. JourneyCard のヒーロー化 — M
- **WHAT** (`journey-card.tsx`):
  - 容器: `rounded-hero` + `shadow-hero` + `bg-card-elevated` + 上辺 inset highlight
  - 天気アイコンを `h-16 w-16` の **放射グラデ円**（gold-subtle → transparent）に内包、アイコン本体は `strokeWidth={1.25}` で細線化
  - メッセージ serif 22px extralight tracking -0.01em、下に `text-meta` サマリ
  - CTA を pill(filled) から **outlined + underline-ghost** に: `border border-primary/30 text-primary hover:bg-primary/5`、矢印は `→` (U+2192) で細く
  - 背景に **極薄のラグ/朝光グラデ** (`linear-gradient(180deg, oklch(0.99 0.005 80) 0%, oklch(0.98 0.012 75) 100%)`) を足す
- **WHY**: ヒーローとしての主従関係を確立。曇り→晴れメタファーを視覚化。C2 / C6 / C9。

### 対策6. セクションリズムの確立 — S
- **WHAT**: ホーム / 探す / 候補の垂直リズムを **64 / 40 / 16** の 3 段に。
  - ヒーロー→次ブロック: `mt-16` (64px)
  - セクション見出し→コンテンツ: `mt-10` (40px)
  - コンテンツ内アイテム間: `mt-4` (16px)
- **HOW**: 既存 `space-y-12` を廃し、各セクションに明示 margin。eyebrow ラベル + 0.5px hairline 区切り (`<hr class="border-border/40">`) をセクション境界に。
- **WHY**: C6。余白が情報の主従を語る。

### 対策7. AI Insight を "金箔封筒" 化 — M
- **WHAT** (`insight-card.tsx`):
  - 背景: `gold-subtle` alpha 0.10 → **0.18** + 角に 1px gold hairline border
  - 左 3px ボーダーを削除し、代わりに **右上の Sparkles アイコンを 28px 放射グロー**付きで配置
  - タイトル uppercase eyebrow はそのまま維持、ただし gold-warm → gold-light で明度 up
  - 本文下に **微細ノイズテクスチャ** (SVG filter feTurbulence 0.03 opacity) を敷いて "紙" 質感
- **WHY**: C11。AI 機能の視覚的特権化。

### 対策8. 空ステートの招待状化 — M
- **WHAT**: `EmptyState` を 3 層構造化:
  1. 天気モチーフの SVG イラスト（h-32、細線、gold-hairline）
  2. serif 見出し (h2)、リード 2 行
  3. **破線ドロップゾーン** or **primary+secondary 2 ボタン** (DESIGN.md P1 準拠)
- **画面別イラスト**: Home 空=朝霧、Explore 空=封筒+URL、Candidates 空=空のジュエリーボックス、Coach 空=湯気の立つカップ
- **WHY**: C10 / DESIGN.md v4 P1。

### 対策9. ボトムナビの質感アップ — S
- **WHAT** (`bottom-nav.tsx`):
  - 容器: `bg-card/80 backdrop-blur-xl` → `bg-card/72 backdrop-blur-2xl`、上辺に `shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]` のハイライト
  - アクティブインジケータの 0.5h bar (L76) を幅 20% → **24px 固定**の **gold hairline dot** に（丸 4px gold）
  - アイコン strokeWidth 1.75 → 1.25、アクティブ時のみ 1.5
- **WHY**: C12。iOS ネイティブ感へ近づける。

### 対策10. ブランドモチーフの可視化 — L
- **WHAT**:
  - 全ページの背景に **朝光グラデ**（右上から左下、oklch 変化 0.5%）を常時敷く
  - JourneyCard stage 別に **微細パーティクル**（prefers-reduced-motion 尊重、sunny 時のみ gold dust の y: 0→-8 loop、duration 6s ease-in-out infinite）
  - Decision ceremony に **桜/木漏れ日** モチーフの SVG（季節に応じて切替）
- **WHY**: C9。"晴れ時" のブランド名を毎日のセッションで視覚的に納得させる。

### 対策11. 横スクロールのピーク改善 — S
- **WHAT** (`recent-venues.tsx`): `min-w-[300px]` → `min-w-[85vw] max-w-[340px]`、`scroll-padding-left: 16px`、末尾に `pr-8` で 1 枚強の見切れを作る。
- **WHY**: C5 / 次がある感。

### 対策12. マイクロインタラクション 3 層化 — M
- **WHAT**:
  - 現行: `active:scale-[0.98]` のみ
  - 追加: `hover: shadow-elevated translate-y-[-2px]` / `focus-visible: ring-2 ring-gold-warm/40 ring-offset-4` / `tap: haptic (navigator.vibrate(5))`
  - Heart タップ時、gold dust パーティクル 6 粒を 400ms 放射
- **WHY**: C3 + DESIGN.md P3 複層フィードバック。

---

## 5. 実装ロードマップ

### Phase V1（即効 / 1-2日 / 1 worktree: `feat/visual-v1-tokens`）
- 対策1 (タイポ) / 2 (サーフェス) / 3 (角丸) / 6 (余白) / 9 (ナビ) / 11 (横スク)
- 全部 `globals.css` + 各 page.tsx の class 置換で完結。機能影響ゼロ。

### Phase V2（ディテール / 3-5日 / 2 worktree 並列）
- `feat/visual-v2-cards`: 対策4 (式場カード) / 5 (JourneyCard ヒーロー)
- `feat/visual-v2-insights`: 対策7 (AI Insight) / 8 (空ステート) / 12 (マイクロ)

### Phase V3（リッチ / 1-2週 / デザイナー介入推奨）
- 対策10 (ブランドモチーフ) — SVG イラスト 5-6 点、季節バリアント含む
- Decision ceremony 専用サーフェス

---

## 6. 具体トークン提案（globals.css 追加）

```css
@theme inline {
  /* Typography scale */
  --text-display: clamp(32px, 6vw, 44px);
  --text-h1: clamp(24px, 5vw, 32px);
  --text-eyebrow: 11px;
  /* Shadow ladder */
  --shadow-hairline: 0 0 0 1px oklch(0.91 0.02 70 / 0.6);
  --shadow-card:     0 1px 2px rgba(42,35,32,0.03), 0 8px 24px rgba(42,35,32,0.06);
  --shadow-elevated: 0 2px 4px rgba(42,35,32,0.04), 0 24px 48px rgba(42,35,32,0.10);
  --shadow-hero:     0 4px 8px rgba(42,35,32,0.05), 0 40px 80px rgba(42,35,32,0.14),
                     inset 0 1px 0 rgba(255,255,255,0.6);
  /* Gold accents */
  --gold-hairline: oklch(0.70 0.13 80 / 0.35);
  --gold-glow:     0 0 24px oklch(0.70 0.13 80 / 0.22);
  /* Radius scale */
  --radius-hairline: 4px;
  --radius-card: 12px;
  --radius-hero: 24px;
}
```

---

## 7. 参考引用（Refero 入手次第差し替え）

| Product / Screen | 何を参考にするか |
|---|---|
| Mejuri PDP mobile | 価格 eyebrow 化、200 weight serif、3:2 photo、極薄 hairline |
| Aesop product grid | eyebrow 11px tracking 0.16em、余白 96/40/16 3 段 |
| Airbnb stay detail | 角丸 12px + shadow 2 段、photo gallery 3:2 |
| Linear onboarding | 影 4 段階、サーフェス 3 段、dotted progress |
| Apple Wallet | カード重なりでの奥行き、上辺 inset highlight |
| 星のや mobile | 朝光背景グラデ、明朝 extralight、gold hairline frame |
| Cash App home | アイコン 1.25 stroke、タブバー blur + dot indicator |
| Calm home | 季節モチーフ SVG、微細パーティクル |

---

## 8. 要意思決定

1. **フォント切替**: Noto Serif JP → Shippori Mincho B1 (extralight 200 の美しさ優位) を検討。Google Fonts 追加コスト要評価
2. **朝光グラデ常時敷き**: バッテリー/読みやすさ影響を計測（reduced-motion + prefers-contrast で off）
3. **桜/季節モチーフ**: 誰が SVG を描くか（Figma 内製 / イラストレーター外注）
4. **Decision 専用サーフェス**: v3 に送るか v2 で簡易版入れるか
5. **Refero 引用の補完タイミング**: MCP 復旧後に本文書 §7 を差し替え

---

_End of plan_

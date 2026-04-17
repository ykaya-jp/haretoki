# VenueLens v2 — Full Redesign Specification

> Phase 0-3 の全リサーチ・設計決定を統合した実装仕様書。
> DESIGN.md は設計指針、本ドキュメントは実装仕様。
> v1.1: セルフレビューによる CRITICAL/HIGH 全11件修正済み。
> v1.2: HIGH-A1/A2(Server Actions表整合), HIGH-C1(aria属性追加), HIGH-D4(AIInsightCardパス統一)修正。

---

## Tech Stack Note

- **Next.js 16** (App Router) — package.json の実バージョンに合わせる
- 既存の revalidatePath を v2 ルートに更新: `/dashboard`→`/`, `/venues`→`/explore`, `/shortlist`→`/candidates`

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `embla-carousel-react` | VenueCard 写真カルーセル | ~13KB gzip |
| `canvas-confetti` | Decision Ceremony コンフェッティ | ~2KB gzip |

既存利用: framer-motion, recharts, react-hook-form, zod, sonner

---

## Implementation Scope

既存の6ステップUI全体を、4タブ構成 + AI対話オンボーディングに全面的に作り替える。

### 既存画面の廃止/統合

| 既存ページ | 対応 |
|-----------|------|
| `(app)/conditions/page.tsx` | 廃止 → AI onboardingに吸収 |
| `(app)/dashboard/page.tsx` | 廃止 → 新Home画面に置換 |
| `(app)/venues/page.tsx` | リファクタ → 新Explore画面 |
| `(app)/compare/page.tsx` | リファクタ → 新Comparison Board |
| `(app)/shortlist/` | 統合 → 新Candidates画面内 |
| `(app)/decision/page.tsx` | リファクタ → 新Decision Ceremony |
| `(app)/accept-invite/` | 維持 → パートナー段階的参加に対応 |

### 新規画面

| 画面 | ルート | 主要コンポーネント |
|------|--------|-------------------|
| Layout (4タブ) | `(app)/layout.tsx` | BottomNav, SafeArea |
| Home | `(app)/page.tsx` | Greeting, AIInsightCard, ProgressRing, RecentVenues, QuickActions |
| Explore | `(app)/explore/page.tsx` | VenueCardList, FilterChips, AddVenueSheet |
| Candidates | `(app)/candidates/page.tsx` | ShortlistView, ComparisonBoard, DecisionView |
| Coach | `(app)/coach/page.tsx` | InsightCardFeed, ChatBar |
| AI Onboarding | `(app)/onboarding/page.tsx` | ChatBubble, PillOptions, ProgressBar |
| Venue Detail | `(app)/venues/[id]/page.tsx` | PhotoGallery, VenueInfo, RatingInput, EstimateSection, VisitSection |
| Partner Guest | `(app)/accept-invite/page.tsx` | GuestVenueCard, ReactionButtons, SignupPrompt |

### 認証フロー連携

```
/login → Supabase Auth → /callback
  → project が存在しない → /onboarding (新規プロジェクト作成)
  → project.conditions が null → /onboarding
  → それ以外 → / (Home)

/onboarding 完了 → saveOnboardingAnswers() → / へリダイレクト

パートナー招待リンク:
/accept-invite?token=xxx → ゲストモード(Level1) → リアクション → サインアップ促進 → / (Home)
```

リダイレクト判定は `src/app/(app)/layout.tsx` の Server Component で実行。middleware ではなく layout で条件チェックし、`redirect()` する。

---

## Loading / Error / Empty States (全画面共通)

各画面に `loading.tsx` と空ステートを必ず用意する。

### スケルトン仕様

| 画面 | スケルトン構造 |
|------|-------------|
| Home | BentoGrid枠(2/3+1/3) + 横スクロールカード枠×3 |
| Explore | FilterChips枠(横線×4) + VenueCard枠×3(4:3写真+3行テキスト) |
| Coach | InsightCard枠×3(3px左ボーダー+3行テキスト) |
| VenueDetail | 写真枠(4:3) + テキスト3行 + 星6行 |
| Candidates | セグメントコントロール + カード枠×2 |
| ComparisonBoard | ドロップダウン枠×2 + 円形×2 + バー×6 |

スケルトン色: `bg-muted animate-pulse rounded-lg`

### 空ステート仕様

| 画面 | 条件 | メッセージ | CTA |
|------|------|----------|-----|
| Explore | 式場0件 | 「まだ式場が登録されていません」 | [+ 式場を追加する] |
| Candidates | 候補0件 | 「気になる式場をハートで候補に追加しましょう」 | [式場を探す] |
| Coach | インサイト0件 | 「式場を追加すると、AIコーチがアドバイスを始めます」 | [式場を追加する] |
| VenueDetail/見積もり | 見積もり0件 | 「見積もりを追加して、費用を見える化しましょう」 | [見積もりを追加] |
| VenueDetail/見学 | 見学記録0件 | 「見学の記録をここに残せます」 | [見学を記録する] |

空ステート構成: Lucideアイコン(48px, muted) + 見出し(16px) + 説明(14px, muted) + CTAボタン

### エラー状態

- Server Action失敗: Sonnerトーストでリトライボタン付き通知
- AI応答遅延(10秒超): 「AIが考え中です...しばらくお待ちください」プログレスバー
- ページエラー: `error.tsx` で「エラーが発生しました」+ リトライ + ホームに戻る

---

## Screen-by-Screen Specifications

### Screen 1: Layout (BottomNav)

**ファイル**: `src/app/(app)/layout.tsx`

**コンポーネント**: `BottomNav`

```typescript
// src/components/layout/bottom-nav.tsx
interface NavItem {
  href: string;
  icon: LucideIcon; // Home, Search, Heart, MessageSquare
  label: string;    // ホーム, 探す, 候補, コーチ
  badge?: number;
}
```

**仕様**:
- 高さ: 56px + `env(safe-area-inset-bottom)`
- 背景: `bg-card` + `border-t border-border`
- アクティブ: `text-gold-warm` (icon + label)、`aria-current="page"` を設定
- 非アクティブ: `text-muted-foreground`
- アイコン: 20px, ラベル: 10px (下部)
- バッジ: 候補タブに件数、コーチタブに未読数
- バッジスタイル: `absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] min-w-[18px] h-[18px] rounded-full` (Navy — urgency感を避けるためdestructive赤ではなくprimary)
- 各タブ min-width: 64px, touch target: 48x48px
- **アクセシビリティ**: `<nav role="navigation" aria-label="メインナビゲーション">`、アクティブタブに `aria-current="page"`

**レイアウト body padding**:
```css
padding-bottom: calc(56px + env(safe-area-inset-bottom));
```

---

### Screen 2: Home (ホーム)

**ファイル**: `src/app/(app)/page.tsx` (Server Component)
**クライアント**: `src/components/home/` 配下

#### コンポーネント構成

```
HomePage (Server Component)
├── Greeting                 ← パーソナライズ挨拶
├── BentoGrid               ← AIカード + 進捗リング
│   ├── AIInsightCard        ← 2/3幅
│   └── ProgressRing         ← 1/3幅
├── QuickActions             ← 4ボタングリッド
└── RecentVenues             ← 横スクロールカード
    └── VenueCardSmall[]     ← 280x180px
NOTE: RecommendedVenues は将来フェーズ。v2初期では実装しない。
```

#### Greeting

```typescript
// src/components/home/greeting.tsx
interface GreetingProps {
  userName: string;
  weddingDate?: Date; // optional countdown
}
```

- 名前: `font-serif text-fluid-xl font-light tracking-[0.15em] leading-[1.8]`
- カウントダウン: `text-sm text-muted-foreground`
- 時間帯で挨拶を変える: おはようございます / こんにちは / こんばんは

#### AIInsightCard

```typescript
// src/components/ai/insight-card.tsx (Home/Coach両方から参照する共有コンポーネント)
interface AIInsightCardProps {
  type: 'estimate' | 'partner' | 'visit' | 'comparison' | 'reminder';
  title: string;
  body: string;
  actions: { label: string; href: string }[];
}
```

- 背景: `bg-[rgba(201,168,76,0.08)]`
- 左ボーダー: `border-l-[3px] border-gold-warm`
- アイコン: Sparkles (Lucide), `text-gold-warm`
- タイトル: `text-xs font-semibold text-gold-warm tracking-[0.02em]`
- 本文: `text-sm text-foreground leading-relaxed`
- チップ: `bg-card border border-border rounded-full px-3 h-8 text-sm`
- **アクセシビリティ**: `role="article"` + `aria-label="{title}"` (カードのタイトルテキストを動的に設定)

#### ProgressRing

```typescript
// src/components/home/progress-ring.tsx
interface ProgressRingProps {
  progress: number; // 0-100
  completedSteps: number;
  totalSteps: number;
}
```

- SVG circle, `stroke-dasharray` で進捗表現
- 直径80px, ストローク6px
- アニメーション: `useEffect` で0→current, 600ms

#### QuickActions

- 4グリッド: `grid grid-cols-4 gap-3`
- 各ボタン: `bg-card rounded-xl shadow-card p-4 flex flex-col items-center gap-2`
- アイコン: 24px `text-primary`
- ラベル: `text-xs font-medium text-center`

#### RecentVenues (横スクロール)

- コンテナ: `flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4`
- カード: `min-w-[280px] snap-start rounded-2xl overflow-hidden shadow-card`
- 写真: `aspect-[4/3] object-cover`
- ハート: 右上, 32px 白半透明背景

---

### Screen 3: Explore (探す)

**ファイル**: `src/app/(app)/explore/page.tsx`
**クライアント**: `src/components/explore/` 配下

#### コンポーネント構成

```
ExplorePage (Server Component)
├── ExploreHeader            ← タイトル + 追加ボタン
├── FilterChips              ← 水平スクロールフィルタ
├── VenueCardList            ← 式場カードリスト
│   └── VenueCard[]          ← 写真ファーストカード
└── AddVenueSheet            ← ボトムシート(URL or 手動)
```

#### FilterChips

```typescript
// src/components/explore/filter-chips.tsx
interface FilterChip {
  id: string;
  label: string;
  type: 'area' | 'guests' | 'budget' | 'style' | 'status';
  value?: string;
}
```

- コンテナ: `flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide`
- チップ(未選択): `h-9 px-4 rounded-full border border-border bg-card text-sm`
- チップ(選択済): `h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm`
- 末尾に「+こだわり」チップ → ボトムシート展開

#### VenueCard

```typescript
// src/components/venues/venue-card.tsx
interface VenueCardProps {
  venue: Venue & { scores: VenueScore[]; photos: string[] };
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  partnerReactions?: { userId: string; reaction: 'like' | 'maybe' | 'pass' }[];
}
```

**レイアウト (Mobile 1col)**:
```
┌──────────────────────────────┐
│ [4:3 Photo Carousel]    [♡]  │  aspect-ratio: 4/3
│ [Badge]                      │  absolute top-left
│           ← ● ● ● →         │  carousel dots
├──────────────────────────────┤
│ 式場名                       │  font-serif, 16px, 500
│ ★ 4.5 (128) · エリア         │  14px, muted
│ 着席80名 · ¥350万〜          │  14px, price in gold
│ [チャペル] [ガーデン]         │  11px, pill tags
└──────────────────────────────┘
```

**写真カルーセル**: Embla Carousel (軽量), snap, ドットインジケーター

#### AddVenueSheet

- shadcn/ui Sheet (bottom)
- 2つのタブ: 「URLから追加」（デフォルト）「手動で追加」

**URL自動抽出フロー（Release 1 で実装 — R1唯一のClaude API使用機能）**:

```
1. URL入力
   ┌──────────────────────────────┐
   │ 式場のURLを貼り付け           │
   │ ┌────────────────────┐ [追加] │
   │ │ https://...         │       │
   │ └────────────────────┘       │
   │ ゼクシィ、ハナユメ、Wedding   │
   │ Park等のURL対応               │
   └──────────────────────────────┘

2. AI抽出中（スケルトン表示）
   ┌──────────────────────────────┐
   │ 式場情報を読み取り中...       │
   │ ████████░░░░ (spinner)       │
   │ [photo skeleton] [info skel] │
   └──────────────────────────────┘

3. プレビュー確認
   ┌──────────────────────────────┐
   │ 読み取り結果を確認            │
   │ ┌──────────────────────────┐ │
   │ │ [Photo]  式場名          │ │
   │ │          住所            │ │
   │ │          着席XX〜YY名    │ │
   │ │          ¥ZZZ万〜       │ │
   │ │          [チャペル] [神前]│ │
   │ └──────────────────────────┘ │
   │ ※ 情報は後から編集できます    │
   │ [登録する]      [修正して登録] │
   └──────────────────────────────┘

4. 登録完了 → Explore画面にカード追加
```

- **エラー時**: fetch失敗/Claude API未設定 → エラーメッセージ表示 + 「手動で追加」タブに自動切替
- **信頼度表示**: Claude APIの `confidence` レスポンスに応じて「読み取り精度: 高/中/低」を表示
- **修正して登録**: プレビュー画面で手動フォームに抽出済みデータをプリフィルして編集可能

---

### Screen 4: Coach (コーチ)

**ファイル**: `src/app/(app)/coach/page.tsx`
**クライアント**: `src/components/coach/` 配下

#### コンポーネント構成

```
CoachPage
├── InsightCardFeed          ← AIインサイトカードの縦スクロール
│   └── InsightCard[]        ← type別にアイコン・色が変わる
├── Divider
└── ChatBar                  ← 固定下部の入力バー
    ├── TextInput
    └── SendButton
```

#### InsightCard

再利用: `AIInsightCard` と同じベースコンポーネント。type に応じたアイコン・タイトル。

**アクセシビリティ**: `role="article"` + `aria-label="{title}"` (カードのタイトルテキストを動的に設定)

| type | icon | color |
|------|------|-------|
| estimate | Receipt | gold-warm |
| partner | Users | primary |
| visit | ClipboardCheck | success |
| comparison | BarChart3 | secondary |
| reminder | Bell | muted-foreground |

#### ChatBar

- 固定下部: `fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0`
- 背景: `bg-card border-t border-border px-4 py-3`
- Input: `flex-1 bg-muted rounded-full px-4 py-2 text-sm`
- SendButton: `w-9 h-9 rounded-full bg-primary flex items-center justify-center`
- AI応答: Server Action → streaming response → カードに追加
- InsightCardFeed の `padding-bottom`: `calc(ChatBar高さ(56px) + 16px)` でChatBarに隠れないようにする
- NOTE: Phase 1ではチャット履歴は `AiAnalysis` テーブルに `type: 'coach_chat'` で保存。将来的に専用テーブルを検討

---

### Screen 5: AI Onboarding

**ファイル**: `src/app/(app)/onboarding/page.tsx`
**表示条件**: 初回ログイン時（project.conditions が未設定時）

#### コンポーネント構成

```
OnboardingPage
├── ProgressBar              ← Step X of 4, thin bar
├── ChatHistory              ← 蓄積されるチャットバブル
│   ├── AIBubble[]           ← 左寄せ、muted背景
│   └── UserBubble[]         ← 右寄せ、primary背景
├── CurrentQuestion          ← 現在の質問
│   └── PillOptions[]        ← 選択肢ボタン
└── SkipLink                 ← 「スキップ」
```

#### 質問フロー (4問)

| Step | Question | Options Type | Saves To |
|------|----------|-------------|----------|
| 1 | どんな雰囲気の式場が好みですか？ | PillGrid (6 options) | conditions.style |
| 2 | ゲストは何名くらいですか？ | NumberRange (slider) | conditions.guest_count |
| 3 | エリアの希望はありますか？ | PillGrid + TextInput | conditions.area |
| 4 | 予算の目安は？ | PillGrid (ranges) | conditions.budget |

各質問にSkip動線。最終ステップ後 → AI推薦式場3件提示 → ホームへ遷移。

---

### Screen 6: Venue Detail

**ファイル**: `src/app/(app)/venues/[id]/page.tsx`

#### セクション構成

```
VenueDetailPage (Server Component)
├── PhotoGallery              ← フルスワイプ、aspect-[4/3]
├── VenueHeader               ← 名前、エリア、スタイル、ステータス
├── RatingSection              ← 6次元星評価 + パートナー比較
│   └── StarRatingInput[]      ← 各48px、auto-save
├── EstimateSection            ← バージョン一覧 + AI分析
│   ├── EstimateCard[]
│   └── EstimateAIInsight
├── VisitSection               ← 見学記録
│   ├── VisitCard[]
│   └── QuickCaptureBar        ← 写真/メモのクイック入力
├── ReviewSummary              ← 口コミAI要約
└── ActionBar (sticky bottom)  ← [候補に追加] [比較に追加]
```

#### StarRatingInput

```typescript
// src/components/ratings/star-rating-input.tsx
interface StarRatingInputProps {
  dimension: 'atmosphere' | 'hospitality' | 'cuisine' | 'cost' | 'access' | 'reviews';
  // NOTE: Prisma ScoreDimension enum に合わせる。'reviews' = 総合印象（既存のconstants.tsと一致）
  // Tier1の6次元のみユーザー評価対象。残り6次元（dress, photo_video, flowers, staff_continuity, capacity, cancellation）はAI/口コミ自動取得
  label: string;
  helpText: string;
  value: number;
  partnerValue?: number;
  onChange: (value: number) => void;
}
```

**アクセシビリティ**:
- コンテナ: `role="radiogroup"` + `aria-label="{label}の評価"`
- 各星: `role="radio"` + `aria-checked={selected}` + `aria-label="{n}点"`
- キーボード操作: 左右矢印キーで値を増減（`ArrowRight`/`ArrowLeft`）、`Home`で1、`End`で5
- フォーカス: 選択中の星に `tabIndex={0}`、他は `tabIndex={-1}`（roving tabindex パターン）

```typescript
// Usage example
<div role="radiogroup" aria-label={`${label}の評価`}>
  {[1, 2, 3, 4, 5].map((n) => (
    <button
      key={n}
      role="radio"
      aria-checked={value === n}
      aria-label={`${n}点`}
      tabIndex={value === n ? 0 : -1}
      onKeyDown={handleArrowKeys}
      onClick={() => onChange(n)}
    >
      <Star filled={n <= value} />
    </button>
  ))}
</div>
```

- 各星: 48px, gap 8px (touch-friendly)
- 色: 未選択 `text-border`, 選択 `text-gold-warm`
- 感情ラベル: 星選択で動的表示 (1=期待はずれ, 3=普通, 5=感動!)
- Auto-save: debounce 500ms → Server Action
- パートナー値: 別行に小さい星 (20px) で表示

#### PartnerComparisonSummary (二人のベン図 — Soul要素)

```typescript
// src/components/ratings/partner-comparison-summary.tsx
interface PartnerComparisonSummaryProps {
  myRatings: Record<string, number>;
  partnerRatings: Record<string, number>;
  aiComment?: string; // AI生成の橋渡しコメント
}
```

- 各次元を横バーで並列表示（自分: gold-warm, パートナー: secondary）
- 一致次元（差分1以下）: `bg-success/10 border-l-2 border-success` + ✓アイコン
- 不一致次元（差分2以上）: `bg-amber-50 border-l-2 border-amber-500` + 💬アイコン
- 下部にAIコメント: 「雰囲気では一致しています。料理の評価で意見が分かれていますね。お二人で話してみてはいかがですか？」
- 一致度%: 全次元の一致率を円形インジケーターで表示（例: 「一致度 67%」）
- ComparisonBoard の QuickLook にも「二人の一致度 XX%」バッジを表示

---

#### Candidates サブビュー切替UI

ページ上部に Segmented Control を配置:

```
┌────────────────────────────────┐
│ [ショートリスト | 比較 | 決定]  │ ← Segmented Control
└────────────────────────────────┘
```

- スタイル: `bg-muted rounded-full p-1`、各セグメント `rounded-full px-4 py-2 text-sm`
- 選択中: `bg-card text-foreground shadow-sm`
- 未選択: `text-muted-foreground`
- 「決定」タブは比較ボードで「この式場に決める」を押した後にのみアクティブ化（それ以前はdisabled）
- 遷移アニメーション: コンテンツのfade + slide (200ms)

---

### Screen 7: Comparison Board

**ファイル**: `src/app/(app)/candidates/page.tsx` 内のサブビュー（Segmented Control で切替）

#### コンポーネント構成

```
ComparisonBoard
├── VenueSelectorRow          ← ドロップダウン x 2-3 + [追加]
├── QuickLookSection          ← 写真 + 円形スコア + Top3
├── ScoreBarSection           ← 6次元プログレスバー
│   ├── DiffOnlyToggle        ← DJI式「差分のみ」
│   └── DimensionBar[]        ← 各式場の水平バー
├── DetailAccordions          ← 基本情報/費用/アクセス/持込み
│   └── ComparisonRow[]       ← 横並びテキスト比較
├── AIInsightCard             ← Grammarly式インライン分析
└── HelpMeChooseButton        ← Tesla式CTA → Coachタブ
```

#### CircularProgressScore

```typescript
interface CircularProgressScoreProps {
  score: number; // 0-100
  size: 64 | 80;
  label?: string;
}
```

- SVGで実装、`stroke-dasharray`
- カラー: score 80+ gold-warm, 50-79 warm-gray, <50 muted-rose

#### DimensionBar

```typescript
interface DimensionBarProps {
  dimension: string;
  scores: { venueId: string; venueName: string; score: number }[];
}
```

- 高さ8px, 角丸4px
- 幅は max-score で正規化 (5点 = 100%)
- 色は ScoreColorScale に従う

---

### Screen 8: Decision Ceremony

**ファイル**: `src/components/decision/decision-ceremony.tsx`

#### 3フェーズ実装

```typescript
type CeremonyPhase = 'celebration' | 'summary' | 'reason';

interface DecisionCeremonyProps {
  venue: Venue;
  userName: string;
  journeyStats: {
    totalVenues: number;
    shortlisted: number;
    compared: number;
  };
}
```

**Phase 1: Celebration** (0-2秒)
- canvas-confetti: particleCount 100, colors [Navy, Gold, White]
- 中央テキスト: 「おめでとう、[名前]さん！」font-serif, 28px, 300
- サブ: 「[式場名]に決定しました」

**Phase 2: Summary** (スライドイン)
- 式場写真カード (16:9, rounded-2xl)
- 旅路サマリ: `10会場調査 → 5候補 → 3比較 → [式場名]に決定`
- 各ステップに緑チェックマーク

**Phase 3: Reason** (任意)
- タグチップ: 「雰囲気」「料理」「コスパ」「アクセス」「サービス」「設備」
- 自由テキスト: placeholder 「決め手を一言で...」
- [記録する] + [スキップ] ボタン

---

### Screen 9: Partner Invite

**ファイル**: `src/components/partner/partner-invite.tsx`

```typescript
interface PartnerInviteProps {
  projectId: string;
  inviteLink: string;
  partnerStatus: 'not_invited' | 'invited' | 'viewed' | 'reacted' | 'joined';
}
```

- Daze式空きスロット: 円形アバター枠 (dashed border)
- [パートナーを招待] ボタン → シェアシート
- シェアバー: LINE(最優先) → コピー → メッセージ → More
- ステータス表示: sent→viewed→reacted→joined のプログレス

---

### Screen 10: Partner Guest View (Level 1 — アカウント不要)

**ファイル**: `src/app/(app)/accept-invite/page.tsx` (リデザイン)

LINEリンクからアクセスするパートナー向け軽量画面。アカウント不要。

```
┌─────────────────────────────┐
│ VenueLens                    │
│ ○○さんが式場選びに           │
│ 招待しています               │
├─────────────────────────────┤
│ ┌───────────────────────┐  │
│ │ [4:3 Photo]           │  │ ← venue card (simplified)
│ ├───────────────────────┤  │
│ │ アニヴェルセル表参道     │  │
│ │ 表参道 · 着席80名       │  │
│ │ ¥350万〜               │  │
│ └───────────────────────┘  │
│                             │
│ この式場、どう思いますか？    │
│                             │
│ [👎 微妙]  [🤔 普通]  [👍 いいね] │ ← 3 reaction buttons (48px)
│                             │
│ ┌───────────────────────┐  │ ← after reaction
│ │ ありがとうございます！   │  │
│ │ もっと詳しく評価する →   │  │ ← link to signup
│ │ 他の式場も見る →         │  │ ← next venue card
│ └───────────────────────┘  │
└─────────────────────────────┘
```

**フロー**:
1. 式場カード表示（招待者が候補に入れた式場を順に）
2. 3ボタンリアクション（👍/🤔/👎）→ `submitPartnerReaction()` Server Action
3. リアクション後: 「ありがとう」+ 次のアクション誘導
4. 全式場にリアクション完了後: 「サインアップして詳しく評価しませんか？」→ サインアップ画面

**リアクションボタン**:
- 高さ: 48px, 幅: 均等3分割
- 色: 👎 `bg-rose-50 border-rose-200`, 🤔 `bg-amber-50 border-amber-200`, 👍 `bg-emerald-50 border-emerald-200`
- タップ: scale(0.95) 120ms + 背景色が濃くなる

---

### Screen 11: Estimate X-Ray (見積もりX線 — Soul要素)

VenueDetail の EstimateSection 内に表示されるAI分析UI。

```typescript
// src/components/estimates/estimate-xray.tsx
interface EstimateXRayProps {
  items: (EstimateItem & { predictedUpgrade: number; upgradeProbability: number; tier: string })[];
  totalEstimate: number;
  predictedFinal: number;
}
```

**レイアウト**:
```
┌─────────────────────────────┐
│ 💡 見積もりX線               │ ← gold-warm accent
│ 初期見積もり: ¥3,200,000     │
│ 予測最終額:   ¥3,850,000     │ ← bold, slightly larger
│ ┌─────────────────────┐     │
│ │ [ウォーターフォール     │     │ ← waterfall chart
│ │  チャート]             │     │    initial → upgrades → final
│ └─────────────────────┘     │
├─────────────────────────────┤
│ ⚠ 上がりやすい項目          │
│ ┌─────────────────────┐     │
│ │ 🍽 料理 ¥120,000       │     │ ← item row
│ │ 最低ランク → +¥15-30万 │     │ ← amber text, not red
│ │ ░░░░░░░██████░ 65%    │     │ ← upgrade probability bar
│ └─────────────────────┘     │
│ ┌─────────────────────┐     │
│ │ 👗 衣装 ¥180,000       │     │
│ │ 1着のみ → +¥20-40万   │     │
│ │ ░░░░░░░░█████░ 62%    │     │
│ └─────────────────────┘     │
│ ...                         │
├─────────────────────────────┤
│ 「80%のカップルが初期見積もり │ ← trust signal
│  より平均+100万円上がって    │
│  います。事前に把握して      │
│  おきましょう。」            │
└─────────────────────────────┘
```

**デザイン**:
- 警告色: `text-amber-600 bg-amber-50`（destructive赤ではなく amber。急かさないUX）
- 確率バー: 高さ6px, amber (>50%) / muted (<50%)
- ウォーターフォールチャート: Recharts BarChart、transparent + amber + gold-warm のスタック
- トーン: 「準備のために」であって「不安を煽る」ではない

---

## Shared Components

### Component Library (新規/更新)

| Component | Status | Path |
|-----------|--------|------|
| `BottomNav` | 新規 | `src/components/layout/bottom-nav.tsx` |
| `AIInsightCard` | 新規 | `src/components/ai/insight-card.tsx` |
| `ProgressRing` | 新規 | `src/components/ui/progress-ring.tsx` |
| `VenueCard` | 更新 | `src/components/venues/venue-card.tsx` |
| `FilterChips` | 新規 | `src/components/explore/filter-chips.tsx` |
| `StarRatingInput` | 更新 | `src/components/ratings/star-rating-input.tsx` |
| `ChatBubble` | 新規 | `src/components/coach/chat-bubble.tsx` |
| `ChatBar` | 新規 | `src/components/coach/chat-bar.tsx` |
| `CircularProgressScore` | 新規 | `src/components/comparison/circular-score.tsx` |
| `DimensionBar` | 新規 | `src/components/comparison/dimension-bar.tsx` |
| `DecisionCeremony` | 新規 | `src/components/decision/decision-ceremony.tsx` |
| `PartnerInvite` | 新規 | `src/components/partner/partner-invite.tsx` |
| `PhotoCarousel` | 新規 | `src/components/venues/photo-carousel.tsx` | **aria**: `role="region"` + `aria-roledescription="carousel"` + `aria-label="式場写真"` + 各スライドに `aria-label="写真 {n}/{total}"` |
| `PillOptions` | 新規 | `src/components/ui/pill-options.tsx` |

---

## Implementation Plan — Parallel Worktree Strategy

### Phase A: Foundation (sequential — must be first)
1. BottomNav + Layout restructure（認証→オンボーディング→ホームのリダイレクトロジック含む）
2. VenueCard + PhotoCarousel（Phase Bの3つのworktreeで共有されるため先に作る）
3. Shared UI components (ProgressRing, AIInsightCard, PillOptions, CircularProgressScore)
4. constants.ts 更新（5段階 ScoreColorScale、v2ルートの revalidatePath）
5. 各画面の loading.tsx + error.tsx + 空ステート（スケルトン構造は上記「Loading / Error / Empty States」セクション参照）

### Phase B: Main screens (parallel worktrees)

| Worktree | Branch | Screens | Dependencies |
|----------|--------|---------|--------------|
| wt-1 | feat/home-v2 | Home + Greeting + QuickActions + RecentVenues | Phase A |
| wt-2 | feat/explore-v2 | Explore + FilterChips + AddVenueSheet | Phase A (VenueCard) |
| wt-3 | feat/coach-v2 | Coach + InsightCardFeed + ChatBar | Phase A (AIInsightCard) |
| wt-4 | feat/candidates-v2 | Candidates + SegmentedControl + Shortlist | Phase A (VenueCard) |

### Phase C: Detail & comparison (parallel)

| Worktree | Branch | Screens |
|----------|--------|---------|
| wt-5 | feat/comparison-v2 | ComparisonBoard + DimensionBar + DiffToggle + QuickLook |
| wt-6 | feat/venue-detail-v2 | VenueDetail + RatingInput + EstimateXRay + PartnerComparisonSummary |
| wt-7 | feat/onboarding-v2 | AI Onboarding + ChatBubble + PillOptions |
| wt-8 | feat/partner-v2 | Partner Invite + Partner Guest View + Decision Ceremony |

### Phase D: Integration & Polish
- Merge all branches（コンフリクト解決）
- E2E test on 375px viewport
- Motion design polish（framer-motion spring configs）
- AIインサイトのトリガーロジック最終調整

---

## Data Dependencies

### Server Actions (新規/更新)

| Action | Purpose | Used By | Notes |
|--------|---------|---------|-------|
| `getHomeData()` | Home画面の全データ（最近の式場、進捗、AIインサイト） | Home | |
| `getAIInsights(projectId)` | AIインサイトカード一覧 | Home, Coach | |
| `sendCoachMessage(message)` | AIチャットメッセージ送信 | Coach | |
| `saveOnboardingAnswers(answers)` | オンボーディング回答保存 | Onboarding | |
| `getRecommendedVenues(projectId)` | AI推薦式場 | Onboarding, Explore | **Release 1**: 未実装（Onboarding完了後は「式場を探してみましょう」CTAでExploreへ誘導）。**Release 2**: Claude APIで条件マッチング実装 |
| `toggleFavorite(venueId)` | ショートリスト追加/削除 | VenueCard | |
| `getComparisonData(venueIds)` | 比較ボードデータ | ComparisonBoard | |
| `generateAIComparison(venueIds)` | AI比較分析 | ComparisonBoard | **Release 1**: テンプレート文（スコア差分に基づく定型文）。**Release 2**: Claude APIで自然言語分析に切替 |
| `makeDecision(venueId, reason)` | 最終決定記録 | DecisionCeremony | 既存 `makeDecision()` にマッピング（`src/server/actions/decisions.ts`） |
| `invitePartner(projectId)` | パートナー招待リンク生成 | PartnerInvite | 既存 `invitePartner()` にマッピング（`src/server/actions/invitations.ts`） |
| `submitPartnerReaction(venueId, reaction)` | パートナーリアクション (guest) | Partner Guest View | |

### AIインサイト トリガーロジック (`getAIInsights` 擬似コード)

```
function getAIInsights(projectId):
  insights = []

  // 見積もりインサイト: 見積もり入力済み & AI分析未生成
  for venue in project.venues:
    if venue.estimates.length > 0 AND no ai_analysis(type='estimate_prediction', venue_id=venue.id):
      insights.push({ type: 'estimate', venue, priority: 1 })

  // パートナー橋渡し: 二人の評価で差分2点以上
  for venue in project.venues:
    if partner_ratings_exist AND any dimension diff >= 2:
      insights.push({ type: 'partner', venue, priority: 2 })

  // 見学準備: 見学予定が3日以内
  for visit in project.visits:
    if visit.scheduledAt - now() <= 3 days AND visit.status == 'scheduled':
      insights.push({ type: 'visit', visit.venue, priority: 1 })

  // 比較提案: 候補2件以上 & 比較分析未生成
  if project.venues.filter(shortlisted).length >= 2 AND no recent ai_analysis(type='comparison'):
    insights.push({ type: 'comparison', priority: 3 })

  // リマインダー: 見学から3日以上経過 & 未評価
  for visit in project.visits:
    if visit.status == 'completed' AND now() - visit.completedAt >= 3 days AND no ratings:
      insights.push({ type: 'reminder', visit.venue, priority: 4 })

  return insights.sort_by(priority).limit(5)
```
| `submitPartnerReaction(venueId, reaction)` | パートナーリアクション | Guest view |

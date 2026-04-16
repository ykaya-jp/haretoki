# Accordion Zoom — 比較画面の粗×細統合設計

> 候補画面の5タブを3タブに統合し、6次元スコア（粗い粒度）とチェックリスト項目（細かい粒度）をアコーディオン展開で自由に行き来できるようにする。
> 承認日: 2026-04-16
> 参考: Google Shopping / Apple Health / DPReview / Airbnb / Kayak / Consumer Reports / Suumo

---

## 1. Problem Statement

ユーザーは式場を比較する際、粗い粒度（6次元スコア）と細かい粒度（チェック項目）を自由に行き来する。現状は5タブ（候補/比べる/観点別/チェック差分/決める）に分断されており:

1. どのタブが何をするか分からない
2. チェックリスト設定画面で選んだ項目が「比べる」「観点別」タブに反映されない
3. 粗→細→粗の往復に毎回タブ切替が必要（最低3タップ）
4. 同じデータを別々のServer Actionで取得しており、フィルタ状態が共有されない

## 2. Solution: Accordion Zoom

### 2.1 Tab Structure: 5 → 3

```
Before:  [ 候補 | 比べる | 観点別 | チェック差分 | 決める ]
After:   [ 候補 | 比べる | 決める ]
```

- **候補**: 現行維持（FavoriteFilter + VenueCard リスト）
- **比べる**: 旧「比べる」「観点別」「チェック差分」を統合。アコーディオン・ズーム
- **決める**: 現行維持（PriorityWeights + Decision Ceremony）

### 2.2 Accordion Zoom Layout (375px)

```
┌─────────────────────────────────┐
│ [ 候補 ]  [ 比べる ]  [ 決める ] │  ← 3-tab SegmentedControl
├─────────────────────────────────┤
│ [差分のみ]  [絞り込み]           │  ← filter bar
├─────────────────────────────────┤
│         式場A    式場B           │  ← sticky venue headers
├─────────────────────────────────┤
│ 総合     4.2      3.8           │  ← always visible (gold bg)
├─────────────────────────────────┤
│ ▼雰囲気  ★★★★☆  ★★★☆☆  (8) │  ← EXPANDED dimension
│ ┃ チャペル雰囲気  ◎      △     │  ← checklist items
│ ┃ 自然光         ◎      ◎     │
│ ┃ ガーデン       ○      —     │
│ ┃ 天井の高さ     高い    普通   │
├─────────────────────────────────┤
│ ▶料理    ★★★★☆  ★★★★★  (6) │  ← collapsed (stars visible)
│ ▶費用    ★★★☆☆  ★★★★☆ (10) │  ← collapsed
│ ▶アクセス ★★★★★  ★★☆☆☆  (5) │  ← collapsed
│ ▶スタッフ ★★★★☆  ★★★★☆  (7) │  ← collapsed
│ ▶総合印象 ★★★★☆  ★★★☆☆  (—) │  ← collapsed (no checklist)
├─────────────────────────────────┤
│ ✨ AIコーチ                      │
│ 雰囲気で式場Aが優勢。料理は...  │
└─────────────────────────────────┘
```

### 2.3 Dimension-to-Checklist Mapping

チェックリストの6カテゴリを6次元にマッピングする。`staff_estimate` は2次元にまたがらせる（subcategoryで分割）。

```typescript
// src/lib/constants.ts に追加
export const DIMENSION_CHECKLIST_MAP: Record<Tier1Dimension, {
  categories: ChecklistCategory[];
  subcategories?: string[];
}> = {
  atmosphere: {
    categories: ["chapel", "banquet", "facility"],
    // chapel全般 + banquetの雰囲気系 + facilityの設備
  },
  hospitality: {
    categories: ["staff_estimate"],
    subcategories: ["スタッフ"],
  },
  cuisine: {
    categories: ["cuisine_drink"],
  },
  cost: {
    categories: ["staff_estimate"],
    subcategories: ["見積り"],
  },
  access: {
    categories: ["facility"],
    // facilityの宿泊・バリアフリー系
  },
  reviews: {
    categories: [],
    // 総合印象にはチェック項目なし
  },
};
```

**注意**: `atmosphere` と `access` は同じ `facility` カテゴリを参照するが、subcategoryで分離する。`atmosphere` は「設備全般」のうち雰囲気に関するもの、`access` は宿泊・アクセシビリティ系。実装時に CHECKLIST_PRESETS の各itemにタグを追加して正確に分離する。

### 2.4 Interactions

| 操作 | 結果 | タップ数 |
|------|------|---------|
| 画面を開く | 全6次元の星スコアが一覧で見える（全折りたたみ） | 0 |
| 次元行をタップ | その次元のチェック項目が下に展開。chevron回転 | 1 |
| 展開中の次元を再タップ | 折りたたみ | 1 |
| 「差分のみ」トグル | 星スコア同点の行＋チェック値一致の行を非表示 | 1 |
| 式場ヘッダーのサムネタップ | 式場詳細ページへ遷移 | 1 |
| チェック項目行をタップ | メモ/写真を展開（ある場合） | 1 |
| **ワースト: 俯瞰→特定項目→俯瞰** | **展開1 + 折りたたみ1** | **2** |

### 2.5 Filter Behavior

- **「差分のみ」トグル**: 粗×細を横断。スコア差0.5以内の次元行を薄く表示 + チェック値一致の項目行を非表示
- **「絞り込み」**: 既存のドレス持込/支払方法フィルタ。式場列のフィルタリング
- フィルタ状態は `CandidatesView` に lift して全タブで共有

### 2.6 Mobile (375px) Specifics

- 2式場: 列幅 ~130px ずつ。問題なし
- 3式場: 横スクロール。ラベル列 sticky left。右端に fade gradient でスクロール示唆
- Venue headers: sticky top。スクロール時に圧縮（48px→24px thumbnail）
- 最初のカテゴリ（雰囲気）をデフォルト展開。chevron affordance を教示

### 2.7 Visual Design (Morning Light)

- 次元行（折りたたみ時）: `bg-card` + `border-b border-border`
- 次元行（展開中）: `bg-[rgba(201,168,76,0.03)]` + chevron gold回転
- 展開エリア: `ml-4 border-l-2 border-[rgba(201,168,76,0.2)]`
- チェック項目行: `text-meta text-muted-foreground`
- ◎ = `text-success`, △ = `text-amber-500`, × = `text-destructive`, — = `text-muted-foreground`
- 総合行: `bg-[rgba(201,168,76,0.06)]` gold subtle
- 展開アニメ: `200ms ease-out`。`prefers-reduced-motion` respect
- 星: gold-warm filled, border unfilled。48px touch target per star group

## 3. Data Flow

### 3.1 New Server Action

```typescript
// src/server/actions/comparison.ts (新規)
export async function getUnifiedComparisonData(): Promise<{
  venues: MatrixVenue[];
  dimensions: DimensionWithChecklist[];
  winners: Record<string, string>;
}> {
  // 1. getMatrixData() でスコアデータ取得（既存）
  // 2. getChecklistComparison() でチェック回答取得（既存）
  // 3. DIMENSION_CHECKLIST_MAP で紐付けて統合
  // 4. 1回のAPIコールで両方のデータを返す
}
```

### 3.2 Type Definitions

```typescript
interface DimensionWithChecklist {
  id: Tier1Dimension;
  label: string;
  scores: Record<string, number | null>; // venueId → score
  checklistItems: ChecklistItemComparison[];
}

interface ChecklistItemComparison {
  itemId: string;
  question: string;
  type: "yesno" | "memo" | "photo" | "number";
  answers: Record<string, { // venueId → answer
    value: string | null;
    memo: string | null;
  }>;
  hasDifference: boolean;
}
```

## 4. Component Changes

### 4.1 Modified

| Component | Change |
|-----------|--------|
| `candidates-view.tsx` | Tab type を 3タブに変更。`initialTab` は `shortlist \| compare \| decide`。フィルタ状態をここに lift |
| `segmented-control.tsx` | 変更なし（汎用コンポーネント） |

### 4.2 New

| Component | Purpose |
|-----------|---------|
| `src/components/comparison/accordion-zoom.tsx` | 統合比較ビュー。メインコンポーネント |
| `src/components/comparison/dimension-row.tsx` | 1次元行（折りたたみ/展開） |
| `src/components/comparison/checklist-item-row.tsx` | チェック項目行 |
| `src/server/actions/comparison.ts` | 統合データ取得 |

### 4.3 Removed / Deprecated

| Component | Status |
|-----------|--------|
| `dimension-focus.tsx` | 削除（accordion-zoomに吸収） |
| `checklist-comparison.tsx` | 削除（accordion-zoomに吸収） |
| `comparison-board.tsx` | 削除（既に孤立） |

## 5. Migration: Tab URL Parameters

現行 `?tab=matrix` → `?tab=compare` に変更。古い値は互換マッピング:

```typescript
const TAB_COMPAT: Record<string, Tab> = {
  matrix: "compare",
  focus: "compare",
  checklist: "compare",
};
```

## 6. Testing Requirements

- [ ] 3タブ間の自由遷移（SegmentedControl）
- [ ] 全6次元の展開/折りたたみ
- [ ] 「差分のみ」トグルの粗×細横断フィルタ
- [ ] 0件チェック項目の次元（reviews）でも展開がクラッシュしない
- [ ] 2式場/3式場での375pxレイアウト
- [ ] FavoriteFilter 0件でも表示維持（C1修正の回帰）
- [ ] ?tab=compare URLパラメータ動作
- [ ] 旧パラメータ ?tab=matrix の互換マッピング
- [ ] 式場詳細への遷移と戻り
- [ ] PriorityWeights（決めるタブ）の動作維持

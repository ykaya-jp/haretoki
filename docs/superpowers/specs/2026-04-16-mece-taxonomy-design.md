# MECE Taxonomy Restructure — 6次元→8次元 + 項目再マッピング

> 全チェック項目(80件)をMECE(相互排他・集合網羅)で8次元にマッピングし直す。
> Prismaスキーマ、constants、マッピング、比較UI、星評価UI全てに影響。
> 承認日: 2026-04-16

---

## 1. Problem

現在の6次元分類はカテゴリレベルの粗いマッピングで論理的破綻がある:
- 「日取りの空き状況」が費用に分類（スケジュールは費用ではない）
- 「収容人数」が雰囲気に分類（物理的制約は雰囲気ではない）
- dress_item 全15件が未分類（「その他」表示）
- 「サービススタッフの印象」が料理に分類（人の評価は料理ではない）

## 2. New Taxonomy: 8 Dimensions

| # | Key | UIラベル | 定義 | 項目数 |
|---|-----|---------|------|--------|
| 1 | ceremony_space | 挙式会場 | 挙式空間の雰囲気・演出・体験 | 15 |
| 2 | banquet_space | 披露宴会場 | 披露宴空間のレイアウト・装飾・演出設備 | 14 |
| 3 | cuisine | 料理・飲み物 | 料理の質・柔軟性、ドリンク、ケーキ | 13 |
| 4 | attire_items | 衣裳・アイテム | 衣裳、アクセサリー、ペーパーアイテム、ギフト | 15 |
| 5 | hospitality | スタッフ・対応 | スタッフの質、プランナー継続性、外部委託可否 | 5 |
| 6 | cost_contract | 費用・契約 | 見積もり内容、支払い条件、キャンセルポリシー | 8 |
| 7 | logistics | 利便性・設備 | 収容人数、動線、控え室、バリアフリー、日取り | 15 |
| 8 | overall | 総合印象 | 全体的な直感的評価（チェック項目なし） | 0 |

## 3. Item Moves (5件)

| Item | From | To | Reason |
|------|------|----|--------|
| chapel.guest.capacity | ceremony_space | logistics | 数値的キャパシティは物理的制約 |
| banquet.layout.capacity | banquet_space | logistics | 同上 |
| staff_estimate.estimate.availability | cost_contract | logistics | 日程はスケジューリング |
| cuisine_drink.cuisine.service-staff | cuisine | hospitality | スタッフ評価は人の判断 |
| dress_item.* (全15件) | unmapped | attire_items | 孤児→正式な次元 |

## 4. Implementation Scope

### 4.1 Prisma Schema
- `ScoreDimension` enum に `ceremony_space`, `banquet_space`, `cost_contract`, `attire_items`, `logistics` を追加
- 既存の `atmosphere`, `access` は **deprecate だが削除しない**（既存データ保護）
- マイグレーション: enum追加のみ（additive）

### 4.2 constants.ts
```typescript
export const TIER1_DIMENSIONS = [
  "ceremony_space",
  "banquet_space",
  "cuisine",
  "attire_items",
  "hospitality",
  "cost_contract",
  "logistics",
  "overall",
] as const;
```

既存スコアデータの互換マッピング:
```typescript
export const LEGACY_DIMENSION_MAP: Record<string, string> = {
  atmosphere: "ceremony_space", // 旧atmosphere → ceremony_space に読み替え
  access: "logistics",
  cost: "cost_contract",
  reviews: "overall",
};
```

### 4.3 dimension-checklist-map.ts
項目レベル（item ID単位）でのマッピングに書き換え。カテゴリレベルのマッピングは廃止。

### 4.4 Star Rating UI
式場詳細の星評価: 6行→8行。375pxでの垂直スペース増加に注意。

### 4.5 Comparison UI (AccordionZoom)
自動的に8行になる（TIER1_DIMENSIONSを参照するため）。

### 4.6 Data Migration
既存VenueScoreレコード（dimension='atmosphere'等）はそのまま保持。
読み出し時に LEGACY_DIMENSION_MAP で新次元に読み替える。

## 5. Testing

- [ ] 8次元全てに星評価が表示される
- [ ] 全80項目が正しい次元に分類されている（1項目も漏れなし）
- [ ] 重複マッピングがゼロ（1項目=1次元）
- [ ] 旧dimension のスコアデータが新dimensionとして表示される
- [ ] AccordionZoom で8次元すべてが展開可能
- [ ] チェックリスト設定画面は影響なし（物理カテゴリは変更しない）

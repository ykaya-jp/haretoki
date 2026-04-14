# Haretoki 全面刷新 設計書

> 2026-04-14 作成
> 範囲: UI/UXリデザイン + セキュリティ修正 + 実ユーザー要件 + バックエンド修正

---

## 1. プロダクトビジョン

**「二人で自然に、迷わず、後悔なく式場を選べるプロダクト」**

ターゲット: 20-30代の花嫁（主）+ パートナー（招待）
世界観: **「晴れの日」** — 曇り（不安）→ 晴れ間（見えてきた）→ 晴れの日（確信と喜び）

---

## 2. セキュリティモデル

### 2.1 アクセス制御の原則

```
Project スコープ内:
  - Owner (花嫁) と Partner は全データを共有
  - お気に入りは各自 + 互いに閲覧可能
  - 評価スコアは各自 + 比較可能

Project 間:
  - 完全に分離。他Projectのデータは一切見えない
```

### 2.2 修正が必要なServer Actions

全てのデータ操作で `venue.projectId === userProjectId` を検証する。

| ファイル | 関数 | 問題 | 修正 |
|---------|------|------|------|
| `ratings.ts` | `saveRatings()` | venueのproject帰属未検証 | venueを取得してprojectId照合 |
| `ratings.ts` | `saveDirectRatings()` | 同上 | 同上 |
| `estimates.ts` | `getEstimatesForVenue()` | projectIdフィルタなし | `where: { venueId, projectId }` |
| `visits.ts` | `addVisitNote()` | visit→venueの所有権未検証 | visit→venue→projectId照合 |
| `visits.ts` | `addNoteMedia()` | 同上 | 同上 |
| `visits.ts` | `toggleChecklistItem()` | 同上 | 同上 |
| `favorites.ts` | `toggleFavorite()` | venueのproject帰属未検証 | venueを取得してprojectId照合 |

### 2.3 共通ヘルパー

```typescript
// src/server/auth.ts に追加
export async function requireVenueAccess(
  userId: string,
  venueId: string
): Promise<{ projectId: string; venue: Venue }> {
  const { projectId } = await requireProjectMembership(userId);
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
  });
  if (!venue || venue.projectId !== projectId) {
    throw new Error("Venue not found or access denied");
  }
  return { projectId, venue };
}
```

---

## 3. デザインシステム

### 3.1 カラーパレット: "Morning Light"

コンセプト: 夜明けから朝日が差し込む瞬間の色。

**背景層 (90%)**

| Token | oklch | HEX近似 | 用途 |
|-------|-------|---------|------|
| `--background` | `oklch(0.97 0.01 80)` | #FBF7F1 | 主背景 |
| `--card` | `oklch(0.99 0.005 80)` | #FFFCF8 | カード |
| `--muted` | `oklch(0.95 0.01 75)` | #F3EDE4 | セクション背景、inactive |

**文字層**

| Token | oklch | HEX近似 | 用途 |
|-------|-------|---------|------|
| `--foreground` | `oklch(0.22 0.02 50)` | #2A2320 | 見出し・本文 |
| `--muted-foreground` | `oklch(0.52 0.02 60)` | #7A7068 | 補助テキスト |

**Primary (Rose) — ユーザーのアクション**

| Token | oklch | HEX近似 | 用途 |
|-------|-------|---------|------|
| `--primary` | `oklch(0.62 0.12 45)` | #C4816E | CTA、アクティブ、ハート |
| `--primary-foreground` | `oklch(0.99 0 0)` | #FFFCF8 | Primary上の文字 |

**Accent (Gold) — AIの贈り物**

| Token | oklch | HEX近似 | 用途 |
|-------|-------|---------|------|
| `--accent` / `--gold-warm` | `oklch(0.70 0.13 80)` | #C9A44C | AIインサイト、ロゴ |
| `--gold-light` | `oklch(0.80 0.10 80)` | #E2CC8A | AI背景 |
| `--gold-subtle` | `oklch(0.70 0.13 80 / 0.10)` | — | AIカード背景 |

**セマンティック**

| Token | oklch | HEX近似 | 用途 |
|-------|-------|---------|------|
| `--success` | `oklch(0.58 0.14 155)` | #5BA87A | 完了、成功 |
| `--destructive` | `oklch(0.55 0.15 25)` | #C75B5B | エラー、削除 |
| `--warning` | `oklch(0.70 0.14 80)` | #D4A03C | 警告 |

**ボーダー・シャドウ**

| Token | Value | 用途 |
|-------|-------|------|
| `--border` | `oklch(0.91 0.02 70)` | #E8E0D6 |
| `--input` | `oklch(0.91 0.02 70)` | inputボーダー |
| `--ring` | `oklch(0.62 0.12 45)` | フォーカスリング (Rose) |
| `--shadow-card` | `0 1px 3px rgba(42,35,32,0.04), 0 4px 12px rgba(42,35,32,0.06)` | |
| `--shadow-card-hover` | `0 4px 12px rgba(42,35,32,0.06), 0 20px 40px rgba(42,35,32,0.10)` | |
| `--shadow-gold` | `0 0 20px rgba(201,164,76,0.15)` | AIカード |

**カラー使い分けルール:**
- Rose = ユーザーアクション（ボタン、ハート、タップ）
- Gold = AIからの情報（インサイト、レコメンド、コーチ）
- 同一画面で両方使う場合: Gold=テキスト/アイコンのみ、Rose=ボタン/インタラクティブ

### 3.2 タイポグラフィ

変更なし。現状のNoto Serif JP + Noto Sans JP + Geist を維持。
- 見出し: Noto Serif JP (weight 300-400)
- 本文: Noto Sans JP
- 数字: Geist (tabular-nums)

### 3.3 スペーシング・角丸

角丸を統一:
- カード: 16px (`--radius-xl`)
- ボタン: 12px (`--radius-lg`)
- Input: 8px (`--radius-md`)
- Badge/Chip: 9999px (pill)

### 3.4 ロゴ

太陽モチーフのSVG:
- 中央に円（直径20px）、8本の放射状光線（2px幅、16px長）
- ゴールド (#C9A44C)
- ロゴタイプ: 「Haretoki」Noto Serif JP weight 300, tracking 0.15em
- ファビコン: 太陽マークのみ (SVG → PNG 16/32/192/512)
- 配置: `public/icons/`

### 3.5 モーション

| 場所 | アニメーション | 実装 |
|------|-------------|------|
| ページ遷移 | フェード+スライドアップ 200ms | framer-motion layout |
| カードホバー | translateY(-4px) + shadow拡大 300ms | CSS transition |
| カードタップ | scale(0.98) 150ms | CSS :active |
| ハートタップ | scale 1→1.3→1.0 200ms | framer-motion |
| リストアイテム | スタガードフェードイン 0.12s遅延 | framer-motion |
| 進捗 | 0→現在値 600ms ease-out | CSS transition |
| 決定セレモニー | sunburst + confetti 800ms | canvas-confetti |
| BottomNav切替 | アイコン微scale + 色遷移 150ms | CSS transition |
| Segmented切替 | sliding indicator 200ms | framer-motion layoutId |
| `prefers-reduced-motion` | 全て無効化 | globals.css |

---

## 4. 情報設計の修正

### 4.1 ホーム画面

**削除:**
- ThemeSwitcher → `/settings` に移動
- PartnerInvite → `/settings` に移動
- QuickActions → 廃止（BottomNavと完全重複）

**追加: Journey Card**

コンテキストに応じて変わる「旅路カード」。花嫁が毎日最初に見るもの。

```
状態判定ロジック:
if (totalVenues === 0) → "式場探しを始めましょう"
else if (visitedVenues === 0) → "気になる式場が見つかりましたね"
else if (favoriteCount === 0) → "見学お疲れさまでした"
else if (favoriteCount < 2) → "お気に入りをもう1件追加しましょう"
else if (!hasDecision) → "晴れ間が見えてきました"
else → "おめでとうございます！晴れの日"
```

各状態で表示:
- 天気メタファーアイコン（曇り→晴れ間→太陽）
- ステータスサマリ（候補N件、見学予定N件）
- コンテキスト対応の1行メッセージ
- 1つのCTAボタン（次にやるべきこと）

**設定への導線:**
- ヘッダー右上に歯車アイコン → `/settings`

**レイアウト順:**
1. 挨拶 + 設定アイコン
2. Journey Card (主役)
3. AIインサイトカード (あれば)
4. 最近の候補 (横スクロール)

### 4.2 設定画面の充実

現状の好み設定(SettingsForm)に加え:
- パートナー管理（招待リンク、パートナー状態表示）
- テーマ切替（ライト/ダーク）
- プロフィール（名前変更）
- ログアウト

### 4.3 壊れたナビゲーション修正

| 問題 | 修正 |
|------|------|
| Explore空ステート `href="#"` | AddVenueSheetを直接トリガーするボタンに変更 |
| Coach空ステートのCTAが曖昧 | `/explore` へのリンク + 「まずは式場を探してみましょう」テキスト |
| 比較タブ<2件の行き止まり | 「候補に式場を追加」ボタン → candidates候補タブに切替 |
| 「ショートリスト」 | 「候補」に名称統一 |
| VenueDetail戻るボタンなし | 左上にchevron-leftアイコン |

---

## 5. スキーマ拡張（実ユーザー要件）

### 5.1 Venue モデル拡張

```prisma
model Venue {
  // 既存フィールド...

  // 新規: 費用・条件
  costMin          Int?        @map("cost_min")         // 費用相場下限（万円）
  costMax          Int?        @map("cost_max")         // 費用相場上限（万円）
  dressBringIn     DressBringIn? @map("dress_bring_in") // ドレス持ち込み
  dressBringInFee  Int?        @map("dress_bring_in_fee") // 持ち込み料（円）
  paymentMethods   String[]    @map("payment_methods")  // ["card","cash","installment"]
  
  // 新規: リレーション
  plans            VenuePlan[]
}

enum DressBringIn {
  allowed       // 可
  not_allowed   // 不可
  negotiable    // 要相談
}
```

### 5.2 VenuePlan モデル（新規）

```prisma
model VenuePlan {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId          String   @map("venue_id") @db.Uuid
  name             String                        // プラン名
  basePrice        Int?     @map("base_price")   // 基本価格
  guestCountMin    Int?     @map("guest_count_min")
  guestCountMax    Int?     @map("guest_count_max")
  includedItems    Json     @default("[]")       // ["衣裳2着","料理","装花"]
  excludedItems    Json     @default("[]")       // ["写真","引出物"]
  bringInItems     Json     @default("[]")       // [{"item":"カメラマン","fee":50000}]
  dressAllowance   String?  @map("dress_allowance") // "新婦2着+新郎1着"
  campaigns        Json     @default("[]")       // ["春得プラン -20万","成約特典 ケーキ無料"]
  notes            String?
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@index([venueId])
  @@map("venue_plans")
}
```

### 5.3 VisitChecklistItem 拡張

```prisma
model VisitChecklistItem {
  id         String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  visitId    String               @map("visit_id") @db.Uuid
  item       String                                // チェック項目名
  category   String?                               // chapel/facility/banquet/dress_item/staff_estimate/cuisine_drink
  status     ChecklistItemStatus  @default(unchecked)  // ← Boolean→enum
  memo       String?                               // 自由記述メモ
  photoUrls  String[]             @default([]) @map("photo_urls")  // 写真URL
  sortOrder  Int                  @default(0) @map("sort_order")
  checkedAt  DateTime?            @map("checked_at")

  visit Visit @relation(fields: [visitId], references: [id], onDelete: Cascade)

  @@index([visitId])
  @@map("visit_checklist_items")
}

enum ChecklistItemStatus {
  unchecked   // 未確認
  yes         // はい
  no          // いいえ
}
```

### 5.4 Review 拡張

```prisma
model Review {
  // 既存フィールド...

  // 新規: カテゴリ別AI要約
  categorySummary  Json?    @map("category_summary")
  // {
  //   "service": "スタッフの対応は丁寧で...",
  //   "cuisine": "料理の味は高評価だが...",
  //   "cost_increase": "平均+80万円。衣裳と装花で上がりやすい",
  //   "negative_highlights": ["駐車場が狭い","音響が悪い"]
  // }
  isNegative       Boolean  @default(false) @map("is_negative")  // ネガティブ判定
}
```

### 5.5 見学チェックリストテンプレート

AIではなく、奥様の要件から固定テンプレートを作成。6カテゴリ×複数項目。
`src/lib/checklist-templates.ts` に定義:

```typescript
export const CHECKLIST_TEMPLATES: Record<string, ChecklistCategory> = {
  chapel: {
    label: "挙式会場",
    items: [
      { item: "内装や装飾は理想の雰囲気に合うか", sortOrder: 1 },
      { item: "挙式会場の広さはちょうどいいか", sortOrder: 2 },
      { item: "バージンロードの長さや素材は好みか", sortOrder: 3 },
      { item: "窓の数、光の入り方、照明", sortOrder: 4 },
      { item: "（人前式の場合）十字架は外せるか", sortOrder: 5 },
      { item: "ゲストの最大収容人数", sortOrder: 6 },
      { item: "席と席の間隔、ゲストとの距離感", sortOrder: 7 },
      { item: "どの席からも新郎新婦が見えやすいか", sortOrder: 8 },
      { item: "希望の儀式や演出ができるか", sortOrder: 9 },
      { item: "音楽の演奏方法は好みに合うか", sortOrder: 10 },
      { item: "屋外の場合、雨天時の対応", sortOrder: 11 },
    ],
  },
  facility: {
    label: "設備",
    items: [
      { item: "当日、他の結婚式と動線がかぶらないか", sortOrder: 1 },
      { item: "会場内はスムーズに移動できるか", sortOrder: 2 },
      { item: "ゲスト・親族控え室の数や広さ", sortOrder: 3 },
      { item: "ブライズルームは好みの雰囲気か", sortOrder: 4 },
      { item: "クロークやゲスト更衣室はあるか", sortOrder: 5 },
      { item: "授乳室、託児所はあるか", sortOrder: 6 },
      { item: "トイレの広さや個数、清潔感", sortOrder: 7 },
      { item: "エレベーターやバリアフリーの設備", sortOrder: 8 },
      { item: "喫煙スペースまでのルート", sortOrder: 9 },
      { item: "遠方ゲストの宿泊施設は近くにあるか", sortOrder: 10 },
    ],
  },
  banquet: {
    label: "披露宴会場",
    items: [
      { item: "ゲストの最大収容人数", sortOrder: 1 },
      { item: "1卓当たりの最大人数と理想的な人数", sortOrder: 2 },
      { item: "メイン卓から会場全体が見渡せるか", sortOrder: 3 },
      { item: "ゲスト卓のどの席からでもメイン卓は見えるか", sortOrder: 4 },
      { item: "装花の種類、ボリュームや価格帯", sortOrder: 5 },
      { item: "テーブルクロスやナプキンは好みの色を選べるか", sortOrder: 6 },
      { item: "窓の数、景色や光の入り方、照明", sortOrder: 7 },
      { item: "ガーデンやテラスの様子", sortOrder: 8 },
      { item: "ふたりの希望の演出は叶うか", sortOrder: 9 },
      { item: "スクリーンやプロジェクターの設備", sortOrder: 10 },
      { item: "音響の設備や音質", sortOrder: 11 },
      { item: "照明のバリエーション", sortOrder: 12 },
    ],
  },
  dress_item: {
    label: "衣裳・アイテム",
    items: [
      { item: "提携先の衣裳の種類やサイズは豊富か", sortOrder: 1 },
      { item: "アクセサリーやヘッドアクセサリーの種類", sortOrder: 2 },
      { item: "ブーケの種類・価格帯", sortOrder: 3 },
      { item: "持ち込みは可能か、持ち込み料はいくらか", sortOrder: 4 },
      { item: "新郎衣裳も充実しているか", sortOrder: 5 },
      { item: "親族やゲストの衣裳レンタルは可能か", sortOrder: 6 },
      { item: "親族やゲストの着付け、ヘアメイクは可能か", sortOrder: 7 },
      { item: "好みのヘアメイクがかないそうか", sortOrder: 8 },
      { item: "衣裳プランの内容や選べる衣裳の限度額", sortOrder: 9 },
      { item: "ペーパーアイテムの種類", sortOrder: 10 },
      { item: "ギフト（引出物や引菓子）の種類", sortOrder: 11 },
      { item: "アイテムの持ち込みはできるか、持ち込み料", sortOrder: 12 },
    ],
  },
  staff_estimate: {
    label: "スタッフ・見積り",
    items: [
      { item: "見学時の担当者がプランナーになってくれるか", sortOrder: 1 },
      { item: "担当者以外のスタッフの接客態度", sortOrder: 2 },
      { item: "司会やフォトグラファーは外部に頼めるか", sortOrder: 3 },
      { item: "日取りの空き状況", sortOrder: 4 },
      { item: "見積りに含まれる/含まれない内容", sortOrder: 5 },
      { item: "支払いタイミング、予約金", sortOrder: 6 },
      { item: "カード払い/現金払い", sortOrder: 7 },
      { item: "セットプラン、キャンペーン、特典", sortOrder: 8 },
      { item: "延期やキャンセル料の期間・条件・料金", sortOrder: 9 },
    ],
  },
  cuisine_drink: {
    label: "料理・飲み物",
    items: [
      { item: "料理の味、ボリューム、盛り付け方", sortOrder: 1 },
      { item: "食材の希望はどこまで叶うか", sortOrder: 2 },
      { item: "ゲストの年齢層に合った料理が提供できるか", sortOrder: 3 },
      { item: "アレルギー対応、オリジナルメニューは可能か", sortOrder: 4 },
      { item: "料理演出はあるか", sortOrder: 5 },
      { item: "プレートやカトラリーはテーマに合うか", sortOrder: 6 },
      { item: "サービススタッフの印象", sortOrder: 7 },
      { item: "ドリンクの種類はゲスト層に合うか", sortOrder: 8 },
      { item: "ウエディングケーキの選択肢", sortOrder: 9 },
    ],
  },
};
```

---

## 6. Explore画面: ソート・フィルタ

### 6.1 フィルタ項目

| フィルタ | UIパターン | データソース |
|---------|----------|------------|
| 総合評価 | スライダー (3.0-5.0) | VenueScore avg |
| カテゴリ別評価 | ドロップダウン+スライダー | VenueScore per dimension |
| 費用相場 | 範囲スライダー (100万-800万) | Venue.costMin/costMax |
| ドレス持ち込み | チップ (可/不可/要相談) | Venue.dressBringIn |
| 支払い方法 | チップ (カード/現金/分割) | Venue.paymentMethods |
| ステータス | チップ (既存) | Venue.status |

### 6.2 ソート

| ソート順 | 方向 |
|---------|------|
| 総合評価が高い順 | DESC |
| 費用が安い順 | ASC (costMin) |
| 費用が高い順 | DESC (costMax) |
| 追加日が新しい順 | DESC (createdAt) |

### 6.3 実装

FilterChips コンポーネントを拡張。フィルタパネル（Sheet）でスライダーやチップを配置。
Server Actionの `getVenues()` にフィルタ/ソートパラメータを追加。

---

## 7. 口コミ要約と分析

### 7.1 カテゴリ別要約

Review.categorySummary (Json) に以下の構造で保存:

```typescript
interface CategorySummary {
  service: string;      // 接客
  cuisine: string;      // 料理
  costIncrease: string; // 見積もりからの金額上昇
  negativeHighlights: string[]; // ネガティブなポイント
  overall: string;      // 総合
}
```

### 7.2 ネガティブ優先モード

VenueDetail の口コミセクションにトグル:
- デフォルト: 総合順
- ON: ネガティブ口コミ優先（Review.isNegative === true を上位に）

### 7.3 見積もり金額上昇の可視化

EstimateSection にウォーターフォールチャート:
- 横軸: 項目カテゴリ
- 縦軸: 金額
- 初期見積もり → 予測上昇分 → 最終予測を積み上げ表示
- recharts の BarChart で実装

---

## 8. 画面別リデザイン仕様

### 8.1 ランディングページ

- 背景: `--background` (クリーム) + 太陽光のグラデーション
- ヒーロー: ロゴ + ヘッドライン + サブヘッド + CTA
- 統計セクション: カード化 + 数字にcountUpアニメーション
- 特徴セクション: 維持（新パレット適用）
- AIコーチプレビュー: Navy→クリーム背景 + Roseアクセント
- フッター: 維持（新パレット適用）

### 8.2 認証画面

- Split layout のNavyパネル → クリーム背景 + ロゴ + ソフトパターン
- フォーム: 角丸統一、フォーカスリングをRose
- ソーシャルログインボタンのスタイル統一

### 8.3 ホーム画面

上記 §4.1 参照。Journey Card + AIインサイト + 最近の候補。

### 8.4 Explore画面

- ヘッダー: 「式場を探す」+ 追加ボタン + フィルタボタン
- フィルタパネル (Sheet): §6 のフィルタ/ソート
- 式場カード: 写真グラデーションオーバーレイ + 式場名 + スコア
- 空ステート: AddVenueSheetを直接開くCTA
- AIレコメンド: 維持（新パレット適用）

### 8.5 Candidates画面

- SegmentedControl: 「候補」/「比較」/「決定」
- sliding indicator アニメーション
- 比較タブ <2件: 「候補に追加してください」+ 候補タブ切替ボタン
- 空ステート: 温かいコピー + CTA

### 8.6 Coach画面

- チャットバブル: 角丸大、AI側にゴールドアバター（太陽アイコン）
- 背景: わずかにLinen色
- インサイトカード: Gold-subtle背景 + 3px gold左ボーダー
- ChatBar: 維持（新パレット適用）

### 8.7 VenueDetail画面

- 戻るボタン: 左上にchevron-left
- セクション間余白拡大
- ActionBar CTA: Rose色
- チェックリスト: 6カテゴリ折りたたみ (§5.5)
- 口コミ: カテゴリ別要約 + ネガティブトグル (§7)
- プラン: 構造化表示 (§5.2)
- 見積もり: ウォーターフォールチャート (§7.3)

### 8.8 Settings画面

- パートナー管理
- テーマ切替
- 好み設定 (既存)
- プロフィール
- ログアウト

---

## 9. 実装フェーズ

### Phase 1: セキュリティ + UX修正 + デザイン基盤
1. セキュリティ修正 (全Server Action)
2. 情報設計修正 (ホーム画面、設定画面、壊れたリンク)
3. globals.css + DESIGN.md 書き換え
4. ロゴ SVG 作成
5. ビルド・テスト確認

### Phase 2: スキーマ拡張 + 新機能
6. Prisma schema 変更 + migration
7. チェックリストテンプレート実装
8. Explore フィルタ/ソート
9. VenuePlan CRUD

### Phase 3: 画面リデザイン
10. ランディングページ
11. 認証画面
12. ホーム画面 (Journey Card)
13. Explore画面
14. VenueDetail画面
15. Candidates画面
16. Coach画面
17. Settings画面

### Phase 4: アニメーション + 仕上げ
18. framer-motion 全画面適用
19. ビルド・lint・E2Eテスト

---

## 10. 制約

- Next.js 16 + Tailwind CSS 4 + shadcn/ui
- framer-motion (installed)
- Noto Serif JP / Noto Sans JP / Geist
- モバイルファースト (375px)
- 全タッチターゲット 44px+
- prefers-reduced-motion 対応
- Opusで直接実装（Sonnetに委譲しない）

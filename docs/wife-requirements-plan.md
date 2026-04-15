# 妻要件対応 実装計画

## サマリー
- 対応項目: 6件（S×1 / M×4 / L×1）
- 想定リリース: **Release 1.5a / 1.5b** の2本（R2 Claude API 展開と並行）
- 要意思決定事項: **4件**（実装着手前にユーザー確認必要）
- 方針: 既存スキーマを壊さず非互換を避ける。`categorySummary` 等の Json フィールドは「構造化列の追加」でマイグレーションし、AI 出力は R2 で段階的に強化する

参照: [wife-requirements.md](./wife-requirements.md), [roadmap.md](./roadmap.md), [NFR](./superpowers/specs/2026-04-13-nonfunctional-requirements.md)

---

## 優先度 S（最優先 — 妻が #1 と明示）

### S1. 見積もり金額上昇の数値化（レビュー由来）
- **WHY**: 妻の最重要シグナル。現状は `categorySummary.estimate_increase` のカテゴリカル文字列のみで、比較ボード/フィルタで数値活用不可
- **WHAT**: レビュー本文から「初期見積もり → 最終金額 → 差額 / 上昇率」を数値抽出し、式場単位で集約。比較・フィルタ・ソートに利用。妻要件 §5 のウォーターフォール表示にも流用（`estimate-waterfall-chart.tsx` が既存）
- **HOW**:
  - **Schema**: `Review` に `estimateIncrease Json?`（`{initial, final, deltaYen, deltaPct, confidence, sampleCount}`）追加。`Venue` に集約キャッシュ列 `reviewEstimateDeltaYen Int?` / `reviewEstimateDeltaPct Decimal?` / `reviewEstimateSampleCount Int?` を追加（ソート用インデックス）
  - **Migration**: `npx prisma migrate dev --name review_estimate_increase`。既存レビューは nullable で無害
  - **Server Action**: `src/server/actions/reviews.ts` の AI 要約生成時に数値フィールドを抽出（R2 Claude プロンプトを更新）。集約は `recomputeVenueReviewEstimate(venueId)` を追加してレビュー upsert 後に呼ぶ。R1 時点は手入力フォールバックも用意
  - **UI**: (a) `review-section.tsx` にバッジ「平均 +¥80万 / +22%（n=12）」表示、(b) `venue-filter-sheet.tsx` にレンジスライダー「上昇率 ≤ X%」、(c) `candidates-view.tsx` 比較マトリクスに列追加、(d) `estimate-waterfall-chart.tsx` でレビュー平均線をオーバーレイ
  - **Test**: `tests/actions/reviews.test.ts` で抽出 JSON スキーマを zod 検証 / 集約計算のユニットテスト / `venue-filter-sheet.test.tsx` で閾値フィルタ
- **Effort**: **L**（AI プロンプト + 集約 + 3 箇所の UI）
- **Dependencies**: R2 の Claude API 接続（未接続時は手入力経路で動かせるよう設計）
- **Parallel可**: ✅ Schema/Action と UI を別 worktree（`feat/r15a-estimate-delta-data` / `feat/r15a-estimate-delta-ui`）

---

## 優先度 M（モデルあり、UI 未整備）

### M1. `VenuePlan` 編集 UI + 構造化プラン比較
- **WHY**: 妻要件 §3「プラン内容の透明化」の中核。スキーマは揃っているが UI が AI 抽出頼みで手動編集できず、実用性ゼロ
- **WHAT**: `add-venue-sheet.tsx` / `venue-form.tsx` / 詳細ページにプラン編集フォームを追加。`plan-section.tsx` は読み取り専用なので編集モード導入
- **HOW**:
  - Schema: 変更なし（`VenuePlan` は既存）。ただし `includedItems`/`excludedItems`/`bringInItems` の Json 形状を zod で型付け（`{label, note?, feeYen?}[]`）
  - Migration: 不要
  - Server Action: `src/server/actions/plans.ts` に `upsertVenuePlan` / `deleteVenuePlan` を追加（既存の AI 抽出ルートと共存）
  - UI: shadcn `Sheet` + `react-hook-form` で複数プラン対応。含まれる/含まれない/持ち込みは `useFieldArray` で行追加。キャンペーンは既存 Json を踏襲
  - Test: zod スキーマのユニットテスト + Sheet のフォーム submit E2E
- **Effort**: **M**
- **Dependencies**: なし
- **Parallel可**: ✅（S1 と完全独立）

### M2. `dressAllowance` の構造化
- **WHY**: 妻要件 §3「ドレスは何着分含まれるか（新婦2着？新郎分は別？）」の直接要望。現状 `String?` のフリーテキストで比較不能
- **WHAT**: 新婦/新郎の着数と上限金額を別フィールドで保持。既存フリーテキストは `notes` として残す
- **HOW**:
  - Schema: `VenuePlan` に `dressBrideCount Int?` / `dressGroomCount Int?` / `dressBudgetCapYen Int?` / `dressAllowanceNote String?` 追加。`dressAllowance String?` は **非推奨化して残置**（データロスを避ける）
  - Migration: `npx prisma migrate dev --name venue_plan_dress_structured` + 既存値を `dressAllowanceNote` へコピーするデータ移行 SQL
  - Server Action: `upsertVenuePlan`（M1 と統合）に含める
  - UI: プラン編集フォームに「新婦 [1][2][3]着」「新郎 ☐込み」「上限 ¥___万円」の構造化入力。比較マトリクスには「👰2着 + 🤵1着 / ¥80万まで」と要約表示
  - Test: データ移行 SQL のドライラン、表示ロジックのスナップショット
- **Effort**: **S〜M**
- **Dependencies**: M1（同じ編集 UI に乗せる）
- **Parallel可**: M1 と同じ worktree 推奨

### M3. ドレス持ち込み料フィルタを数値レンジ化
- **WHY**: 現状 0/5万/10万の 3 プリセット（`venue-filter-sheet.tsx`）は妻要件 §1「金額で絞りたい」に不足
- **WHAT**: 数値レンジスライダー化 + 「無料のみ」「要相談含む」トグル
- **HOW**:
  - Schema: 変更なし（`dressBringInFee Int?` は既存）
  - Migration: 不要
  - Server Action: `src/server/actions/venues.ts` のフィルタ句を `lte/gte` に変更
  - UI: shadcn `Slider` 2ハンドル。`DressBringIn` enum との組み合わせロジックを明示
  - Test: フィルタ境界値（0円、null、negotiable）のユニットテスト
- **Effort**: **S**
- **Dependencies**: なし
- **Parallel可**: ✅

### M4. `checklist-comparison` を比較ビューに統合 + ウエディングケーキ「オリジナル可否」
- **WHY**: 妻要件 §4「見学チェックリストの横並び比較」および §4-6「ウエディングケーキ オリジナル可能か」。コンポーネントは存在するが `candidates-view.tsx` に未接続
- **WHAT**: (a) 比較タブに「チェックリスト差分」を追加、(b) `CUISINE.ウエディングケーキ` 項目を「オリジナル対応: 可/不可/未確認 + メモ」の構造に拡張
- **HOW**:
  - Schema: チェックリスト項目マスターに `allowsCustom Boolean?` を追加するか、`VisitChecklistItem.metadata Json?` で表現（**要意思決定 #3**）
  - Migration: 上記決定次第
  - Server Action: `src/server/actions/visits.ts` でメタデータ読み書き
  - UI: `candidates-view.tsx` に新タブ「チェック差分」追加し `checklist-comparison.tsx` をマウント。未チェック項目は「ー」表示
  - Test: 3式場比較のスナップショットテスト
- **Effort**: **M**
- **Dependencies**: #3 の意思決定
- **Parallel可**: ✅

---

## 優先度 L（あったら良い）

### L1. `paymentMethods` の enum 化 + 分割回数
- **WHY**: 妻要件 §1「分割可」を比較軸化したいが、現状 `String[]` フリータグで「分割3回まで」等が表現不能
- **WHAT**: `PaymentMethod` enum 導入 + `maxInstallments Int?` 追加
- **HOW**:
  - Schema: `enum PaymentMethod { credit_card, cash, bank_transfer, installment }` + `Venue.maxInstallments Int?`。既存 `paymentMethods String[]` は非推奨化しつつ残置
  - Migration: 既存フリータグを正規化する one-off SQL（"カード" → credit_card 等）。**要意思決定 #2**
  - Server Action: フィルタを enum 対応に変更
  - UI: `venue-filter-sheet.tsx` に enum チップ + 「分割N回以上」入力
  - Test: マイグレーション dry-run + フィルタ境界
- **Effort**: **M**
- **Dependencies**: 既存データの正規化方針
- **Parallel可**: ✅（ただし破壊的変更なので R1.5b 後半で）

---

## リリース提案

### Release 1.5a — 最優先シグナル（2週間目安）
- **含む**: S1（見積もり上昇数値化）, M3（ドレス持込料レンジ）
- **Worktree**:
  - `feat/r15a-estimate-delta` — Schema + reviews action + waterfall overlay
  - `feat/r15a-dress-fee-range` — filter UI のみ
- **並列性**: Foundation（schema）を先行マージ → UI 2本を並列で進行
- **成功基準**: 妻が「口コミ由来の上昇額で式場をソートできる」を体感できる

### Release 1.5b — データ整形とプラン透明化（2〜3週間目安）
- **含む**: M1（VenuePlan 編集 UI）, M2（dressAllowance 構造化）, M4（チェックリスト比較 + ケーキ）
- **Worktree**:
  - `feat/r15b-plan-editor` — M1+M2（同一 Sheet）
  - `feat/r15b-checklist-compare` — M4
- **依存**: R1.5a の schema migration マージ後に分岐

### Release 1.5c（任意, R2 併走可） — 決済方法正規化
- **含む**: L1
- **Worktree**: `feat/r15c-payment-enum`
- 破壊的変更のため R1.5b 安定化後

---

## 要意思決定事項（実装前にユーザー確認）

1. **`dressAllowance` 既存データの移行**: (A) 全件 `dressAllowanceNote` にコピーして構造化列は空で開始 / (B) 正規表現で「新婦◯着」「¥◯万円」を自動パース / (C) 破棄し再入力を促す。**推奨: A**（データ保全優先）
2. **`paymentMethods` enum 化のタイミング**: (A) R1.5c として独立 / (B) R3 以降に延期 / (C) 現状維持＋UI 側の正規化表示のみ。**推奨: A**（妻要件に明示あり）
3. **チェックリスト拡張方式**: (A) 項目マスターに `allowsCustom` 列追加（型安全） / (B) `VisitChecklistItem.metadata Json` で汎用化（拡張容易）。**推奨: B**（他カテゴリの拡張要望にも対応しやすい）
4. **レビュー金額抽出の AI 境界**: R1.5a 時点で Claude API 未接続なら (A) 手入力のみでリリース / (B) R2 完了を待つ / (C) OpenAI 等のフォールバック。**推奨: A**（手入力経路を常設。R2 で AI 自動抽出を追加）

---

## 非機能要件との整合

- **パフォーマンス予算（LCP < 2.5s / INP < 200ms）**:
  - S1 集約列により比較マトリクスの N+1 を回避。`Venue` に denormalized 列を持たせることでソート時 DB 側で完結
  - ウォーターフォール / チェックリスト比較は dynamic import で既存方針（`estimate-waterfall-chart-impl.tsx` パターン）を踏襲
- **バンドルサイズ（NFR §6）**:
  - プラン編集 Sheet は `react-hook-form` 既存依存のみで新規ライブラリ不要
  - フィルタのレンジスライダーは shadcn `Slider`（既存）を利用。新規アイコンは `lucide-react` の named import で tree-shake
- **AI コスト（R2）**: S1 の金額抽出プロンプトは既存 `review_summary` パイプに統合し、`input_hash` で重複排除（NFR §AIコスト最適化準拠）
- **モバイル 375px**: プラン編集 Sheet は `useFieldArray` の行を縦積みし、比較マトリクスは横スクロール（既存パターン維持）
- **テスト**: 各項目で Vitest ユニット + 1 ケースは Playwright E2E（妻の実ユースケース「上昇率でソートして上位3件をハート」）

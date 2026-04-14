# VenueLens Revised Roadmap

> Based on 5-agent review: Mobile UX Audit, Feature Gap Analysis, Competitor Research, Tech Debt Review, Bride Persona Walkthrough

---

## Phase 1.5 — UX Foundation Fix (現在のMVPを「使える」レベルに)

**Goal:** 今のMVPが抱えるCRITICAL/HIGHな問題を全て解消し、奥さんに「これいいね」と言ってもらえるレベルにする。

### 1.5.1 タッチターゲット・SafeArea全面修正
- [ ] `input.tsx`: `h-8` → `h-11`（44px）
- [ ] `button.tsx`: default `h-8` → `h-11`
- [ ] `mobile-bottom-nav.tsx`: `pb-safe`（iOS SafeArea対応）
- [ ] `app/(app)/layout.tsx`: `pb-16` → `pb-[calc(4rem+env(safe-area-inset-bottom))]`
- [ ] `venue-status-select.tsx`: `min-h-[44px]`
- [ ] `conditions/page.tsx`: チップに `min-h-[44px]`
- [ ] `venue-list-controls.tsx`: フィルターチップ `min-h-[36px]` → `min-h-[44px]`
- [ ] `app-nav.tsx`: ログアウトボタン `min-h-[44px]`
- [ ] `progress-bar.tsx`: テキスト `text-[10px]` → `text-xs`（12px）
- [ ] フォームの `inputMode="numeric"` 追加（capacityMin/Max, 予算）

### 1.5.2 エラー処理・フィードバック基盤
- [ ] `src/app/(app)/error.tsx` 作成（グローバルエラーバウンダリ）
- [ ] `src/app/global-error.tsx` 作成
- [ ] shadcn/ui `Sonner`（トースト）導入、全Server Action成功/失敗時に表示
- [ ] 評価保存時の成功トースト
- [ ] 式場追加時の成功トースト
- [ ] 空ステートに全てアクションボタン追加（compare, decision, shortlist）

### 1.5.3 認証・セキュリティ修正
- [ ] 共通 `src/server/auth.ts` に `requireUser()` / `requireProjectMembership()` を統一
- [ ] `updateProjectStep` に認証追加
- [ ] `getDecision` にプロジェクト所属確認追加
- [ ] 全Server Actionの認証パターンを統一ヘルパーに置換

### 1.5.4 条件設定の改善
- [ ] `conditions/page.tsx` をServer Component + Client Formに分離
- [ ] 保存済み条件を初期値として表示
- [ ] 挙式予定日（date_range）フィールド追加
- [ ] `ProjectConditions` 型を `src/types/` に切り出し

### 1.5.5 見積もり手動入力（比較を意味あるものに）
- [ ] `src/server/actions/estimates.ts` 作成
- [ ] `src/components/venues/estimate-form.tsx`（総額 + 主要項目の手動入力）
- [ ] 式場詳細ページに見積もりセクション追加（プレースホルダー置換）
- [ ] 比較マトリクスに見積もりデータを接続（「—」解消）
- [ ] `EstimateItem` / `VisitChecklistItem` にインデックス追加（マイグレーション）

### 1.5.6 ショートリスト導線の改善
- [ ] 式場カードに「候補に追加」ワンタップボタン（ハートアイコン or スター）
- [ ] shortlist ページの空ステートに具体的な手順説明
- [ ] 式場詳細からショートリストへの導線追加

### 1.5.7 評価UX改善
- [ ] 「口コミ」ラベルを「総合印象」に変更（意味を明確化）
- [ ] 評価の自動保存（デバウンス付き、アプリ閉じても消えない）
- [ ] 各次元に1行ヘルプテキスト追加（「見学時の雰囲気やチャペルの印象」等）
- [ ] プログレスバーをクリック可能に（完了済みステップへの遷移）

---

## Phase 2 — Partner & Estimate Intelligence

**Goal:** パートナーとの共同利用を可能にし、見積もり分析で「費用の見える化」を実現。

### 2.1 パートナー招待・共有
- [ ] `src/server/actions/invitations.ts` 作成
- [ ] ダッシュボードに「パートナーを招待」ボタン
- [ ] メール招待 → 招待受諾フロー
- [ ] Supabase Realtimeでリアルタイム同期
- [ ] パートナーの評価を並列表示（差分ハイライト）
- [ ] 評価の不一致時にコメント入力を促す

### 2.2 見積もりPDF解析（Claude API）
- [ ] `ANTHROPIC_API_KEY` 設定
- [ ] PDF アップロード → Supabase Storage保存
- [ ] Claude APIでPDFテキスト抽出 → 項目分類
- [ ] 見積もりウォーターフォールチャート（初期→予測最終額）
- [ ] 「準備として」のトーンで増額予測を表示
- [ ] バックグラウンドジョブ（Supabase Edge Functions）で重い処理を非同期化

### 2.3 見積もり比較の強化
- [ ] 比較マトリクスに見積もり詳細行（衣裳、料理、写真等のカテゴリ別）
- [ ] 見積もり総額の棒グラフ比較
- [ ] 「他のカップルの平均」との比較表示

---

## Phase 3 — AI Intelligence & Review Analysis

**Goal:** URL貼り付けで式場情報を自動取得し、口コミをAIで分析。

### 3.1 URL自動取得
- [ ] 式場追加フォームにURL入力欄追加
- [ ] Python script（BeautifulSoup）でページ解析
- [ ] Claude APIで構造化データ抽出（名前、場所、収容人数、特徴）
- [ ] 取得中のローディングUI（スケルトン + 進捗表示）

### 3.2 口コミAI分析
- [ ] レビューソースURLの入力UI
- [ ] Claude APIで口コミ要約生成（原文は保存しない）
- [ ] 次元別センチメント分析（強み・懸念・キーポイント）
- [ ] 式場詳細ページにAI分析カード表示（ゴールド左ボーダー）
- [ ] ソース帰属表示（「N件の口コミからの分析」）

### 3.3 AI比較分析
- [ ] 比較ボードにインラインAI分析カード
- [ ] カップルの条件（予算・人数）を考慮した分析
- [ ] 具体的なアクション提案（「見積もりを人気コースで再取得を推奨」等）

---

## Phase 4 — Visit Experience

**Goal:** 見学の準備・記録・振り返りをアプリ内で完結。

### 4.1 見学スケジュール管理
- [ ] 見学予定の登録（日時、式場、フェアタイプ）
- [ ] カレンダー表示
- [ ] リマインダー（見学前日、見学後3日で記録促進）

### 4.2 見学チェックリスト
- [ ] AI生成チェックリスト（式場の口コミ懸念点ベース、最大5項目）
- [ ] モバイルでワンタップチェック

### 4.3 見学メモ・写真
- [ ] テキストメモ入力（見学先で素早く）
- [ ] 写真アップロード（Supabase Storage）
- [ ] GPS + タイムスタンプ自動付与
- [ ] 式場詳細ページの「見学メモ」タブに表示

### 4.4 音声メモ（ストレッチ）
- [ ] 音声録音 → Supabase Storage保存
- [ ] Claude APIで文字起こし（将来対応）

---

## Phase 5 — Polish & Delight

**Goal:** プロダクトとしての完成度を上げ、BtoC公開に耐えるクオリティに。

### 5.1 決定セレモニー
- [ ] 最終決定時のコンフェッティアニメーション（canvas-confetti）
- [ ] 決定カードのリッチデザイン（式場写真、比較経緯サマリー）
- [ ] 「最後まで迷った式場」と「決め手」を構造化して記録
- [ ] SNSシェア用OGP画像生成

### 5.2 オンボーディング
- [ ] 初回ログイン時のウェルカム画面（「おめでとうございます、式場探しのはじまりですね」）
- [ ] ステップバイステップのガイドツアー（3画面程度）
- [ ] プロジェクト名のカスタマイズ

### 5.3 ダークモード
- [ ] トグルUI追加（ヘッダーに月/太陽アイコン）
- [ ] CSS変数は既に定義済み、切り替えロジックのみ

### 5.4 PWA
- [ ] next-pwa またはService Worker手動設定
- [ ] オフライン時のフォールバック画面
- [ ] インストールプロンプト
- [ ] IndexedDB（Dexie.js）でオフラインメモ保存 → オンライン復帰時に同期

### 5.5 モバイルスワイプ比較
- [ ] Tinder風カードスワイプUI
- [ ] 「気になる / 保留 / スキップ」のジェスチャー操作
- [ ] 初期スクリーニング用（5件以上登録時に提案）

### 5.6 通知・リマインダー
- [ ] 行動トリガー型通知（「見学から3日経ちました」）
- [ ] 頻度モード選択（カーム / 通常 / アクティブ）
- [ ] メール通知（Supabase Edge Functions + Resend）

---

## Phase 間の依存関係

```
Phase 1.5 (UX Foundation) ← 必須、他の全Phaseの前提
    ↓
Phase 2 (Partner & Estimates) ← パートナー共有は早期に必要
    ↓
Phase 3 (AI Intelligence) ← Claude API活用、Phase 2のEstimate基盤の上に構築
    ↓
Phase 4 (Visit Experience) ← 独立性高い、Phase 2-3と並行可能
    ↓
Phase 5 (Polish & Delight) ← 全機能揃った後の仕上げ
```

## 優先度の根拠

| Phase | 根拠 |
|-------|------|
| **1.5** | 5つのレビュー全てでCRITICAL指摘。現状では「使える」レベルに達していない |
| **2** | Bride Walkthroughで「パートナー共有がない = コアバリュー未達成」、見積もり比較が「—」は最大の機能欠落 |
| **3** | Competitor Researchで「手動入力の繰り返しは離脱要因」、AI自動取得で差別化 |
| **4** | 見学体験は独立性が高く、Phase 2-3の基盤があると更に効果的 |
| **5** | BtoC公開に向けた仕上げ。決定セレモニーはBride視点で「感情的価値」の要 |

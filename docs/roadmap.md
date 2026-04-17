# VenueLens — 統合ロードマップ

> 旧 Phase 1-5 と v2 Phase A-D を一つのリリース計画に統合。
> すべてのデザイン・技術設計書のマスターインデックス。

---

## 参照ドキュメント

| ドキュメント | 内容 | 状態 |
|------------|------|------|
| [DESIGN.md](../DESIGN.md) | デザインシステム（Single Source of Truth） | ✅ 運用中 |
| [非機能要件書](superpowers/specs/2026-04-13-nonfunctional-requirements.md) | パフォーマンス予算、タッチ応答性、ネットワーク耐性、バンドル管理、監視 | ✅ 運用中 |
| [CLAUDE.md](../CLAUDE.md) | プロジェクト設定・実装ルール | ✅ 運用中 |
| [docs/archive/](archive/) | 過去 Release 技術仕様・v2 UI 仕様など歴史資料 | 参照のみ |

---

## 前提

- Phase 1 (MVP) は実装済み: 式場追加、星評価、比較マトリクス、ショートリスト、最終決定、認証
- v2 は UI/UX の全面刷新 + 旧 Phase 1.5-5 の機能を段階的に統合
- 技術スタック: Next.js 16 + Prisma + Supabase + Claude API (Release 1: URL式場追加のみ、Release 2以降: 全AI機能)

---

## 旧→新 マッピング表

| 旧Phase | 項目 | v2 Release | 備考 |
|---------|------|-----------|------|
| **1 (MVP)** | 条件設定 | R1 | AI onboarding に吸収。conditions ページ廃止 |
| 1 | 手動式場追加 | R1 | v2 AddVenueSheet に移植 |
| 1 | 星評価（6次元） | R1 | v2 StarRatingInput（auto-save、48px、感情ラベル） |
| 1 | 比較マトリクス | R1 | v2 ComparisonBoard（QuickLook + DimensionBar + DiffToggle） |
| 1 | レーダーチャート | R1 | 副次的UI（折りたたみ内）。プログレスバーが主要 |
| 1 | ショートリスト | R1 | v2 Candidates タブに統合。VenueFavorite テーブル新設 |
| 1 | 最終決定 | R1 | v2 Decision Ceremony（3フェーズ: confetti + サマリ + 理由記録） |
| 1 | 認証（Email） | R1 | 維持。リダイレクトロジック更新 |
| **1.5** | タッチターゲット44px | R1 | v2 DESIGN.md で構造的解決 |
| 1.5 | iOS SafeArea | R1 | v2 BottomNav に組み込み |
| 1.5 | エラーバウンダリ | R1 | 各ルートに error.tsx 配置 |
| 1.5 | Sonner トースト | R1 | 維持 |
| 1.5 | 認証ヘルパー統一 | R1 | 実装済み。維持 |
| 1.5 | 見積もり手動入力 | R1 | v2 VenueDetail の EstimateSection に統合 |
| 1.5 | ショートリスト導線改善 | R1 | v2 VenueCard ハートアイコン |
| 1.5 | 評価UX改善（ラベル、auto-save） | R1 | v2 StarRatingInput |
| 1.5 | Progress bar クリック | R1 | 廃止（6ステップバー自体を削除） |
| 1.5 | DBインデックス追加 | R1 | v2 マイグレーションに含む |
| **2** | パートナー招待フロー | R1 (Level 1) | Guest View リアクション（アカウント不要）のみ |
| 2 | パートナー評価並列表示 | R1 (UI) + R3 (Realtime) | UI枠はR1。Realtime同期はR3 |
| 2 | 見積もりPDF解析（Claude） | R2 | Claude API 接続が必要 |
| 2 | 見積もりウォーターフォール | R1 (UI) + R2 (AI値) | チャートUIはR1。AI予測値はR2 |
| 2 | バックグラウンドジョブ | R2 | 重いAI処理のキュー化 |
| **3** | URL自動抽出（Claude） | R1 | Claude API使用（R1唯一のAI例外。初回体験の入口として前倒し） |
| 3 | 口コミAI分析 | R2 | Claude API |
| 3 | AI比較分析（インライン） | R2 | Claude API。R1はテンプレート文 |
| **4** | 見学スケジュール | R3 | Visit モデルは既存。UIを新規作成 |
| 4 | AI生成チェックリスト | R3 | Claude API (R2基盤を利用) |
| 4 | モバイルクイックキャプチャ | R3 | 写真/メモ/GPS |
| 4 | 見学リマインダー | R3 | 行動トリガー型 |
| **5** | 決定セレモニー | R1 | v2 spec に含まれている |
| 5 | オンボーディング | R1 | v2 AI対話オンボーディング（R1: 条件保存のみ、AI推薦はR2） |
| 5 | ダークモード | R4 | CSS変数準備はR1で |
| 5 | PWA/オフライン | R4 | |
| 5 | スワイプ比較 | R4 | |
| 5 | 通知システム | R4 | |

---

## Release 1: UI Foundation + Core Features

### ゴール
v2 UIへの全面移行。既存Phase 1機能を新4タブ構成で再実装。Phase 1.5のUX問題を構造的に解決。

### ユーザーが使える状態

**ナビゲーション**:
- 4タブ: ホーム / 探す / 候補 / コーチ
- AI対話オンボーディング（初回のみ、3-4問で好み把握→条件保存）

**式場管理**:
- URL貼り付けによる式場自動登録（ゼクシィ、ハナユメ、Wedding Park等のURL対応）
- 手動で式場追加（AddVenueSheet）
- 写真ファーストの式場カード（4:3カルーセル、ハートお気に入り、ステータスバッジ）
- フィルタチップ（エリア/人数/予算/スタイル）
- 6次元星評価（auto-save、感情ラベル、48px）

**お気に入り/比較/決定**:
- VenueFavoriteテーブルによるパートナー独立お気に入り
- 「自分のみ」「パートナーのみ」「二人とも」の3ビュー切替
- 比較ボード（QuickLook + DimensionBar + DiffToggle + テンプレートAIインサイト）
- 最終決定セレモニー（confetti + 旅路サマリ + タグチップ理由記録）

**パートナー**:
- Level 1: LINEリンク共有 → ゲストモードで3ボタンリアクション（👍/🤔/👎）
- 招待ステータス表示（送信済み→閲覧済み→リアクション済み→参加済み）
- パートナー評価比較ビュー（UI枠。Realtime同期はR3）

**AIコーチ**:
- インサイトカードフィード（ルールベーストリガー、テンプレート文）
- チャットバー＋定型FAQ応答（5-10パターン）
- 見積もりX線UI（統計的ルールによるupgrade rate算出）

**見積もり**:
- 手動入力 + ウォーターフォールチャートUI
- 見積もりX線（統計的upgrade rateテーブルベース。R2でClaude精緻化）
- バージョン管理（初期→再見積もり）

### AI境界（Release 1）

| 機能 | Release 1 | Release 2で有効化 |
|------|----------|------------------|
| コーチチャット | 定型FAQ 5-10パターン | Claude API自由対話 |
| インサイトカード | ルールベーストリガー + テンプレート文 | Claudeパーソナライズ文 |
| 見積もりX線 | upgrade rateテーブル（統計的） | Claude PDF解析 + 精緻予測 |
| 比較分析 | テンプレート文（差分サマリ） | Claude自然言語分析 |
| URL式場追加 | Claude API使用（例外） | — （R1で実装済み） |
| 口コミAI要約 | 未実装（非表示） | Claude要約生成 |
| オンボーディングAI推薦 | 条件保存のみ | Claudeベース推薦 |

### 実装戦略

Phase A（Foundation, 順次）→ Phase B（4 worktree並列）→ Phase C（4 worktree並列）→ Phase D（統合）
詳細は [Release 1 技術設計書](../docs/archive/2026-04-13-release1-technical-spec.md) 参照（archive）。

---

## Release 2: AI Intelligence

### ゴール
Claude API接続で全AI機能を有効化。Release 1のプレースホルダーを実機能に置換。

### ユーザーが使える状態
- コーチチャット: 自由質問 → Claude応答（式場相談、見積もりアドバイス等）
- 見積もりPDF解析: アップロード → Claude抽出 → 精緻なpredictedFinal
- URL式場追加: R1で実装済み（R1唯一のClaude API使用機能）
- 口コミAI要約: ソースURL → Claude分析 → 次元別センチメント
- AI比較分析: 比較ボードのインラインカード（自然言語トレードオフ分析）
- オンボーディングAI推薦: 条件ベースで式場提案

### 技術要件
- `ANTHROPIC_API_KEY` 環境変数設定
- Vercel Pro (60s function timeout)
- 重い処理のバックグラウンドジョブ化（Supabase Edge Functions or pg_cron）
- `AiAnalysisType` に `coach_chat` 追加（enum追加はR1で先行済み）
- input_hash による重複排除

### スキーマ変更
- R1で先行追加した`coach_chat` enumを使用開始
- `Review` テーブルの活用開始（AI要約保存）

---

## Release 3: Visit & Full Partner

### ゴール
見学体験のデジタル化とパートナー機能の完成。

### ユーザーが使える状態
- 見学スケジュール管理（カレンダービュー）
- AI生成チェックリスト（式場別、最大5項目）— R2のClaude基盤を利用
- 見学時クイックキャプチャ（写真、メモ、GPS+タイムスタンプ自動付与）
- パートナー Level 2: 星評価（6次元）+ 一言コメント
- パートナー Level 3: フルアプリ（全機能アクセス）
- Supabase Realtimeによるパートナー間リアルタイム同期
- 二人の評価比較ビュー（不一致ハイライト + AIコメント）
- 見学リマインダー（「見学から3日経ちました。印象を記録しませんか？」）

### スキーマ変更
- 既存Visit/VisitNote/VisitRatingモデルはそのまま利用
- UI対応のみ（新規モデル不要）

---

## Release 4: Polish & Scale

### ゴール
全機能揃った後の仕上げと商用化準備。

### ユーザーが使える状態
- ダークモード（CSS変数切替、R1で準備済み）
- PWA + オフライン（IndexedDB / Dexie.js、ServiceWorker）
- スワイプ比較（Tinder風、5式場以上向け）
- 通知システム（頻度モード選択: おまかせ / 控えめ / オフ）
- AIコスト最適化（キャッシュ戦略、input_hash活用、レスポンスキャッシュ）
- SNSシェア用OGP画像生成（決定セレモニーのシェアカード）
- Google OAuth追加
- パフォーマンス最適化（バーチャルスクロール、画像最適化）

---

## Release間 依存関係

```
Release 1 (UI Foundation + Core)
│  ・Claude API: URL式場追加のみ使用（唯一の例外）
│  ・それ以外はルールベースAI + 定型FAQ
│  ・パートナーLevel 1（ゲストリアクション）
│
├──→ Release 2 (AI Intelligence)
│    ・Claude API全接続
│    ・R1プレースホルダー → 実機能化
│    ・PDF解析、口コミ分析、コーチチャット（URL抽出はR1で実装済み）
│
├──→ Release 3 (Visit & Full Partner)  ← R2と並行可能
│    ・見学UI新規（Visitモデルは既存）
│    ・パートナーLevel 2-3 + Realtime
│    ・R2のClaude基盤を見学チェックリストで利用
│
└──→ Release 4 (Polish & Scale)
     ・全機能揃った後の仕上げ
     ・ダークモード、PWA、コスト最適化
```

---

## タイムライン目安

| Release | 期間 | 前提 |
|---------|------|------|
| R1 | 2-3週間 | Phase A-D worktree並列 |
| R2 | 1-2週間 | Claude API key設定済み |
| R3 | 1-2週間 | R2と並行可能 |
| R4 | 1-2週間 | 全機能安定後 |

# Haretoki ステータスダッシュボード

**機能・非機能・UX** の 3 軸で、**達成状況** を一望する単一表。ここを開けば今どこまで出来ていて何が残っているか分かる。

最終更新: 2026-04-15

凡例: ✅ 完了 / 🟢 実装済（要磨き） / 🟡 部分実装 / 🔴 未着手 / ⬛ スコープ外

---

## 1. 機能ステータス

### コア動線

| 機能 | 状態 | 備考 | Sprint 対応 |
|---|---|---|---|
| Email 認証（サインアップ・ログイン） | ✅ | Supabase Auth | — |
| オンボーディング（3-4問 AI 対話） | 🟡 | 条件保存のみ、推薦はテンプレ | Sprint 4 |
| ホーム（HeroNba + RecentVenues） | 🟢 | デザイン要刷新 (F-14/F-21) | Sprint 2 |
| 式場追加（URL 自動抽出） | 🟢 | Zexy は 403 で不可（B-06） | Later |
| 式場追加（手動フォーム） | 🟢 | Sheet デザイン要刷新 (F-01) | Sprint 2 |
| 式場カード（写真+情報） | 🟢 | 星位置被り (F-02) | Sprint 2 |
| 式場詳細（全 Section） | 🟢 | 動線改善 (V-2 sticky tabs 実装済) | — |
| 6 次元星評価（0.5 刻み） | 🟢 | 修正済、実機検証待ち (F-26) | Sprint 1 検証 |
| 見積もり手動入力 | 🟢 | Combobox の閉じ問題修正 (F-27) | Sprint 1 検証 |
| 見積もりウォーターフォール | 🟢 | ±σ 信頼区間付き | — |
| 候補（VenueFavorite） | 🟢 | — | — |
| 比較マトリクス（/compare） | 🟢 | 王冠/観点1位デザイン要 (F-04/F-05) | Sprint 2 |
| チェックリスト設定（/checklist） | 🟡 | UX 動線不足 (F-19/F-20/WG-01/02) | Sprint 3 |
| 横比較チェックリスト | 🟢 | 観点フィルタなし (F-07/WG-03) | Sprint 3 |
| 決定セレモニー + confetti | 🟢 | デザイン要刷新 (F-10) | Sprint 2 |
| 決定取消 | ✅ | 直近追加 (F-11 Closed) | — |
| パートナー招待 | ✅ | Email 招待、accept-invite フロー | — |
| パートナー Level 1 リアクション | ✅ | 👍/🤔/👎 | — |
| アカウント削除 | ✅ | Supabase Admin SDK 含む | — |

### AI 機能

| 機能 | 状態 | 備考 | Sprint 対応 |
|---|---|---|---|
| URL 解析（Claude） | ✅ | R1 唯一の AI 本格活用 | — |
| コーチ ストリーミング SSE | 🟢 | ペルソナ強化済（F-23 実機検証待ち） | Sprint 1 検証 |
| コーチ セッション履歴 | ✅ | ChatGPT 方式 | — |
| AI インサイトカード | 🟡 | ルールベース（Claude 未接続） | Sprint 4 |
| AI 比較分析 | 🟡 | テンプレ文 | Sprint 4 |
| オンボーディング AI 推薦 | 🟡 | テンプレ | Sprint 4 |
| 見積もり PDF 解析 | 🔴 | 未着手、R2 本命 | Sprint 4 |
| 口コミ AI 要約 | 🟡 | 骨組だけ（WG-10） | Sprint 4 |
| ネガ口コミ優先モード | ✅ | Sort chip | — |
| ポジネガ比率バー | ✅ | — | — |

### 補助機能

| 機能 | 状態 | 備考 | Sprint 対応 |
|---|---|---|---|
| デモモード (/demo) | ✅ | 未認証体験 | — |
| 設定（プロフィール・通知） | 🟡 | 通知は DB のみ、UI 未 | Release 4 |
| マイページ | 🟢 | — | — |
| ダークモード | 🔴 | CSS 変数準備のみ | Sprint 5 |
| PWA / オフライン | 🔴 | 未着手 | Release 4 |
| Google OAuth | 🔴 | 未着手 | Release 4 |
| 見学スケジュール UI | 🟡 | DB モデル完成、UI 未 | Release 3 |
| 見学チェックリスト | 🟢 | AI 生成なし | Release 3 |
| 訪問時評価 | 🟢 | — | — |
| パートナー Level 2-3 | 🔴 | 未着手 | Release 3 |
| Realtime 同期 | 🔴 | 未着手 | Release 3 |

---

## 2. 非機能要件ステータス

参照: [`superpowers/specs/2026-04-13-nonfunctional-requirements.md`](./superpowers/specs/2026-04-13-nonfunctional-requirements.md)

### パフォーマンス予算

| 指標 | 予算 | 現状（推定） | 実測 | 状態 |
|---|---|---|---|---|
| LCP (mobile p75) | < 1.8s | Phase 1 後 ~1.5-2.0s | **未計測** | Sprint 1 で実測 |
| INP | < 200ms | 現状 200-300ms | 未計測 | Sprint 1 |
| CLS | < 0.1 | 現状 ~0.08 | 未計測 | Sprint 1 |
| TTI | < 3.0s | 現状 ~2.5-3.0s | 未計測 | Sprint 1 |
| Server Action p95 | < 500ms | Phase 1 で -100-300ms | 未計測 | Sprint 1 |
| タッチ応答 | < 150ms | active:scale 系 150ms 厳守 | 🟢 | — |
| タブ切替 p75 | < 500ms | Phase 1 で改善、実測待ち | 未計測 | Sprint 1 |

### バンドル管理

| 項目 | 予算（gzip） | 現状 | 状態 |
|---|---|---|---|
| HTML | < 60KB | 不明（測定必要） | Sprint 1 |
| First Load JS（主要ルート） | < 200KB | recharts / framer lazy 済 | 🟢 |
| CSS | < 30KB | 不明 | Sprint 1 |
| 画像（個別） | < 100KB | Supabase 配信、サイズ指定 | 🟢 |
| optimizePackageImports | 有効 | lucide-react / framer-motion 対象 | ✅ |

### 信頼性・耐障害

| 項目 | 目標 | 現状 | 状態 |
|---|---|---|---|
| error.tsx / global-error.tsx | 全階層 | 配置済 | ✅ |
| Sentry 連携 | 全エラー捕捉 | 設定済 | ✅ |
| オフライン時のフォールバック | 主要動線で `offline-banner` | 🟡 部分 | Release 4 |
| Server Action 冪等性 | 同一データで 2 回保存 OK | 一部 | 徐々に |
| Vercel 停止時の挙動 | — | 未設計 | Later |

### セキュリティ

| 項目 | 状態 | 備考 |
|---|---|---|
| Supabase RLS | ✅ | テーブル別有効 |
| Server Action 認可（requireUser 等） | ✅ | React.cache 化 |
| クロスプロジェクトアクセス防止 | ✅ | `requireVenueAccess` |
| パスワードハッシュ | ✅ | Supabase Auth 管理 |
| CSRF（Server Action） | ✅ | Next.js デフォルト |
| 個人情報マスキング（プロンプト） | ✅ | `stripPII` 実装 |
| ログに PII 含めない | ✅ | Sentry context に ID のみ |
| 環境変数秘密 | ✅ | .env.local + Vercel env |
| スクレイピング法務 | 🟡 | Zexy 等の規約確認が必要 | Sprint 5 |

### アクセシビリティ

| 項目 | 目標 | 状態 |
|---|---|---|
| タッチターゲット 44px | 全 CTA | ✅ |
| コントラスト WCAG AA | 全テキスト | 🟢 未計測 |
| aria-label 全フォーム | 全 input | ✅ |
| skip link | main-content | ✅ |
| キーボード操作（スライダー等） | 全対応 | 🟢 |
| prefers-reduced-motion | 尊重 | 🟡 部分 |
| ルビ（難読漢字） | — | Later |

### 計測 / 観測

| 項目 | 状態 |
|---|---|
| Vercel Analytics | ✅ 導入済 |
| Vercel Speed Insights | ✅ |
| Sentry | ✅ |
| PostHog | ✅ 導入済、イベント設計不足 |
| 週次レポート運用 | 🔴 未運用 |

---

## 3. UX ステータス

### 画面別 UX 評価（妻体験ベース）

| 画面 | 機能性 | 情報密度 | ビジュアル | 動線 | 総合 |
|---|---|---|---|---|---|
| ランディング | 🟢 | 🟢 | 🟢 | 🟢 | A |
| サインアップ・ログイン | ✅ | ✅ | 🟢 | ✅ | A |
| オンボーディング | 🟢 | 🟡 | 🟢 | 🟡 | B |
| ホーム | 🟡 | 🔴（白枠無駄） | 🔴（ダサい） | 🟡 | **C** |
| 探す | 🟢 | 🟡 | 🟡（FAB 位置改善済） | 🟡（AI 推薦巨大） | **B-** |
| 式場追加 Sheet | 🟢 | 🔴（見出し巨大） | 🔴 | 🟡 | **C+** |
| 式場詳細 | 🟢 | 🟢 | 🟡 | 🟢 | B+ |
| 評価スライダー | 🟢 | 🟢（数字改善済） | 🟡 | 🟢 | B+ |
| 候補一覧 | 🟢 | 🟡 | 🟡 | 🟡 | B |
| 比較マトリクス | 🟢 | 🟡 | 🔴（王冠/観点1位） | 🟡 | **C+** |
| 決定セレモニー | 🟢 | 🟢 | 🔴（しょぼい） | 🟢 | **C+** |
| コーチ | 🟡（AI テンプレ疑惑） | 🟢 | 🔴（Plus/履歴目立たない） | 🟢 | **C** |
| チェックリスト設定 | 🟢 | 🟡 | 🟡 | 🔴（反映先不明） | **C** |
| マイページ | 🟢 | 🟢 | 🟢 | 🟢 | B+ |

### UX 原則充足状況

| 原則 | 状態 |
|---|---|
| モバイル 375px 基準 | ✅ |
| 44px タッチ | ✅ |
| 即時フィードバック (active:scale) | ✅ |
| SafeArea（固定要素） | ✅ |
| 細字見出し（明朝） | ✅ |
| tabular-nums（数値） | ✅ |
| 空状態には CTA | 🟢 |
| エラー状態には復帰導線 | 🟡 |
| ローディングには skeleton | 🟢 |
| マイクロコピー（提案形） | 🟢 |
| 全体のビジュアル刷新（v4.1 Atmospheric） | 🟡 実装進行中 |
| アプリ内モーション（Apple 風遷移） | 🔴 未（ランディングのみ） |
| 全コピー素敵化 | 🔴 未 |

### コピートーン充足

| 領域 | 状態 | メモ |
|---|---|---|
| ボタン動詞（比べる・入れる・決める） | 🟢 | Phase 2 Tier 1 で統一 |
| ガイダンス文（提案形） | 🟢 | — |
| エラー文（具体・復帰導線付き） | 🟡 | Toast 改善済 |
| 「プロジェクト」「タスク」「編集」などの業務ワード | 🔴 | Sprint 5 で全面置換 |
| 絵文字ポリシー（使わない） | ✅ |  |

---

## 4. Release 到達度

| Release | DoD 充足率 | ブロッカー |
|---|---|---|
| **R1 UI Foundation** | **約 75%** | UX 刷新未完了（F-14/F-21/F-19/F-20/F-04/F-05/F-10）、Phase 1 実機計測未実施、AI コーチ検証未完了 |
| **R2 AI Intelligence** | 約 15% | Claude 本格接続（PDF / 要約 / 比較）未着手 |
| **R3 Visit & Partner L2-3** | 約 10% | UI 全て未着手（スキーマのみ） |
| **R4 Polish & Scale** | 約 5% | ダークモード / PWA / Google OAuth 未着手 |

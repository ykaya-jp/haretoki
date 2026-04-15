# 完了アーカイブ（解消済み課題・答え済み要望）

**実装済みの機能 / 対応済みの妻フィードバック / 解消済みのバグ** の履歴。現状の `bug-tracker.md` は **Open のみ**、ここには **恒久履歴** を残す。

日付の新しい順。

最終更新: 2026-04-15

---

## 2026-04-14 Phase 3 + 品質回復 hotfix

### 機能実装完了
- ✅ **横比較チェックリスト基盤**（妻要望 §0 北極星の骨格）
  - 6 カテゴリ × 90 プリセット項目
  - 3 画面: 項目選択 / 式場別入力 / 横比較マトリクス
  - DB migration + Server Actions
- ✅ **Atmospheric Layers v4.1** CSS トークン（gradient-dawn/noon/dusk, frosted glass, inner glow, gold hairline, halo tap）
- ✅ **Display Numerals** タイポグラフィ（明朝 + tabular-nums 大型）
- ✅ AIコーチ セッション履歴方式（ChatGPT 式）
- ✅ 式場詳細 Sticky Segmented Tabs + Scroll-spy（V-2）
- ✅ 見積もりプリセット Combobox 40 項目（V-3）
- ✅ 評価 0.5 刻み水平バー（V-5）
- ✅ 式場追加 Sheet を URL-primary 再編 + editorial + progressive skeleton
- ✅ W-3 ウォーターフォール ±σ 信頼区間
- ✅ W-4 候補比較 写真サムネ + lightbox
- ✅ W-5 複数ソース加重平均 composite score
- ✅ `docs/phase3-metrics.md` 計測テンプレ
- ✅ G-01 ReviewRatioBar 二重描画削除
- ✅ E-4 toast タップで即消し
- ✅ W-4 写真サムネ幅 + maxShow=2
- ✅ E2E flaky scenarios 安定化
- ✅ C-2 コーチ insight 3 日 throttle

### バグ解消
- ✅ B-01 候補「うまくいきませんでした」（ceremonyStyles 型修正）
- ✅ B-02 評価スライド保存失敗（incremental save）
- ✅ B-19 「ほかの式場と比べる」（B-01 連鎖）
- ✅ B-03 FAB 位置（HaloTap relative 緩和）
- ✅ B-07 コーチ Plus ボタン（router.replace + refresh）
- ✅ B-09 コーチ応答表示キャッシュ問題（revalidatePath）
- ✅ F-13 「準備を始める」→ /candidates に変更
- ✅ F-11 決定取消ボタン追加
- ✅ F-15 コーチ送信ボタン見切れ（min-w-0 + inline calc）
- ✅ F-16 コーチ AI 応答来ない（stream 0 chunks → fallback）
- ✅ venue 写真 HTTP 400（Unsplash remotePatterns）
- ✅ Decimal 警告（Number() 変換）
- ✅ アカウント削除時 Supabase Auth も削除
- ✅ 既存ユーザー招待受諾（空 auto-project 自動破棄）
- ✅ F-23 AI コーチペルソナ強化（ウェディングコーディネーター persona、10 年経験、具体数値）
- ✅ F-24「ほかの質問」（送信後 /coach?session=<id> へ遷移）
- ✅ F-26 評価スライダーの数字が常に読める（fill 頭に追従）
- ✅ F-27 Combobox 外タップで閉じる問題（pointer-down ハンドラ撤去、Escape のみ）

---

## 2026-04-14 Phase 2 Tier 1

### 機能実装完了（妻フィードバック問題#1-16 の UX 対応）
- ✅ ホーム JourneyCard/Steps 廃止 → JourneyRing + HeroNba（H-1/H-2/H-3）
- ✅ RecentVenues「すべて→」を /candidates?view=recent（H-5）
- ✅ 探す 追加ボタンを FAB に昇格（E-1）
- ✅ 探す ヘッダーコピー「式場を、見つける」（E-2）
- ✅ E-6 AI 推薦フォールバック editorial 化
- ✅ 式場詳細 dl グリッド統一（V-1）
- ✅ X-Ray 重複コピー削除（V-4）
- ✅ レビューソート 3 チップ（R-1）
- ✅ 持ち込み料金表 3 列テーブル（W-2）
- ✅ マイクロコピー §4 統一（比較する→比べる 等）
- ✅ 全内部 Link に prefetch=true
- ✅ カテゴリ別☆ソート（W-1）
- ✅ ポジ/ネガ比率バー（W-6）

---

## 2026-04-14 Phase 1 Perf（実機計測待ち）

### 実装完了
- ✅ P1-1 layout 直列 await → Suspense streaming
- ✅ P1-2 requireUser / requireProjectMembership を React.cache 化
- ✅ P1-3 /home 並列化 + /candidates 軽量化
- ✅ P1-4 getVenue 分割 + Suspense
- ✅ P1-5 bottom-nav CSS 化 + 全タブ prefetch（既に Phase 11 で完了）
- ✅ P1-6 cacheComponents + viewTransition + `"use cache"` + cacheTag + revalidateTag
- ✅ P1-7 optimizePackageImports + フォント絞り + Supabase 限定 remotePatterns
- ✅ nav-speed: layout の getOrCreateProject を非ブロック化、viewTransition 無効化、/coach /mypage 手動 prefetch

⚠️ **実機計測** は未実施（Sprint 1 で対応予定）

---

## 2026-04-14 Phase 0 緊急 hotfix

### 「うまくいきませんでした」系の元凶解消
- ✅ H0-1 本番 DB マイグレーション適用
- ✅ H0-2 Anthropic API Key / Vercel 環境変数整備
- ✅ H0-3 `getVenues` orderBy 防御
- ✅ H0-4 `requireProjectMembership` owner ループ対策
- ✅ H0-5 `saveDirectRatings` Visit create フィールド同期
- ✅ H0-6 URL 追加モーダル UX（setUrl リセット、toast 短縮）
- ✅ H0-7 「気になる点を先に」ラベル改善

---

## それ以前（初期ビルド）

- ✅ プロジェクト Scaffolding（Next.js 16 + Prisma + Supabase + Tailwind + shadcn/ui）
- ✅ データモデル完成（User / Project / Venue / Estimate / Visit / VenueFavorite / Decision / Review / AiAnalysis ほか）
- ✅ 4 タブナビ（ホーム / 探す / 候補 / コーチ）
- ✅ AI 対話オンボーディング（テンプレ推薦）
- ✅ 6 次元星評価 auto-save（初期）
- ✅ 比較ボード QuickLook + DimensionBar（初期）
- ✅ 最終決定 Decision Ceremony（confetti）
- ✅ パートナー Level 1 招待フロー
- ✅ デモモード `/demo` 未認証体験
- ✅ ランディングページ（stats / features / CTA）
- ✅ SEO 基本（metadata / robots / sitemap / manifest / OGP）
- ✅ Sentry + PostHog + Vercel Analytics + Speed Insights

---

## 運用ルール

- `bug-tracker.md` の Recently Closed で 1 cycle 経過したものを、ここへ日付ブロックで転記
- ここは履歴 → **削除しない**（PM / 引継ぎ資料として恒久）
- 月次で簡易サマリーを追加しても良い（"Month Review: X 件実装 / Y バグ解消 / Z UX 改善"）

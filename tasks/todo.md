# Phase 1B: デザインシステム刷新 + UX体験改善 + モーション完全実装

## 目標
1. カラーパレットを Morning Light (Cream/Rose/Gold) に全面変更
2. framer-motion アニメーションを全画面・全インタラクションに実装
3. 全てのボタン・UIの意味を視覚的に明確にする
4. ユーザー報告の機能的問題を全て修正
5. ページ遷移の体感速度改善
6. 全タッチターゲットを44px以上に統一

---

## A. 機能修正（壊れているもの）

- [ ] A1. ログアウト修正
  - LogoutButton: redirect()の代わりにwindow.location.hrefで/loginに遷移
  - src/components/settings/logout-button.tsx

- [ ] A2. 手動式場追加に写真アップロード機能
  - AddVenueSheetの手動タブにSupabase Storage写真アップロード追加
  - src/components/explore/add-venue-sheet.tsx

- [ ] A3. loading.tsx を新レイアウトに合わせて全ページ更新
  - home/loading.tsx: QuickActions→JourneyCard スケルトンに
  - 全8ファイルを確認・更新

---

## B. タッチターゲット + アフォーダンス修正

- [ ] B1. チャット送信ボタン: h-9 w-9 → h-11 w-11 + aria-label追加
  - src/components/coach/chat-bar.tsx

- [ ] B2. 写真カルーセルのドットインジケーター: h-1.5 w-1.5 → h-2 w-2 + hover効果
  - src/components/venues/photo-carousel.tsx

- [ ] B3. 写真カルーセルに前/次ボタン追加（スワイプだけだと気づかない）
  - src/components/venues/photo-carousel.tsx

- [ ] B4. HeartButton: 成功トースト追加 + タップ時scale bounce animation
  - 「候補に追加しました」/「候補から外しました」トースト
  - src/components/venues/heart-button.tsx

- [ ] B5. ホーム設定アイコンにテキストラベル「設定」を追加
  - src/app/(app)/home/page.tsx

- [ ] B6. 星評価にfieldset/legend追加（何を評価しているか明確に）
  - src/components/ratings/dimension-ratings.tsx

- [ ] B7. 見積もりフォーム: 成功トースト + フィールド別エラーメッセージ
  - src/components/venues/estimate-form.tsx

- [ ] B8. 全空ステートのコピーを温かく書き直す
  - explore: 「式場の下見は、ここから始まります」
  - candidates: 「いいね！と感じた式場を集めましょう」
  - coach: 既存OK
  - venue detail写真: 「写真なし」→「写真を追加しますか？」
  - venue detail口コミ: 空ステート追加
  - venue detail見学: 空ステート追加

---

## C. デザインシステム刷新

- [ ] C1. globals.css のCSS変数を Morning Light パレットに全面書き換え
  - 背景: oklch(0.97 0.01 80) #FBF7F1
  - 文字: oklch(0.22 0.02 50) #2A2320
  - Primary: oklch(0.62 0.12 45) #C4816E (Rose)
  - Accent: oklch(0.70 0.13 80) #C9A44C (Gold)
  - Border: oklch(0.91 0.02 70) #E8E0D6

- [ ] C2. DESIGN.md を新パレットに全面更新

- [ ] C3. ランディングページ: Navy→Cream背景 + 太陽光グラデーション
  - src/components/landing/landing-page.tsx

- [ ] C4. 認証画面(login/signup): Navy→Cream+Rose
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx

- [ ] C5. カード角丸統一: 全てrounded-2xlに
  - JourneyCard: rounded-xl → rounded-2xl
  - AIInsightCard: rounded-lg → rounded-2xl

- [ ] C6. Venue Headerにfont-serif追加

- [ ] C7. インラインbuttonをButtonコンポーネントに統一
  - candidates-view.tsx
  - decision-ceremony.tsx

---

## D. モーション・アニメーション（全画面）

### D1. ランディングページ
- [ ] Stats セクション: whileInView スタガードフェードイン
- [ ] Feature カード: whileInView スタガードフェードイン + active:scale-95
- [ ] AI Coach プレビュー: whileInView フェードイン

### D2. Explore画面
- [ ] 式場カードリスト: AnimatePresence + スタガードフェードイン (delay 0.05s)
- [ ] フィルタチップ: hover:bg-muted + active:scale-95

### D3. Candidates画面
- [ ] お気に入りリスト: AnimatePresence + layoutId + スタガード
- [ ] SegmentedControl: layoutIdでsliding indicator
- [ ] SwipeCard: 入場/退場アニメーション (spring physics)

### D4. Coach画面
- [ ] チャットバブル: 入場アニメーション (左/右からスライド + フェード)
- [ ] インサイトカード: フェードイン

### D5. VenueDetail画面
- [ ] セクション: whileInView フェードイン
- [ ] 見積もり折りたたみ: AnimatePresence + height transition
- [ ] 写真カルーセル: 入場フェード

### D6. BottomNav
- [ ] アクティブタブ: 微scale + 色遷移 150ms
- [ ] バッジ: 入場 scale bounce

### D7. グローバル
- [ ] prefers-reduced-motion: 全アニメーション無効化を確認
- [ ] transition duration統一: fast=150ms, base=300ms, slow=500ms

---

## E. 検証

- [ ] E1. TypeScript型チェック (npx tsc --noEmit)
- [ ] E2. ESLint (npm run lint)
- [ ] E3. ユニットテスト (npm test)
- [ ] E4. E2Eテスト (npx playwright test)
- [ ] E5. プロダクションビルド (npm run build)
- [ ] E6. セルフレビュー (code-reviewer)
- [ ] E7. スマホで全画面動作確認

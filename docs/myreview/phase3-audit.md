# Phase 3 Audit — UX / 信頼性 バックログ

最終更新: 2026-04-14
スコープ: Phase 2 完了後、実ユーザー(妻)テストと自主点検で検出された UX / 信頼性の課題を Phase 3 の実装対象として棚卸しする。

---

## バックログ

### CB-01 — /coach ChatBar 送信ボタンの見切れ疑い（検証済み・解消）

| 項目 | 内容 |
|------|------|
| 検出日 | 2026-04-14 |
| 報告源 | 内部レビュー（妻フィードバック由来） |
| 対象 | `src/components/coach/chat-bar.tsx`（fixed bottom bar） |
| 再現条件 | 375×812（iPhone 12 相当）/ 320×568（iPhone SE 第1世代）, `env(safe-area-inset-right)` が 0 でない状況 |
| 期待 | 円形 48×48px 送信ボタン (`aria-label="送信する"`) がビューポートに完全に収まり、タップ判定がクリップされない |
| 現状 | 既に暫定修正適用済み: fixed bar の横 padding を `pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]` に変更（`src/components/coach/chat-bar.tsx:180`） |

**検証方法（Playwright, Mobile Chrome プロジェクト）**

新規追加スペック: `tests/e2e/phase3-chatbar-audit.spec.ts`

- `/demo/coach` と認証済み `/coach` の両方を対象
- 375×812 / 320×568 の 2 ビューポート × 2 ルート = 4 ケース
- 認証フロー: Supabase admin API で擬似ユーザー作成 → Email/Password ログイン → `onboarding_completed` cookie 設定 → `/coach` へ遷移
- アサート: `boundingBox().x + width <= viewport.width`、`x >= 0`、ボタンが可視
- 結果: **4/4 PASS**
- スクリーンショット出力: `test-results/phase3-chatbar/`
  - `coach-iphone12-375x812.png`
  - `coach-iphonese1-320x568.png`
  - `demo-coach-iphone12-375x812.png`
  - `demo-coach-iphonese1-320x568.png`

**所見**

- 認証済み /coach（真の ChatBar, 円形 48×48）: 右端に適切な余白を確保。送信ボタンは 320px ビューポートでも完全に可視
- /demo/coach（ダミー disabled 入力, 44×44 送信アイコン）: こちらは別コンポーネント（`src/app/(demo)/demo/coach/page.tsx:59`）で、`px-5` 固定。safe-area 未対応だが、現時点のエミュレーションでは右端クリップは発生しない
- Chromium DevTools の safe-area エミュレーションは iOS Safari 実機とは厳密には一致しないため、実機（特に iPhone ランドスケープ時の notch 側）での目視確認は別途残す

**ステータス**: RESOLVED（暫定修正が Playwright 自動テストで確認済み）

**フォローアップ候補（Phase 3 以降）**

1. `/demo/coach` 側の fixed bar にも同様の safe-area 対応を適用して統一（LOW）
2. 実機（iPhone ランドスケープ + notch）での目視確認を Ship Cycle のチェック項目に追加（MEDIUM）
3. 新規の fixed bottom 要素を追加する際のガイドラインを `DESIGN.md` に追記（`pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]` パターン）

---

## 今後追記する項目

Phase 3 バックログはここに ID 連番で追加していく（CB-xx は ChatBar / Coach 系, NAV-xx はナビゲーション, PERF-xx はパフォーマンス 等で分類）。

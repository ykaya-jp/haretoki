# Track A: UI/UX Aesthetic Audit（審美総点検）

あなたは本 worktree (`/home/yusuke_kaya/projects/haretoki-wt-uiux`, branch: `audit/uiux-aesthetic`) で **plan mode** のまま作業する。

## ミッション

Haretoki（結婚式場比較アプリ、モバイル 375px ファースト）の全画面を審美観点で総点検し、`docs/myreview/uiux-aesthetic-audit.md` を書き切る。**実装はしない**。audit ドキュメントを書き上げたら ExitPlanMode で報告して終わる。

## 背景（必読）

- 実ユーザー（オーナーの妻）フィードバック: `docs/myreview/problems_02.md`
  - #11 画面変化が遅すぎてストレス（→ 別トラックで担当）
  - #12 式場カードの写真がデカすぎ
  - #13 全体的に UI/UX の審美性が低い。文字が急に無駄に小さい、要素バランスが他と揃っていない
- 既存デザインシステム: `DESIGN.md` v4.2 "Modern Luxury · Editorial Refresh"（5 画面刷新済み、残り 9 画面は未完）
- 既存計画: `docs/myreview/remediation-master-plan.md` との整合を取る
- 本トラック全体計画: `/home/yusuke_kaya/.claude/plans/opus4-7-uiux-linked-knuth.md` の **Track A** セクション

## 使うべきエージェント / ツール

- **product-designer** — リサーチと全体コンセプト統合（主導）
- **ui-ux-reviewer** — 審美の 6 段階スコアリング（画面別）
- **Refero MCP** — 競合プロダクト (The Knot / Zola / Hitched / Airbnb Experiences 等) から 5-10 画面ずつ引いて比較
- 画面カテゴリ 4 分割で **並列サブエージェント** を走らせる:
  - Sub-A1: ホーム / 探す / 候補
  - Sub-A2: コーチ / 会話 / オンボーディング
  - Sub-A3: 式場詳細 / 比較 / 決定
  - Sub-A4: チェックリスト / 見学記録 / マイページ / 設定 / notifications / accept-invite / landing

## 監査観点（13）

1. Typography scale の秩序（急に text-xs に落ちる違和感を全画面列挙）
2. 余白リズム（8/12/16/24/32/48 の厳密運用、半端値検出）
3. カラー使用の一貫性（gold-subtle/rose/sky accent の乱用・意味ずれ）
4. アイコンサイズ統一（16/20/24 以外の検出）
5. 重なり・衝突（problems_02 #5 系の再発チェック）
6. 要素バランス（カード写真比率 #12、CTA 重み、余白と情報の比）
7. モバイル 375px 情報密度 / fold 前後の切れ目
8. 明朝 × ゴシックの使い分け
9. tabular-nums 抜け
10. 空ステート / ローディング / エラー (P1 "空ステートは招待状")
11. マイクロインタラクション (active:scale, 150ms)
12. ダークモード対応の穴
13. Landing / 未ログイン画面の first touchpoint 品質

## 成果物: `docs/myreview/uiux-aesthetic-audit.md`

必須セクション:

1. **Executive Summary** — 全 14 画面の 6 段階総合評価 (5: ラグジュアリー → 0: 未実装) + 総合ストーリー
2. **画面別セクション × 14** — 各画面で:
   - 該当ファイルパス (`src/app/(app)/.../page.tsx` 等)
   - 6 段階 × 13 観点マトリクス
   - **Before → After の具体コード差分**（「text-xs → text-sm、h-4 w-4 → h-5 w-5、py-3 → py-4」粒度）
   - 競合参考画面 (Refero MCP 引用) 1-3 枚
   - 優先度 (P0: 崩壊 / P1: 違和感強 / P2: 磨き込み)
   - 工数 (S/M/L)
3. **横断改善（コンポーネント層）** — Button/Card/Sheet/ListItem 等で一気に直すもの
4. **DESIGN.md v4.3 追記提案** — 本 audit で明らかになったトークン/原則の追加候補

## 停止条件（ExitPlanMode 発動基準）

- audit .md が存在し、14 画面全てのセクションが埋まっている
- 各項目に before/after コード差分 + 優先度 + 工数が付いている
- 競合比較が最低 3 プロダクト含まれる
- 実装可能な粒度（抽象論 "バランスを良くする" で終わっていない）

## 絶対にしないこと

- 実装（`.tsx` への edit）— このトラックは調査・計画のみ
- main/develop へのコミット — 本 worktree 内の audit .md 追加に閉じる
- problems_02.md の #1-10 バグ修正（別トラック/別セッション担当）
- パフォーマンス領域（別ペイン Track B 担当）
- Branch 変更、push、デプロイ

---

**では plan mode のまま、上記に従って 4 サブエージェントを並列で起動し、audit ドキュメントを書き切ってください。**

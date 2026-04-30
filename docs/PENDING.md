# PENDING — 計画したが未実装のもの

過去の audit / plan / roadmap で**やる予定だが手を付けていない**項目を一覧化。
**やる / 後回し / 凍結 / 取り下げ** をユーザーが判断するための材料。

> 棚卸し日: 2026-04-30。新しく未実装計画が出るたび追記し、決まったら該当行を削除して `lessons.md` か該当 plan に書き直す。

## 凡例

- 🔴 **やるべき (推奨)**: 既に部分実装でドリフトしている / 影響大 / コストも明確
- 🟡 **判断保留**: 価値はあるが優先度低 / 別アプローチで代替可能
- 🟢 **凍結 (取り下げ候補)**: 状況が変わって不要になった可能性
- ⏳ **タイミング待ち**: ユーザー数 / 予算 / 海外展開などのマイルストーン依存

---

## A. Roadmap 由来 — 機能リリース

### A-1. Release 2: AI Intelligence 🟡
**出典**: [`roadmap.md`](roadmap.md) Release 2

Claude API を全機能に接続し、Release 1 のプレースホルダーを実機能化する。

- コーチチャット: 定型 FAQ → Claude 自由対話
- 見積もり PDF 解析: アップロード → Claude 抽出 → predictedFinal 精緻化
- 口コミ AI 要約: ソース URL → Claude 分析 → 次元別センチメント
- AI 比較分析: 比較ボードのインライン自然言語トレードオフ分析
- オンボーディング AI 推薦: 条件ベースの式場提案

**判断ポイント**:
- 既に `src/lib/prompts/{coach-chat, comparison, onboarding, review-summary, estimate-analysis}.ts` は存在（実コード書かれている）。actual に Server Action から呼ばれているか / placeholder のままかを確認すれば「半分実装済」かもしれない
- `ANTHROPIC_API_KEY` が本番設定済みなら、機能ごとに段階的に有効化できる
- 進めるなら 1-2 週間 (roadmap 当初見積もり)

### A-2. Release 3: Visit & Full Partner ⏳
**出典**: [`roadmap.md`](roadmap.md) Release 3

- 見学スケジュール (カレンダービュー)
- AI 生成チェックリスト (式場別、最大 5 項目) — Release 2 の Claude 基盤利用
- 見学時クイックキャプチャ (写真 / メモ / GPS+timestamp)
- パートナー Level 2 (星評価 6 次元) / Level 3 (フルアプリ)
- Supabase Realtime によるパートナー間リアルタイム同期
- 見学リマインダー（行動トリガー型）

**判断ポイント**:
- W15 で partner invite Level 1 (guest mode) は済 → Level 2-3 への引き上げは段階的に可能
- Visit / VisitNote / VisitRating モデルは既存 (UI のみ未実装)
- W15-F2 (見学 .ics export) で見学体験の入口が部分実装されている

### A-3. Release 4: Polish & Scale ⏳
**出典**: [`roadmap.md`](roadmap.md) Release 4

- ダークモード (CSS 変数切替、Release 1 で準備済)
- PWA + オフライン (IndexedDB / Dexie.js / ServiceWorker)
- スワイプ比較 (Tinder 風、5 式場以上向け)
- 通知システム (頻度モード: おまかせ / 控えめ / オフ)
- AI コスト最適化 (キャッシュ戦略、input_hash 活用)
- SNS シェア用 OGP 画像生成 (W15 で部分実装の可能性 — `feat(decision): OGP share image generation` のコミットあり)
- Google OAuth 追加
- パフォーマンス最適化 (バーチャルスクロール、画像最適化)

**判断ポイント**:
- 商用化前の polish 群。優先順位は本番リリースタイミングで決定

### A-4. i18n / 海外展開 ⏳
**出典**: [`archive/i18n-migration.md`](archive/i18n-migration.md)

EN / 多言語化計画。time に応じて archive から復活。

**判断ポイント**:
- 国内 PMF 確認後に検討。当面は凍結

---

## B. Harness & AI Docs 自動化 — Track C 由来

### B-1. Harness AI Maintenance Phase 2 (drift 自動検知) 🟡
**出典**: [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) Phase 2

- `PostToolUse` hook on `src/lib/prompts/**` → 対応する `docs/ai/prompts/*.md` に `stale: true` フロントマター付与
- `PostToolUse` hook on `src/lib/anthropic.ts` → `docs/ai/{guardrails,streaming}.md` を stale
- `SessionStart` hook → stale 件数を stderr で警告
- `Stop` hook → セッション終了時の drift サマリ
- `.claude/skills/sync-docs/SKILL.md` 新規 — git 差分から docs 更新提案
- `.claude/skills/record-decision/SKILL.md` 新規 — ADR 自動生成
- `.claude/scripts/{mark-docs-stale,docs-drift-check}.sh` 新規

**判断ポイント**:
- 既にグローバル ~/.claude/ 側で類似 hook (SessionStart plan-reminder, Stop worktree-warning) が動いている。これと統合 / 流用する形が良いかも
- 価値は中。手動更新でも回る規模 (実態として 1 人開発)
- 実装コストは半日〜1 日

### B-2. Harness AI Maintenance Phase 3 (docs-curator subagent) 🟢
**出典**: [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) Phase 3

`.claude/agents/docs-curator.md` 新規 — 週次 / PR 時に drift を検出し、更新 PR を起案する自律エージェント。

**判断ポイント**:
- 1 人開発では overkill。チーム拡大時に再評価
- 凍結扱いを推奨

### B-3. AI prompts md 化 (5 ファイル) 🟡
**出典**: [`docs/ai/prompts/README.md`](ai/prompts/README.md)

`src/lib/prompts/*.ts` のうち、md 仕様書がまだ無いもの:

- `onboarding.system.md` (NEW)
- `url-extraction.system.md` (NEW)
- `comparison.system.md` (NEW)
- `review-summary.system.md` (NEW)
- `estimate-analysis.system.md` (NEW)

**判断ポイント**:
- ts に inline コメントが充実していれば、md 化は documentation 目的のみ
- prompt 改善時のレビュー性が上がるが、 「コードレビューだけで十分」とも言える
- 実装コスト: 各 30 分 × 5 = 2.5 時間

### B-4. AI 関連 docs の追加 🟡
**出典**: [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) §2

- `docs/ai/streaming.md` (NEW) — SSE / AbortController / timeout の運用
- `docs/ai/tool-catalog.md` (NEW, Phase 3) — tool use 定義 (現状空)
- `docs/ai/evals.md` (NEW, Phase 3) — 回帰評価戦略

**判断ポイント**:
- streaming は既に `src/lib/anthropic.ts` の `streamClaude` に実装あり、md 化は documentation のみ
- tool-catalog / evals は機能未実装 → そもそも書くものが無い (Release 2 で着手判断)

### B-5. ADR (Architecture Decision Records) 🟢
**出典**: [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) §2

- `docs/harness/adr/0001-template.md` (NEW)
- ADR フォーマットの導入

**判断ポイント**:
- 1 人開発では overhead。チーム拡大時に再評価
- 現状 `docs/lessons.md` で代替できている

### B-6. MCP 運用 doc 🟡
**出典**: [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) §2

`.claude/mcp.md` (NEW) — context7 / vercel / refero の運用

**判断ポイント**:
- 既に `.claude/.mcp.json.example` がスケルトンとして存在 (今回の harness 監査で追加)
- 実 MCP を有効化するタイミングで書けば良い (チーム拡大 or DB 操作自動化が必要になったとき)

---

## C. Audit 起点の積み残し — Track A/B 由来

### C-1. UI/UX Audit 残対応 🟡
**出典**: [`myreview/audit-master-A.md`](myreview/audit-master-A.md) (決定版)

audit-master-A の Tier 別優先度に従い、editorial refresh の残 9 画面（5 画面は完了済）を進めるかどうか。

**判断ポイント**:
- 各 Tier の所要時間と、現状の "20 年前のデザイン" 印象の体感ギャップを照らす
- W15 系 sprint との並走で進められる項目を pick up

### C-2. Performance Audit 対応 🟡
**出典**: [`myreview/performance-audit.md`](myreview/performance-audit.md)

タップ→反応 150ms 以内、framer-motion 過剰アニメーション削減、`useOptimistic` / `useTransition` 導入余地、Server Action / Prisma N+1 修正など。

**判断ポイント**:
- problems_02 #11 「画面変化が遅すぎてストレス」が直接の起点
- audit 報告書を読み返し、Tier 1 修正だけ抜き出して着手するのが現実的

---

## D. その他 ハウスキーピング

### D-1. dependabot 残: postcss / uuid (transitive) 🟢
**出典**: 2026-04-30 セッションでの調査

- `postcss <8.5.10` (next の transitive)
- `uuid <14.0.0` (resend → svix の transitive)

**判断ポイント**:
- fix は Next.js / resend のメジャー更新が必要 → 別タスク
- 凍結扱いで OK。Next.js 16.x の patch リリースで postcss が上がれば自動解消

### D-2. develop → main マージ 🔴
**出典**: 2026-04-30 セッション末尾

- develop が main より 676 commit 先行
- マージすれば dependabot alerts 4 件が auto-close + 全 fix が本番反映

**判断ポイント**:
- 本番リリースのタイミング (商用化スケジュール) と紐づくので、ユーザー判断
- 大量コミットなのでリリースノートを起こしておくと後で楽

### D-3. main ブランチの dependabot 4 件 ⏳
**出典**: GitHub remote 通知

D-2 を実行すれば自動解消。

---

## 運用ルール

1. 新しい "計画したが未実装" 項目が出たら本ファイルに **必ず追加** する（即実行できないものを散在させない）
2. やると決まったら該当行を削除し、`docs/plans/YYYY-MM-DD-<topic>.md` を作成して `lessons.md` で背景を記録
3. やらないと決まったら該当行に **取り下げ理由** を 1 行加えて 🟢 マークに変更（履歴として残す）
4. 月次で見直し: `git log --since='1 month ago' -- docs/PENDING.md` で更新頻度を確認し、放置されている 🔴 項目があればチームで再判断

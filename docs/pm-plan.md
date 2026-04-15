# Haretoki PM プラン

**目的**: 次セッションで一投指示を投げたら、優先順に黙って走り切れる状態を作る。

最終更新: 2026-04-15

---

## 全体感（1枚絵）

```
[Sprint R 整備] ─ 今ここで完了
       ↓
[Sprint 1 リサーチ] Refero で 10 画面 + Impact×Effort 並べ替え
       ↓
[Sprint 2 デザイン刷新] ホーム / コーチ / 追加 Sheet / 比較 / 決定 の 5 画面を 1 batch
       ↓
[Sprint 3 チェックリスト UX + フィルタ] 妻要望の核を UX で消化
       ↓
[Sprint 4 R2 AI 本格化] Claude 自由対話 / 口コミ要約 / PDF 解析
       ↓
[Sprint 5 仕上げ + 計測] コピー素敵化 / モーション / ダークモード / LCP 計測
       ↓
[Sprint 6 R3+R4] Visit UI / Partner L2-3 / PWA / Google OAuth（別セッション）
```

---

## Sprint R（Retrospective & Restart）— 今セッション完了

### 目的
再開可能な状態まで PM 資産を整備する。コード変更 0。

### Doing
- [x] 6 ファイルを `docs/archive/` に移動
- [x] `docs/README.md` を Now/Next/Later 1 枚に
- [x] `docs/bug-tracker.md` を Impact×Effort で並べ替え
- [x] `docs/wife-requirements-gaps.md` 新設（妻要望の未対応分のみ抽出）
- [x] `docs/definition-of-done.md` 新設（R1-R4 の success criteria）
- [x] `docs/design-todo.md` 新設（不足デザイン資産一覧）
- [x] `docs/pm-plan.md`（本書）新設
- [x] `docs/next-session-prompt.md` 新設
- [x] `docs/gtm-draft.md` 新設（1 行ピッチ + ポジショニング + 課金モデル仮説）
- [x] `docs/status-dashboard.md` 新設（機能・非機能・UX 3 軸ステータス）
- [x] `docs/completed-archive.md` 新設（解消済み・答え済みの恒久履歴）

---

## Sprint 1 — リサーチ + 観察（実装 0、分析のみ）

### 目的
実装前に **何を作るべきか** を固める。fix→feedback→refix のループを 3 倍速にする。
**「今週の最小アクション」4 件を全てここで消化**する。

### Order
1. **妻 45 分観察セッション**（最優先。PM 的には実装 100 行よりこの 45 分のほうが効く）
   - 画面共有しながら使ってもらい、観察メモだけ取る（fix しない、提案もしない）
   - `docs/user-observations/YYYY-MM-DD-wife-session1.md` に保存
   - 動線ログ + 無言になった瞬間の記録 + 「次の一歩は？」と聞いて言語化してもらう
2. **観察ログをもとに bug-tracker を Impact × Effort で再ランク**
   - 各項目に Impact(H/M/L) × Effort(S/M/L) を付与
   - P1/P2/P3/P4 に並べ直し（既に雛形あり、観察で補正）
3. **Refero MCP で 10 画面リサーチ**（`refero-design` スキル必須）
   - 対象: ホーム / AI チャット / 式場カード / 比較マトリクス / 決定セレモニー / フィルタ画面 / チェックリスト UI
   - 競合: Zola / The Knot / Airbnb / Linear / ChatGPT mobile / Partiful / Aman
   - 出力: `docs/design-research.md`（スクショ ref + 方針抽出）
4. **Phase 1 実機計測 + Vercel Analytics 覗く**
   - Vercel Analytics / Speed Insights ダッシュボード確認
   - モバイル Lighthouse で LCP / INP / CLS 取得
   - `phase3-metrics.md` に **ベースライン値** を記録
5. **docs archive 実行** （既に完了、Sprint R で消化済なのでスキップ可）
   - `docs/archive/` への 6 ファイル移動は Sprint R 完了済
   - 追加アーカイブが必要なら実行

### Done 判定
- `docs/user-observations/…` に観察記録がある
- `docs/design-research.md` が存在し、Sprint 2 の各画面の方針が 1 段落で書いてある
- bug-tracker 上位 10 件が Priority 1-3 に並べ直されている
- Phase 1 ベースライン値が phase3-metrics.md に入っている

---

## Sprint 2 — デザイン刷新（5 画面 1 batch）

### 目的
妻が「ださい・スペース無駄」と言い続けているビジュアル問題を、**1 バッチで**終わらせる。

### Order（対象画面）
1. **ホーム** (F-14/F-21) — 白枠削除 + HeroNba リデザイン + Greeting 情報密度アップ
2. **コーチ** (F-17/F-18) — Plus・履歴アイコンを明示的な UI に（トップバー or chip）
3. **式場追加 Sheet** (F-01/B-12) — 見出しサイズ最適化、段階 BottomSheet 化
4. **比較 (比べる タブ)** (F-04/F-05/B-13) — 王冠/観点1位の再設計、縦長削減
5. **決定セレモニー** (F-10) — おめでとうの格上げ（OGP 生成含む）

### Branch
- `feat/sprint2-visual-batch` 1 本でまとめて（worktree 並列しない、一貫性重視）
- Refero 研究結果を事前に DESIGN.md v4.2 に追記してから着手

### Done 判定
- 妻が観察セッションで各画面を見て「これならいい」と言う
- `bug-tracker.md` から F-01/F-04/F-05/F-10/F-14/F-17/F-18/F-21/B-13 が Closed

---

## Sprint 3 — チェックリスト UX + フィルタ

### 目的
妻要望 §0 の核「カテゴリ×項目を任意設定して横比較」の**機能はあるのに使えない**問題を解消。

### Order
1. **チェックリスト動線改善** (F-19/F-20)
   - `/checklist` 初回入り方を明示（ツアー/空状態 CTA）
   - 設定結果が `/compare` と `/venues/[id]/checklist` に反映されている様子を見せる（件数バッジ等）
2. **観点フィルタ** (F-06/F-07/F-08)
   - 比較画面で「この観点だけ見る」セレクタ
   - 観点軸を現 6 軸 → ユーザー選択で可変化
3. **フィルタ追加**（妻要望 §「▼ソートかけたい項目」の未対応分）
   - ドレス持込料フィルタ（無料/有料/金額レンジ）
   - 支払い方法フィルタ（カード/現金/分割）
4. **プラン透明化** (妻要望 §「▼そのほか」)
   - ドレス 2 着 / 新郎分含有 の構造化 UI

### Done 判定
- 妻が「どの項目で絞って比較するか」を迷わず操作できる
- `bug-tracker.md` から F-06/F-07/F-08/F-19/F-20 が Closed

---

## Sprint 4 — R2 Claude AI 本格化

### 目的
R1 で URL 追加とコーチストリーム以外は "テンプレ" のままだった AI 機能を本命ユースケースに接続。

### Order
1. **コーチ自由対話の実機検証 + 改善**（F-23 フォロー）
   - 前セッションでペルソナ強化済、実機で複数質問 → 応答品質評価
   - 必要なら few-shot examples 追加、temperature 調整
2. **口コミ AI 要約** (妻要望 §「▼そのほか」最優先)
   - 既存 `Review.aiSummary` を Claude で生成するバッチ
   - ネガ優先モードと組み合わせ
3. **見積もり PDF 解析**（R2 本命）
   - Claude でアップロード PDF → 構造化 EstimateItem
4. **AI 比較分析**
   - 比較マトリクスに Claude 生成の自然言語 insight
5. **Vercel AI Gateway 経由に統一**（レート/モデル変動吸収）

### Done 判定
- 妻がコーチに 10 質問してテンプレ応答 1 回以下
- 実 URL の口コミページを AI が要約できる
- PDF 1 本で見積もりの 80% 以上が自動構造化される

---

## Sprint 5 — 仕上げ + 計測

### 目的
Release 1 を「完成品」として本番で語れる状態にする。

### Order
1. **コピー全面素敵化**（B-22 全体）
   - Refero で競合カップルアプリのコピーを研究 → 置換表を作ってから grep 置換
   - 「プロジェクト」「タスク」「比較する」「編集」等を除去
2. **モーション予算適用** (B-14)
   - タッチ応答 150ms / 遷移 600ms / リスト stagger のルール準拠
   - Apple.com 風の editorial 遷移モーションを入れる
3. **ダークモード本実装** (Phase 4 積み残し)
4. **Safari 戻る / 次へ系の挙動** (B-17/B-18)
5. **Phase 1 計測の最終レポート**
   - before/after を `phase3-metrics.md` に
6. **Sentry / PostHog ダッシュボード整備**

### Done 判定
- [definition-of-done.md](./definition-of-done.md) の R1 DoD 全項目 ✅
- NPS 的に妻が「これは良い」と言う

---

## Sprint 6 — R3+R4（別セッション以降）

- 見学 UI の本実装（Visit Schedule / Checklist / Note / Photo）
- Partner Level 2-3（双方が星評価・コメント・Realtime 同期）
- PWA + オフライン（IndexedDB / ServiceWorker）
- Google OAuth
- アルファユーザー 3 組招待

---

## 運営ルール

### Sprint 内での進め方
- Sprint 開始時に **Sprint XX 開始** とだけ投げれば、該当 Sprint の Order 通りに進行
- 各 Order 項目完了時に `docs/bug-tracker.md` で Closed に移動
- Ship Cycle（E2E → develop → prod → worktree 掃除）は Sprint 末尾で 1 回

### 止める基準
- Impact × Effort で Priority 4 以下に落ちた項目は着手しない（Later 送り）
- Sprint で予定していない項目の **スコープクリープ禁止**
- 妻からの新フィードバックは `bug-tracker.md` Open に追記するだけ、即対応しない（次 Sprint で優先度判定）

### コミュニケーション
- 進捗は各 Sprint 末尾に 1 段落で報告
- Deploy URL は毎回提示
- ブロッカーが出たら **方針 2 択まで絞って** 確認（「これで進めていい？」ではなく「A か B か」）

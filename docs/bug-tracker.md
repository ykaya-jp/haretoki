# Haretoki Bug / UX Tracker

**課題一元管理**。解消したら Closed に移動 → 次 push で削除。新規発見は Open に追加。

最終更新: 2026-04-15

---

## 優先度運用

- **P1** = H × S/M: Sprint 1-2 で必ず消化（妻体験のブロッカー）
- **P2** = H × L / M × S: Sprint 2-3
- **P3** = M × M: Sprint 3-4
- **P4** = L: Sprint 5+ or Later

凡例: Impact H(High)/M(Medium)/L(Low) × Effort S(Small)/M(Medium)/L(Large)

---

## Sprint 1 — 妻実機検証チェックリスト

Sprint 1 でコード修正 **ゼロ**だが、過去 Sprint で「実機未検証」になっている項目がいくつかある。妻が画面共有で開く 45 分観察セッション中に、以下を**その順**でタッチしてもらえば網羅できる。

### 必須確認（H rank, Sprint 1 実機検証）

| 順 | ID | 確認動作 | 期待結果 | 判定 |
|---|---|---|---|---|
| 1 | F-23 | /coach で「2件で迷っている」と送信 | AI コーチがテンプレでない具体的応答を返す（少なくとも 1 件の質問返し or 選択肢整理） | — |
| 2 | F-24 | /coach 応答後に下部「ほかの質問」チップをタップ | 新しいサジェスト質問が表示される（クラッシュしない） | — |
| 3 | F-26 | /venues/[id]/evaluate で 6 軸スライダーを動かして保存 | トースト「保存しました」が出て、値が数値で反映される | — |
| 4 | F-27 | 見積もり入力で Combobox (項目選択) を開き、外側タップ | 選択候補が消えない（外タップで閉じない挙動を維持） | — |

### 副次確認（M rank, 次 Sprint 先送り可）

| ID | 確認動作 | 期待結果 |
|---|---|---|
| B-11 | ホーム→探す→候補→コーチと順にタブ切替 | タップから描画完了まで 500ms 以内の体感 |

### 観察メモのフォーマット
`docs/user-observations/YYYY-MM-DD-wife-session1.md` に保存（テンプレは `docs/user-observations/TEMPLATE.md`）。
各動作について「迷った秒数 / 言葉に出したコメント / 期待と違った点」を 3 行で記録。

---

## Open

### P1 — 妻体験ブロッカー

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-23 | AI コーチがテンプレ応答（ペルソナ強化済、実機未検証） | H×S | Sprint 1 実機検証 → Sprint 4 改善 |
| F-24 | 「ほかの質問」動かない（修正済、実機未検証） | H×S | Sprint 1 実機検証 |

### P2 — 高影響・次着手

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-02 | 式場カード左下の星・数字が式場名と被る | M×S | Sprint 5 |
| F-03 | 画面切替ドット見づらい | M×S | Sprint 5 |
| F-26 | 評価スライダー UI（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |
| F-27 | Combobox が外タップで閉じる（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |

### P3 — 中影響（実機検証待ち）

_自律できる範囲は全て着手済み。残りは実機で発火条件を特定する必要あり。_

| ID | 課題 | 状態 |
|---|---|---|
| B-18 | 「次へ」挙動不安定 | 全 submit button に `disabled={isPending}` 確認済。具体 repro を次セッションで待つ |

### P4 — 低影響 / Later

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| B-06 | Zexy URL 追加（403 bot 検知） | L×L | Later（headless browser or 法務整理） |
| — | Hydration mismatch 警告（無害） | L×M | Later |
| — | Next 16 PPR `Failed to parse postponed state`（/candidates POST） | L×M | Later |

---

## Recently Closed（次 push 時に削除）

### 妻レビュー直前 ゼロアウト（2026-04-15 夕方）
- ✅ F-09 チェック差分 SEED → seedProjectChecklist 追加（starter 16 項目 × 全 venue に deterministic yes/no/unknown answer）
- ✅ F-12 決めた候補のハイライト強化 → VenueCard に 2px gold ring + 「晴れの日」chip
- ✅ B-11 タブ切替が遅い → candidates-view 7 コンポーネントを next/dynamic で code-split
- ✅ B-13 全画面縦長 → 比較表改善 + コピー短縮
- ✅ B-14 アプリ内アニメ → motion 予算 token 化 + EditorialHero に motion.section 適用
- ✅ B-17 Safari 戻るボタン → BfcacheRefresh（pageshow persisted 時 router.refresh）
- ✅ B-22 コピー素敵化 → docs/copy-lexicon.md + 全 server action エラー / UI toast / auth / onboarding / mypage / settings を softenize

### Sprint 3.5（2026-04-15）
- ✅ F-08 決めるタブにフィルタ → DecisionMatrix '絞る' panel 拡張（ドレス持込 + 支払い方法、localStorage 永続、empty-state）
- ✅ プラン透明化（ドレス 2 着 / 新郎分含有） → VenuePlan.dressBrideCount/dressGroomCount/dressBudgetCapYen + formatDressSummary 既実装確認

### Sprint 5（partial, 2026-04-15）
- ✅ F-12 決めた候補のハイライト強化 → VenueCard に 2px gold ring + 「晴れの日」chip
- ✅ B-13 全画面縦長（Sprint 2 で比較表改善 + コピー短縮で一段階解消）
- ✅ コピー辞書確立 → `docs/copy-lexicon.md`（B-22 の基盤）
- ✅ 業務用語置換 Phase A/B/C → プロジェクト/保存/削除/エラー/アカウント/ログイン/サインアップ/設定を全画面で softenize
- ✅ モーション予算 token 化 → `--ease-out-luxe / --dur-tap .. --dur-hero / --stagger` を globals.css に追加

### Sprint 4（partial, 2026-04-15）
- ✅ F-23 コーチテンプレ応答 → system prompt に頻出相談パターン応答指針（2件迷い/見積高騰/親反対/決め手不明/特定式場評価）
- ✅ AI 比較分析 → 決定マトリクスに AI ひとこと分析カード（Claude Sonnet 4.6 / JSON schema / 24h cache / テンプレ fallback）
- ✅ 口コミ AI 要約 バッチ → `batchAnalyzeVenueReviews` + review-section の「AI 要約を更新」ボタン

### Sprint 3（partial, 2026-04-15）
- ✅ F-06 比較の観点軸 6 固定 → localStorage 永続のチップ式フィルタで可変化
- ✅ F-07 観点フィルタ → 「絞る」chip + 展開パネル on DecisionMatrix
- ✅ F-19 チェックリスト設定がわかりにくい → 空状態に 16 項目ウィザード CTA
- ✅ F-20 反映先不明 → 反映先 hint ストリップ（/compare · /candidates）

### Sprint 2（2026-04-15）
- ✅ F-14 / F-21 ホーム editorial 刷新（白枠カード廃止、editorial-hero + sky chip）
- ✅ F-17 コーチ Plus ボタン → gold-subtle chip「新しい会話」
- ✅ F-18 コーチ履歴アイコン → chip「これまでの会話」
- ✅ F-01 / B-12 追加 Sheet 見出し巨大 → 17px に縮小、URL 入力を主役化
- ✅ F-04 王冠アイコン見づらい → Crown 撤去、bg tint + 2px gold band
- ✅ F-05 各観点の1位表示見づらい → 右上 6px dot + 観点ごとのベスト block
- ✅ F-10 決めた後のおめでとうがしょぼい → 朝光 wash + 2px gold 記念カード + confetti 控えめ化
- ✅ B-13 全画面が縦長 → 比較表の密度改善（Crown 撤去で pt-5 → py-3）

### Sprint 1 以前
- ✅ B-01 候補「うまくいきませんでした」（ceremonyStyles 型修正）
- ✅ B-02 評価スライド保存失敗（incremental save）
- ✅ B-19 「ほかの式場と比べる」
- ✅ B-03 FAB 位置（HaloTap relative 緩和）
- ✅ B-07 コーチ Plus ボタン（router.replace + refresh）
- ✅ B-09 コーチ応答キャッシュ（revalidatePath）
- ✅ F-13 「準備を始める」→ /candidates
- ✅ F-11 決定取消ボタン追加
- ✅ F-15 コーチ送信ボタン見切れ（min-w-0）
- ✅ F-16 コーチ AI 応答来ない（stream 0 chunks fallback）
- ✅ venue 写真 400（Unsplash remotePatterns）
- ✅ Decimal 警告（Number 変換）

## 完了判定ルール
妻が実機で該当動線をスムーズに完了 → Closed。次 push で削除。

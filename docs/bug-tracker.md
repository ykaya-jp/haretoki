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
| F-19 | チェックリスト設定がわかりにくい | H×M | Sprint 3 |
| F-20 | チェックリストの反映先不明 / 意図通り反映されていない疑い | H×M | Sprint 3 |
| F-01 | 式場追加 Sheet 見出し巨大・他文字小さい | H×S | Sprint 2 |
| F-14 | ホーム「おはようございます」+ 下の白枠がスペース無駄 | H×M | Sprint 2 |
| F-21 | ホーム全体がダサい（Refero 研究が必要） | H×L | Sprint 2 |
| F-10 | 決めた後のおめでとうがしょぼい | H×M | Sprint 2 |

### P2 — 高影響・次着手

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-04 | 比べるタブの王冠アイコン見づらい | H×S | Sprint 2 |
| F-05 | 各観点の1位表示見づらい | H×M | Sprint 2 |
| F-17 | コーチ右上 Plus ボタン目立たない | H×S | Sprint 2 |
| F-18 | コーチ左上の会話履歴アイコン同上 | H×S | Sprint 2 |
| F-06 | 比較の観点軸 6 固定、拡張 + 別画面制御（WG-04） | H×L | Sprint 3 |
| F-07 | 比較画面に観点フィルタ（WG-03） | H×M | Sprint 3 |
| F-02 | 式場カード左下の星・数字が式場名と被る | M×S | Sprint 2 |
| F-03 | 画面切替ドット見づらい | M×S | Sprint 2 |
| B-12 | Sheet 見出しサイズ不均衡 | M×S | Sprint 2 |
| F-26 | 評価スライダー UI（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |
| F-27 | Combobox が外タップで閉じる（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |

### P3 — 中影響

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-08 | 決めるタブにフィルタ・設定 | M×M | Sprint 3 |
| F-09 | チェック差分 SEED データ不足 | M×M | Sprint 3 |
| F-12 | 決めた候補のハイライト強化 | M×S | Sprint 2 |
| B-17 | Safari 戻るボタンで次の画面 | M×M | Sprint 5 |
| B-18 | 「次へ」挙動不安定 | M×M | Sprint 5 |
| B-11 | タブ切替が遅い | M×M | Sprint 5（Phase 1 計測次第） |

### P4 — 低影響 / Later

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| B-13 | 全画面が縦長 / 情報密度低 | M×L | Sprint 2/5 |
| B-14 | アプリ内アニメ欠如（Apple 風） | L×L | Sprint 5 |
| B-22 | 全コピー素敵化 | H×L | Sprint 5（辞書確定後） |
| B-06 | Zexy URL 追加（403 bot 検知） | L×L | Later（headless browser or 法務整理） |
| — | Hydration mismatch 警告（無害） | L×M | Later |
| — | Next 16 PPR `Failed to parse postponed state`（/candidates POST） | L×M | Later |

---

## Recently Closed（次 push 時に削除）

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

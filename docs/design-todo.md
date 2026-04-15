# 不足デザイン資産 TODO

コードより前に必要な**デザイン成果物**の TODO。Refero MCP / 参考スクリーンショット / ワイヤー / コピー案などを、**実装する前に**作る。

最終更新: 2026-04-15

---

## Sprint 1 で用意すべき設計物

### D-01 デザインリサーチレポート `docs/design-research.md`
Refero MCP で以下の画面パターンを 3 例以上ずつ研究し、ID + スクショ参照 + 抽出方針をまとめる。

| カテゴリ | 参考源 | 抽出したい |
|---|---|---|
| ホーム Hero（Greeting + CTA） | Zola / Notion Calendar / Linear Home | 情報密度 / 空間リズム |
| AI チャット UI | ChatGPT mobile / Claude mobile / Perplexity | 履歴切替 / 入力エリア / typing |
| 式場カード | Airbnb / The Knot / Aman | 写真比率 / 価格の出し方 |
| 比較マトリクス | DPReview / Consumer Reports / sheet-style | 行列高密度 / 差分ハイライト |
| 決定セレモニー | Partiful / Apple iCloud gift / 紙チケット | 記念性・格上げ |
| フィルタ画面 | Airbnb filters / Booking.com | 多軸可変 UI |
| チェックリスト | Notion / Things / AnyDo | タスク入力の摩擦最小化 |

### D-02 ブランドコピー辞書 `docs/copy-lexicon.md`
「**素敵化**」（B-22）を実行する前に、置換辞書を作る。

| 現在語 | 置換候補 | コンテキスト |
|---|---|---|
| プロジェクト | ふたりの式場さがし / わたしたちの式場ノート | Project 参照全般 |
| タスク | （削除 or 「進めたいこと」） | ステップ表記 |
| 編集 | 選び直す / 整える | 設定画面 |
| 設定 | わたしたちのこだわり / 表示を整える | settings 画面 |
| 追加 | 迎える / 気になる一軒を置く | add venue |
| 削除 | そっと外す / 候補から降ろす | favorite remove |
| 比較する | 見比べる / 並べて見る | compare action |
| 決める | ふたりで選ぶ / 決める（残す） | decision CTA |
| 完了 | しるしをつける | checklist done |

Refero で**他のカップル向けプロダクト**のコピーを 10 画面研究してから確定。

### D-03 タイポ / 数値ディスプレイ仕様 `docs/typography-display.md`
現在 DESIGN.md に散在している数値ディスプレイ規則（tabular-nums、Noto Serif JP, 3 段階スケール）を 1 本に。

### D-04 モーション予算仕様 `docs/motion-budget.md`
- タッチ応答 150ms 以内
- 遷移（ページ間） 600ms cubic-bezier(0.16, 1, 0.3, 1)
- stagger 50ms / secondary section 400ms
- prefers-reduced-motion 対応
- 「Apple 風」エディトリアル遷移の具体例（どの画面でどう使う）

---

## Sprint 2 で用意すべきワイヤー

各画面のワイヤー / プロトタイプを **Figma or 手描きメモ** で用意してから実装。

| 画面 | ワイヤー必須度 | Refero ID |
|---|---|---|
| ホーム（F-14/F-21） | 必須 | D-01 #ホーム Hero |
| コーチ画面（F-17/F-18） | 必須 | D-01 #AI チャット UI |
| 式場追加 Sheet（F-01） | 必須 | Notion Import / Raycast Quick Add |
| 比較マトリクス（F-04/F-05） | 必須 | D-01 #比較マトリクス |
| 決定セレモニー（F-10） | 必須 | D-01 #決定セレモニー |

---

## Sprint 3 で用意すべき UI パターン

| パターン | 参考 |
|---|---|
| チェックリスト空状態 + CTA | Things / Linear |
| 項目選択トグル（カテゴリ折りたたみ） | Notion Settings |
| 観点フィルタ（マルチセレクト） | Airbnb filters |
| 持ち込み料クロス表 | Amazon spec table / Google shopping |

---

## Sprint 4（AI）で用意すべきプロンプト資産

| プロンプト | 用途 |
|---|---|
| コーチ質問への few-shot examples | 自由対話品質を底上げ |
| 口コミ要約プロンプト | 接客 / 料理 / 上昇金額 の 3 観点 |
| 見積もり PDF 抽出プロンプト | 項目・金額・tier 予測 |
| 比較分析プロンプト | 2-3 件の式場差分を自然言語で |

→ `src/lib/prompts/` にそれぞれ 1 ファイル、`docs/prompt-playbook.md` に概要。

---

## Sprint 5 で用意すべきアセット

- ダークモードパレット（既存 CSS 変数の dark: バリエーション）
- OGP 画像テンプレ（決定セレモニー用）
- ランディングページの素敵コピー再考

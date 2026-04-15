# Design Research — Sprint 2 刷新 5 画面 + 関連パターン

最終更新: 2026-04-15 (Sprint 1)

> **ステータス**: 初版（Pre-Refero draft）
> 本セッションで Refero MCP が未接続だったため、既存の公的デザイン知見（Zola / The Knot / Airbnb / Linear / ChatGPT mobile / Notion / Things / Partiful / Aman / Apple.com / Stripe / Raycast / Notion Import / DPReview 比較表 等）をベースに**パターンと採用方針**を先に固めた。
> 次セッションで `mcp__refero__search_screens` が有効になり次第、各セクションの「Refero ref」欄を埋め、スクリーンショット ID を差し替える。**抽出した方針は Refero 補強後もほぼそのまま使える**粒度で書いている。

---

## 0. Design Brief（全体）

- WHAT: 結婚式場の比較・評価・最終決定を支援するモバイル Web アプリ
- WHO: 日本の結婚式を検討する20代後半〜30代のカップル（妻側が主導することが多い、夫は後追いで巻き込まれる）
- GOAL: 「ふたりが納得して1件を選ぶ」までの判断に必要な情報・機能を提供する
- TONE: 落ち着き／丁寧／明朝の格／朝の光・晴れ間のメタファー／**売らない中立**
- JOB: "Help me decide" と "Reassure me I'm not missing anything" の二重
- 最大の反論: 「ゼクシィ・みんなのウェディングで十分では？」→ **横比較の自由度** と **AI の観点提示** で返す
- 絵文字は基本使わない（B-22）

---

## 1. ホーム Hero — F-14 / F-21

### 課題
- 「おはようございます」Greeting + 下の白枠がスペース無駄、ダサい
- Refero リサーチで「朝の挨拶 + 進捗リング + インサイト」の情報密度のリファレンスが欲しい

### 参考パターン（3 + ）

| Source | 何を | 採用したい点 |
|---|---|---|
| **Notion Calendar** (web, iOS) | 日付を極小大文字 + 下に太い見出し1行、背景は限りなく薄いグレー | 情報を凝縮するなら**装飾でなくタイポで密度**を出す |
| **Linear Home (My Issues)** | 空白を使わず、左揃えで「今週・来週・全件」のカウントを並列 | 「白枠カード」をやめて **1 文で状況要約 + 小数値3つ** の 1 行型にする |
| **Things 3 "Today"** | 時間帯で Greeting を動詞化（"Today", "This Evening"） | 「おはようございます + 名前」より「**今日の式場さがし**」のような**動作的見出し** |
| **Airbnb "Trips" home** | 直近1件を大カード、過去は小さく右に | 「最近見た式場」は 1 件だけ大きく、残りは横スクロール小カード |
| **Apple Fitness "Activity ring"** | リング径40px以下、数値はリング外に tabular | 進捗リングは**小さく**、数字はリング外右に（今は中央で存在感強すぎ） |

### 抽出方針（Sprint 2 ホーム）
```
[上段] 日付 (extra-small, uppercase) + 今日の見出し1行（明朝24-28px, 細字）
[中段] 横1行: 候補 3 / 評価済 2 / 次の一歩 "比べる" — tabular-nums で数値密度
[差し色] 進捗リング 32-40px、右にテキスト "決定まで 60%" — gold-subtle
[下段] 最近見た式場 1件だけ大 (4:3 写真 + 名前 + ¥帯)、左右スワイプで3件目まで
[AI インサイト] 2行以内でテンプレート感のない1文、Sparkles は左 12px、gold 3px 左ボーダーは維持
```
- **"ダサく見える根源"**: 白カードの重なり + 余白 + 装飾 が全部半端。→ **カードをやめて"記事レイアウト"**（Apple.com のトップ記事風）にする
- 背景: 現 `--background` そのまま。カードは消し、Divider 1px only
- 密度: Zola / The Knot 的な「SaaS ダッシュボード」より Notion Calendar / NYT article の editorial 寄せ

### Refero で差し替えたいスクショ
- `search_screens("home greeting dashboard minimalist", limit=30)` → Linear / Notion Calendar / Superhuman Today
- `search_screens("onboarding progress ring small", limit=20)` → Apple Fitness / Duolingo streak

---

## 2. AI コーチ画面 — F-17 / F-18 / F-23

### 課題
- Plus (新規会話) ボタン目立たない
- 会話履歴アイコン目立たない
- 応答がテンプレ感

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **ChatGPT mobile (iOS)** | 左上 ≡ で履歴 drawer、上中央タイトル、右上 "New chat" は +アイコン | **drawer 化**すると 2 アイコンを両方強く押し出せる |
| **Claude mobile** | 上部にチップ状の "New chat" / "History"、下部に composer sticky | 上部チップは haretoki に合う（モバイル親指で届かない位置でもチップ中央寄りなら OK） |
| **Perplexity mobile** | 空状態に "Try asking:" で 3 つのサジェスト、タップで送信 | 空状態で F-24 的「ほかの質問」を**目に見えるチップ**として置く |
| **Linear AI "Ask"** | ストリーミング中は薄い shimmer で段落が現れる。typing indicator は文字前に… | ストリーミングの視覚設計 (shimmer + dot breath) を踏襲 |
| **Superhuman AI reply** | コマンド実行中は右上に小さい progress dot のみ | Plus ボタンは "New chat" ラベル付き chip として常時露出 |

### 抽出方針（Sprint 2 コーチ）
```
[上部スティッキー 56px]
  左: 履歴アイコン + ラベル "これまでの会話" (chip 形状, 12px radius, border subtle)
  中: セッションタイトル (明朝 16px, 省略...)
  右: "+ 新しい会話" chip (gold-subtle bg, border 1px gold)
[空状態]
  Sparkles + "どんなこと話そう？"
  下にサジェストチップ 3〜4 個: "条件を整理したい" / "見積もりの不安を相談" / "2件で迷っている"
[composer 下部sticky]
  min-h-44px, 送信ボタンは常時表示（F-15 解決済）, 右に disable 時は薄く
[ストリーミング]
  assistant バブルに shimmer（既存）、typing は "..." ではなく 3 dots breath
```
- Plus / History を**アイコンだけ**ではなく**アイコン+短いラベル**に変える = 情報密度が上がり発見性が上がる（F-17/F-18）
- F-23 は Sprint 4 の課題（ペルソナ + few-shot）、UI は Sprint 2 で先に片付く

---

## 3. 式場追加 Sheet — F-01 / B-12

### 課題
- 見出しが巨大（text-2xl 等）、入力フィールドが相対的に小さく不均衡
- 1 画面に全部載せすぎて縦長、判読しにくい

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **Raycast Quick Add** | 1 フォーカス行 + 詳細は折りたたみ。Enter で段階的に展開 | 段階的 BottomSheet（初期は「URL か 名前だけ」） |
| **Notion "Add page"** | タイトル入力 → カーソル落ちて本文、上部は静か | 見出しを 18-20px に抑え、入力フィールドを 44px 明瞭にする（見出しより入力を主役に） |
| **Airbnb "Save to list"** | Sheet は 2 段階（掴み所は ドラッグハンドル 36×4px, radius 2px） | BottomSheet の形状・ハンドル |
| **Linear "New issue"** | 必須は 2 つだけ（タイトル + チーム）、残りは meta row でチップ | Haretoki も「URL or 名前」だけで追加でき、住所等は後から補完 |
| **Apple Reminders "New Reminder"** | 上部に大きい "New" より**現在のコンテキスト表示** | 「候補に追加」と**文脈を上に**置き、見出しはむしろ小さくする |

### 抽出方針（Sprint 2 追加 Sheet）
```
[段階1: Add by URL or Name]
  Handle (36×4)
  コンテキスト行 "気になる式場を置く" (14px, muted)
  主入力: URL 貼り付け or 「式場名で検索」 1 箇所 (h-14, 目立たせる)
  進むボタン: "取り込む" / "この名前で追加"
[段階2: 自動抽出結果プレビュー]
  写真 + 名前 + 住所 (editable)
  [追加する] プライマリ
[段階3（任意）: 詳細補完]
  フロア・収容人数等は後でも可 (skip 導線あり)
```
- 見出し: text-lg (18px) 細字、目立たせず
- 入力: h-14 で主役
- B-12 「見出しサイズ不均衡」は**見出しを縮め、入力を拡大**で解決

---

## 4. 比較マトリクス (比べるタブ) — F-04 / F-05 / B-13

### 課題
- 王冠アイコン見づらい（金 + 色被り + サイズ）
- 各観点の「1位」表示がわかりにくい
- 全体が縦長 (B-13)

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **DPReview スペック比較表** | 列固定 + 横スクロール、差分セルを bg tint でハイライト | **差分セルの bg tint** を gold 3-5% に |
| **Amazon 商品比較** | 行：観点、列：候補、1位セルに小さな ✓ / ◎ / アイコン右上 | 1 位マークは **セルの右上 8×8 の小 dot** or **行末の "ベスト:○○"** にする |
| **Consumer Reports rating grid** | 5 点表示を dot ●●●○○ で、数字は小さく添える | 星/数字併存をやめて「**色の強度 + 小数値**」に統一 |
| **Notion Database Compare view** | 列 sticky、上スクロールでヘッダ圧縮 | ヘッダ sticky + 圧縮時は式場名だけ残す |
| **Superlist / Things "Today"** | 差分は左の色帯のみ、右は無地 | 王冠を**セル内ではなくヘッダ下の 2px 色帯**で示す |

### 抽出方針（Sprint 2 比較）
```
[ヘッダ] 式場名明朝 + 小さい写真 40×40 (4:3 でなく正方で圧縮)
[Row 1: 観点セル] ラベル左、値は横に並ぶ
[Row bg tint]
  各行で最上位のセルだけ bg: `color-mix(in oklab, var(--gold) 6%, transparent)`
  スコア値は tabular-nums 14px
[Row 下端] 最上位の式場名を `行末: ◎ アマン東京 (4.8)` として 12px muted
[王冠アイコン] 廃止候補。代わりに「総合1位」を**ヘッダ下の細 2px gold 帯**で表現
[縦長対策]
  - 観点をセクション折りたたみ（料理/演出/会場/費用/アクセス/スタッフ）
  - 初期展開は 3 セクション、続きは "もっと見る"
```
- F-04: 王冠 → 2px 色帯 + 行末テキスト (サイズ小 + 可読性高)
- F-05: 各観点の1位は **bg tint** で分かる、字は 14px tabular
- B-13: 縦長 → 折りたたみで 1 画面に収まる量に

---

## 5. 決定セレモニー — F-10

### 課題
- 決めたあとの「おめでとう」表示がしょぼい。妻 QB: "もっと感動したい"

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **Partiful "Party created"** | 紙吹雪 + 中央の大カード（タイトル 明朝大）＋ 招待 URL の即シェア | **記念カードの生成** + シェアリンク |
| **Apple iCloud Gift "Success"** | アニメーションで光が広がる → カード遅れて fade-in | 光の広がり (600ms) → テキスト段階 fade-in |
| **紙チケット / 結婚報告ハガキ** | 中央に明朝見出し、左右余白広い、**ラインホイル or 金線** | gold-line 2px の枠、中央明朝「ふたりが選んだ場所」 |
| **OGP カード生成 (Raycast / Linear release notes)** | 2 サイズ自動生成、シェア前にプレビュー | OG 画像を Vercel OG で生成、Twitter/LINE 共有導線 |
| **Notion "Subscribed"** | 数字カウントアップ + 薄い confetti 1s | Confetti は抑えめ、カウントアップはなし |

### 抽出方針（Sprint 2 決定）
```
[t=0-400ms] 画面全体が朝光にフェード (gold-subtle → background)
[t=400-800ms] 中央の記念カードが scale 0.96 → 1.0 で fade-in
  - カード枠: 2px gold hairline、radius 20px、内側余白 32px
  - 上: "ふたりが選んだ場所" (明朝 14px, gold muted, tracking-wider)
  - 中: 式場名 (明朝 32-36px 細字, text-foreground)
  - 下: 決めた日 (YYYY年M月D日, tabular-nums 14px)
[t=800-1200ms] 下部に小さな CTA 2 つ fade-in
  - "記念カードをシェア" (gold-subtle button)
  - "みんなに知らせる" (ghost, 招待済みパートナーへ通知)
[t=1000ms] 控えめ confetti 800ms、粒子 25 個、gold + foreground muted
```
- OGP 画像: `src/app/api/og/decision/[projectId]/route.tsx` を新設（Sprint 2 で実装）
- 音: いれない（職場で開いても OK）
- prefers-reduced-motion: fade-in は残す、scale と confetti のみスキップ

---

## 6. フィルタ画面 — F-06 / F-07 / WG-03 / WG-04（Sprint 3 参考用）

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **Airbnb filters** | モーダル最下部に適用ボタン sticky、上部 スライダーは片側 handle | モバイルのフィルタモーダルの基本形 |
| **Booking.com filters** | 多数のチェックを accordion で畳み、適用件数を常時表示 | "この条件で 12 件" のリアルタイム表示 |
| **Linear "Display options"** | **観点フィルタ + ソート** を両方1画面で、右パネル | 比較画面の「観点を絞って見る」はここ |
| **Apple HIG List Filters** | Section で grouping、selection は inline check | カテゴリ 6 軸を section で折りたたむ |

### 抽出方針（Sprint 3）
- 比較画面: 右上に `調整` chip → 開くと「表示する観点」チェック群 + ソート
- 観点は 6 軸固定 → ユーザー追加可（checklist-presets から抽選 / 保存）
- 件数リアルタイム表示 "表示中: 4 観点 × 3 式場"

---

## 7. チェックリスト UI — F-19 / F-20 / WG-01 / WG-02（Sprint 3 参考用）

### 参考パターン

| Source | 何を | 採用したい点 |
|---|---|---|
| **Notion Database templates** | 空のとき上部に **「テンプレートから始める」** 大ボタン | 初回 /checklist で "おすすめ項目から始める" CTA |
| **Things 3 "Today / Upcoming"** | 入力はタイトル 1 行のみ、details は右へ swipe | 項目追加は**親指だけで連打**できる単一行 |
| **Linear Triage** | 各項目に小さい「どこで使われているか」タグ | **反映先表示**: 項目に `候補 3 件で比較中` バッジ（WG-02 の核心） |
| **Todoist "New task"** | `/` コマンドでカテゴリ指定、Enter で追加 | カテゴリ選択はチップ、input はずっとフォーカス |

### 抽出方針（Sprint 3）
```
[/checklist 空状態]
  見出し: "比べたい観点をふたりで決める"
  CTA 大: "おすすめ項目から始める" (プリセット 90 項目から 15 選ぶウィザード)
  CTA ghost: "自分で追加する"
[項目行]
  [✓] 項目名 (14px)      [候補3件で反映中] (10px, gold-subtle bg, 4px radius)
[反映バッジのクリック]
  → /candidates/compare にフィルタ適用状態で遷移（WG-02 解消）
```

---

## 8. 共通: タイポ / スペーシング / モーション補強

### タイポ
- 明朝見出し (Noto Serif JP) は **細字 300-400** のみ。500 以上禁止（D-03 に準拠）
- 本文 Noto Sans JP 400、ラベル 500
- 数値は全て tabular-nums（Apple Fitness / Linear の数値表示準拠）
- letter-spacing: 明朝 32px+ で `-0.02em`、UPPERCASE で `0.08em`

### スペーシング
- 4px ベース。主要: 4/8/12/16/24/32/48/64
- セクション間: 48px（editorial らしさ）、密度が必要なら 32px
- Hero 内部の密度: 12-16px（Notion Calendar 準拠）

### モーション（D-04 motion-budget と同期）
- タッチ応答 ≤150ms scale(0.98)
- ページ遷移 600ms cubic-bezier(0.16, 1, 0.3, 1) — Apple.com 風
- stagger 50ms（リスト項目）、secondary section 400ms fade-up 8px
- prefers-reduced-motion: fade のみ残す、translate/scale はスキップ

---

## 9. 競合ポジショニング整理（GTM 連携）

| プロダクト | 強み | haretoki が勝てる領域 |
|---|---|---|
| **ゼクシィ** | 情報量・提携式場数 | **中立性**（売らない）、**横比較**、**AI の気づき** |
| **みんなのウェディング** | 口コミ量 | **口コミ AI 要約**（R2）、**ネガ優先モード** |
| **Hanayume** | 予約特典 | そもそも予約ではなく**意思決定支援**に寄せる |
| **Notion / Google Docs で自作** | 自由度 | **式場データの構造化** + **Partner 協業** + **モバイル最適** |

差し色「売らない」「並べる」「気づく」の 3 語を Sprint 5 コピー辞書で保持。

---

## 10. Sprint 2 着手順の推奨

Refero 接続後の最小追加リサーチ:
1. `search_screens("home dashboard editorial minimalist greeting", limit=40)` — ホーム
2. `search_screens("mobile ai chat drawer new chat", limit=30)` — コーチ
3. `search_screens("bottom sheet add item staged url paste", limit=30)` — 追加 Sheet
4. `search_screens("comparison table spec grid differentiator", limit=30)` — 比較
5. `search_screens("success celebration minimal confetti gold", limit=25)` — 決定
6. `search_screens("onboarding empty state template wizard", limit=25)` — チェックリスト
7. `search_screens("airbnb booking filter modal apply sticky", limit=25)` — フィルタ

各から `get_screen` で 3-5 件深掘り。抽出方針は本書の各セクションと照合して**補強 or 上書き**する。

実装着手は: **1) ホーム → 2) コーチ → 3) 追加 Sheet → 4) 比較 → 5) 決定** の順を推奨（影響範囲が小さい側から）。

---

## 11. 未決事項（Sprint 2 開始前に決めたい）

- [ ] 決定セレモニー OGP 画像テンプレの文字列（記念コピー）
- [ ] ホーム HeroNba に「進捗リング」を残すか／もっと控えめにするか（妻観察で確定）
- [ ] 比較マトリクスの王冠アイコン完全廃止か、セル右上 dot だけ残すか
- [ ] コーチ空状態のサジェスト文言 3-4 個（copy-lexicon 待ち）

---

## 12. Refero 未接続メモ

本セッションでは `mcp__refero__search_screens` / `get_screen` / `search_flows` / `get_design_guidance` が利用不可だった。次セッションで:
1. 上記「Sprint 2 着手順」の 7 クエリを実行
2. 各セクションの `Source` 欄に **Refero ID + スクショ URL** を追記
3. 採用方針が矛盾していたら**方針のほうを上書き**（本書は pre-research の暫定）
4. Refero が出してくる**"surprising finding"** を各セクションに 1 件追加（"素敵化" の核になる）

# Phase 5 — Multilingual (i18n) 設計

**作成**: 2026-05-03 (paneA、Phase 5 入口準備)
**状態**: 🟡 **設計 doc**。実装は Beta launch + 1 ヶ月の運用観測後 (海外ユーザー
リクエスト数 / 訪日客 / Phase 5 全体計画) を経て判断
**根拠**: Phase 4 launch readiness 完了 → Beta launch 後の Phase 5 入口の
1 つとして、Web View で「英語表示」を欲しがる couple (国際カップル / 日本在住
外国人 / 訪日 wedding planner) のリクエストに応える

---

## 0. 一行サマリー

**ja-JP only の現状から、英語版を hello-world から段階的に追加する**。先に
**i18n 抽象化レイヤー** を入れて UI 文字列を「リソース化」、その後 **英語
hello-world ページ 1 個** で動作確認、最後に主要 surface (landing / signup /
home) を翻訳する 3 段階。**ja のまま機能を作り続ける速度は落とさない** ことが
最大の制約。

---

## 1. 現状

### 1.1 i18n 関連の過去経緯

- 過去ある時期に `next-intl` を導入したが、bundle / dev complexity が増す
  代わりに ROI が低かったため **撤去** された (出典: git log で
  `next-intl` を grep すれば revert commit が見える)
- 現状全 UI 文字列は JSX 内 inline ハードコード (例: `<h1>晴れの日へ、次の一歩</h1>`)
- 数値 / 日付 formatting は `Intl.DateTimeFormat("ja-JP", ...)` が散在
- 通貨表記は「万円」「円」が文字列 concat
- バリデーションメッセージ (zod) も同 inline、日本語固定

### 1.2 国際化の実害シグナル (現時点)

- ユーザーリクエストはまだ **未観測** (Beta launch 前)
- /admin/feedback (B が実装済) に英語表示要望が来たら i18n 着手の優先度が上がる
- App Store / Google Play 公開予定がある場合、ストア表記 + screenshot は別途
  英語化が必要 (i18n 実装と独立)

---

## 2. ゴール (3 段階)

### Stage 1 — 抽象化レイヤー導入 (~2 day)

**何を入れる**:

- 軽量 i18n primitive: `src/lib/i18n.ts` に `t(key: string, params?: Record<string, string>)` を 1 関数だけ実装
- `src/lib/i18n/locales/ja.json` (現状の全 UI 文字列を抽出) + `en.json` (空オブジェクト、後段で埋める)
- `<LocaleProvider>` を `(app)/layout.tsx` で wrap、Cookie or `Accept-Language`
  header から locale を解決
- 主要 5 page だけ `t("home.greeting")` 形式に書き換え (= migration の道筋を示す)

**何を入れない**:

- 完全な ICU MessageFormat (複数形 / 性別 / case) は Stage 3 で
- RTL (アラビア語 / ヘブライ語) は対象外 (LTR の英語のみで十分)
- next-intl / react-i18next 等の重量 lib は使わない (Phase 4 で bundle 最適化中、
  軽量自前で済む間は自前で持つ)

**所要 ~2 day**。bundle への影響: ja.json + en.json + 数 KB の primitive で
+10 KB 以下。

### Stage 2 — 英語 hello-world (~1 day)

**何を入れる**:

- `/?lang=en` で landing page だけ英語表示できるよう `en.json` の landing 部分
  を埋める
- 言語切替 toggle を footer に追加 (header に置くと brand を侵食するため
  footer に hidden cherry)
- `<html lang>` を locale に応じて切替
- E2E test で `/?lang=en` が崩れず paint する

**何を入れない**:

- Sign-up flow の英語版 (Stage 3 で)
- onboarding question の英語版 (Stage 3 で)

**所要 ~1 day**。これで「英語切替の存在は外から見える」状態になり、ユーザー
リクエスト判断材料が手に入る。

### Stage 3 — 主要 surface 完全英語化 (~5 day)

- landing / signup / login / home / explore / venue detail の主要 6 surface を
  英語化
- 数値 / 日付 formatting を Intl.DateTimeFormat 経由で locale 切替
- 通貨表示を「3,000,000 yen」「3 million yen」等に切替 (`Intl.NumberFormat`)
- zod バリデーションメッセージを `t("error.required")` 形式に
- 既存 cron / Server Action のログ / Sentry / 構造化ログは **英語固定** (運用)

**何を入れない**:

- `/admin/*` の英語化 (内部運用画面、operator は日本語前提)
- onboarding 4 質問の英語化 (機械翻訳すると質問のニュアンスが消える、Stage 4 で
  human translator)
- 招待 email の英語版 (Stage 4 で)

**所要 ~5 day**。

### 非ゴール (Stage 4 以降)

- 中国語 (繁体 / 簡体)、韓国語 — 需要観測後
- 完全 RTL — 要 design system 大規模改修
- 機械翻訳の自動運用 (DeepL API 等) — 翻訳品質が brand を傷つけるリスク高

---

## 3. 技術選定

### 3.1 i18n primitive: 自前 vs lib

| 案 | pros | cons | 判断 |
|---|---|---|---|
| (A) 自前 (`src/lib/i18n.ts` で `t()` 1 関数) | bundle +5 KB、依存 0、debug 容易 | 複数形 / pluralization 等は手動 | ✅ Stage 1-2 はこれ |
| (B) `next-intl` 再導入 | ICU 完全対応、Server Component 対応 | bundle +30 KB、過去 revert 履歴 | Stage 4 で複数形が痛くなったら検討 |
| (C) `react-i18next` | ecosystem 大、plugin 豊富 | Server Component との相性悪、bundle +50 KB | ✗ 避ける |

**結論**: (A) で開始、(B) は trigger 観測後。

### 3.2 Locale 解決 strategy

- **Cookie 優先 → Accept-Language fallback**: User が一度 toggle で「en」を
  選んだら以降 cookie で記憶 (lifetime 1 年)、cookie 不在なら
  `Accept-Language` header の最先頭 locale (`en` / `ja-JP`) を採用、それも
  不明なら `ja` default
- URL prefix (`/en/...`) は **採用しない**: SEO 上は別 path の方が良いが、
  Phase 5 で SEO 多言語対応する明確な ROI が無い + 実装コスト高
- `<html lang>` は per-request で切替 (server component の `headers()` から
  cookie 読む)

### 3.3 翻訳ファイル管理

- ファイル: `src/lib/i18n/locales/{ja,en}.json` (flat key)
- 命名: `surface.element.purpose` (例: `home.greeting`, `landing.cta.primary`)
- 翻訳追加 PR ワークフロー: 1 PR で `ja.json` の new key 追加 + `en.json` の
  same key を **空文字列** で追加 (= 翻訳漏れを type 検査で検出)
- `tsc` 検査: `strictKeys: true` 相当の自前型生成スクリプト (Stage 3 で
  必要なら導入)

---

## 4. Schema 変更

### 4.1 必須

- なし (Stage 1-3 すべて schema 変更ゼロ)

### 4.2 Stage 4 以降の候補

- `User.preferredLocale` カラム — Cookie より durable な per-user 設定
- `Notification.locale` — 各 notification を発射時の locale で固定して保存
  (= user が後で locale 切替しても past notification は当時の言語のまま)
- `EmailTemplate.locale` — 招待 email / reminder email の locale 別 template

これらは **必要になった時点** で追加。Stage 1-3 では cookie だけで十分。

---

## 5. 影響範囲評価

| 領域 | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| `src/app/**/page.tsx` | 主要 5 page touch | landing 1 page touch | 主要 6 surface touch |
| `src/components/**` | LocaleProvider 追加 | 言語 toggle 追加 | 主要 component 全部 touch |
| `src/lib/` | `i18n.ts` + `locales/` 新規 | + en.json 充填 | + Intl helper |
| `src/server/actions/` | 影響なし (内部メッセージは日本語維持) | 同 | zod バリデーションメッセージのみ |
| `prisma/schema.prisma` | 影響なし | 同 | 同 |
| `tests/e2e/` | 影響なし | + lang=en spec | + 主要 6 surface 英語版 spec |
| Sentry / ログ | 影響なし (英語固定) | 同 | 同 |
| Vercel env | 影響なし | + `NEXT_PUBLIC_DEFAULT_LOCALE` | 同 |

**breaking change 評価**: 全 Stage で additive。既存 ja-JP ユーザー体験は不変。

---

## 6. 着手判断の trigger

**着手 GO の signal** (どれか 1 つ満たせば Stage 1 開始):

- /admin/feedback で英語表示要望が **1 ヶ月で 5 件以上**
- パートナーシップ (婚活エージェント / international wedding planner)
  からの依頼で「英語版 demo を見せたい」
- App Store / Google Play 海外市場展開を別軸で決定

**着手 NO の signal**:

- Beta launch 後 6 ヶ月、英語要望ゼロ → 永続的に ja-only で良い、Stage 1 も
  入れない (= 実装コストの先食いを避ける)

---

## 7. リスク + 既知の限界

### 7.1 翻訳品質リスク

- 機械翻訳をそのまま乗せると brand が崩れる (haretoki の「晴れ時」 brand
  metaphor は直訳できない)
- 解決: Stage 2 hello-world は **operator の手翻訳 + ネイティブ 1 名 review**、
  Stage 3 は **professional translator + brand voice guideline** を渡す

### 7.2 bundle size リスク

- `ja.json + en.json` を Server Component が render-time で参照すれば
  client bundle に含まれない → +0 KB
- Client Component で `t()` を使う場合は currentLocale の JSON だけ載せる
  (split chunks)
- **目安**: Stage 3 完了時に First Load +20 KB を超えたら abort、設計再考

### 7.3 内部運用ログ言語リスク

- Sentry / Vercel logs / 構造化イベント名は **英語固定** が運用上正解
  (operator が日本人でも英語の error message を読む方が universal)
- ただし notification body / email body は user-facing なので i18n 対象

---

## 8. 関連ドキュメント

- `docs/release/launch-day-checklist.md` — Phase 4 launch (本 doc は launch 後)
- `docs/phase3/COMPLETION.md` — Phase 3 完成宣言
- `docs/phase5/regional-expansion-kansai.md` — Phase 5 別軸 (関西展開)
- `DESIGN.md` — brand voice の SoT (英訳時の brand metaphor 参照)
- (将来) `docs/i18n/translation-guide.md` — 翻訳者向け brand voice / 用語集

---

## 9. 履歴

- 2026-05-03 (paneA、Phase 5 入口準備): 初版設計、3 stage 分割 + 着手 trigger
  + リスク評価

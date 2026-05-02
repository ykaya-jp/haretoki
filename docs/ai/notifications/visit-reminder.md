---
name: visit-reminder.notifications
pairs_with: src/lib/visit-reminder/copy.ts
last_synced: 2026-05-02
---

# 見学リマインダー通知 — Copy Table 確定版

Track B (push 通知システム) の **正本コピー**。 Push 通知 / in-app
notification / email reminder のすべての文面はここを参照する。
コードは `src/lib/visit-reminder/copy.ts` に const 化され、 docs/コードは
**同 PR で同期** (drift hook が STDERR 警告)。

最終更新: 2026-05-02 (Track B-0 確定、 round 17)

## 設計判断

### Timing

3 つの timing で push を送る (B-2 cron が `*/5 * * * *` で発火条件を判定):

| Timing | 発火 | UX 意図 |
|---|---|---|
| **T-24h** | 翌日同時刻 ±5 分以内の visit を検知 | 前日朝 — 持ち物・準備リマインド |
| **T-1h** | 1 時間後 ±5 分以内 | 出発前 — 「今日見ておきたいこと」を思い出す |
| **T+30m** | 30 分前 ±5 分以内 | 帰り道 — 印象が新鮮なうちにメモ |

> **重要**: B-2 dispatcher の duplicate guard (`NotificationSentLog`
> `@@unique([visitId, timing])`) で同 visit × 同 timing は 1 通保証。
> Cron が 5 分間隔で複数回叩いても重複送信しない。 詳細は B-2 spec 参照。

### Venue 種類別カスタマイズ

3 つの venue 種類で 微妙にコピーをカスタマイズする (`Venue.ceremonyStyles[]`
から最初のマッチで判定):

| 種類 | マッチする ceremonyStyle | 想起される雰囲気 |
|---|---|---|
| **chapel** | `chapel`, `church`, `christian`, `protestant`, `catholic` | 神聖、 厳か、 光のさす空間 |
| **garden** | `garden`, `outdoor`, `terrace`, `resort` | 開放感、 風、 自然光 |
| **hotel** | `hotel`, `banquet`, `ballroom` | 大人、 落ち着き、 接客の格 |

判定はすべて lower-case 比較。 どれにもマッチしない / `ceremonyStyles` が
空 → **fallback** バリエーション (種類非依存の中立トーン)。 4 種類目を
増やすときは `src/lib/visit-reminder/copy.ts` の `pickVenueKind()` ヘルパ
+ 本ドキュメントを同 PR で更新。

## Copy 原則 (`docs/copy-lexicon.md` 準拠 + 通知特有)

通知は **画面外のユーザーに割り込む surface** なので Lexicon 原則を厳格に
適用する:

- **急かさない**: 「今すぐ」「急いで」「お忘れなく」禁止 →
  「お時間あれば」「気が向いたら」
- **売らない**: 「おすすめ」「一押し」禁止
- **無主語 or「コーチが」**: 命令形 (「見てください」) は避ける →
  「コーチが思い出させますね」「ご一緒に確認しませんか」
- **ふたり主語** when 適用可能: 「あなたが」→「おふたりで」
- **保存系 → 残す**: 「保存しますか」→「残しておきませんか」
- **キャンセル系 → リスケ / 変更**: 「キャンセル」→「変更」「リスケ」
- **絵文字禁止**: 通知本文 / title 共に。 受信側 OS の中立スタイルに任せる
- **晴れの日メタファー**: 控えめに 1〜2 語 (「光」「朝」「向かいましょう」)

### Push 通知の制約

| 場所 | 文字数目安 | 規約 |
|---|---|---|
| `title` | 30 全角字以内 (~ 60 半角) | 視認性最優先、 venue 名 + 1 アクション語 |
| `body` | 80 全角字以内 (~ 160 半角) | 1 文 + 1 補足。 改行入れない (OS 側で勝手に折り返す) |
| `tag` | 一意 ID (`visit-reminder:<visitId>:<timing>`) | 同 (visit, timing) 複数発火を OS 側でも dedupe |
| `actions` | 最大 2 | 「アプリで開く」(default click) + 「変更する」(任意 timing で) |

## Copy Table — 確定版 (3 timing × 3 venue 種類 + fallback)

各セルは `{ title, body }` ペア。 variable interpolation 規約は本ドキュメント末尾参照。

### T-24h — 前日朝

| Venue 種類 | title | body |
|---|---|---|
| **chapel** | 明日、{venueName} の見学 | 朝の光のなかでの式場見学。 持ち物と聞きたいことを残しておくと、 当日が落ち着きます。 |
| **garden** | 明日、{venueName} の見学 | 屋外の見学になります。 天候に合わせた服装で、 ゆっくり下見にいきましょう。 |
| **hotel** | 明日、{venueName} の見学 | 館内の雰囲気とサービスを見るチャンスです。 気になる項目をチェックリストに残しておきませんか。 |
| **fallback** | 明日、{venueName} の見学 | 前日のうちに、 当日見ておきたいことをチェックリストに残しておきませんか。 |

### T-1h — 当日 1 時間前

| Venue 種類 | title | body |
|---|---|---|
| **chapel** | あと 1 時間、 {venueName} へ | 当日の下見ポイントをコーチがまとめました。 ご一緒に確認しませんか。 |
| **garden** | あと 1 時間、 {venueName} へ | 屋外の動線も見どころです。 当日のチェック項目、 ご一緒に確認しませんか。 |
| **hotel** | あと 1 時間、 {venueName} へ | 接客やお料理の質も今日のポイントです。 見ておきたいこと、 ご一緒に確認しませんか。 |
| **fallback** | あと 1 時間、 {venueName} へ | 当日見ておきたいこと、 コーチが思い出させますね。 ご一緒に確認しませんか。 |

### T+30m — 帰り道

| Venue 種類 | title | body |
|---|---|---|
| **chapel** | お疲れさまでした | 印象の新しいうちに、 おふたりの感想を残しておきませんか。 帰り道のメモが、 比べるときの灯りになります。 |
| **garden** | お疲れさまでした | 風や光、 写真と一緒に印象を残しておきませんか。 後で読み返すときの手がかりになります。 |
| **hotel** | お疲れさまでした | 担当者の印象や接客の感じ、 残しておくと比べるときの目印になります。 |
| **fallback** | お疲れさまでした | お帰り道のうちに、 見学メモを残しておきませんか。 印象が新しいうちが一番です。 |

## Variable interpolation 規約

コピー本文に登場する `{...}` プレースホルダ:

| Variable | 例 | サニタイズ |
|---|---|---|
| `{venueName}` | 「ガーデンテラス青山」 | `sanitizeForPrompt()` 相当: タグ除去 + 改行平坦化 + 60 字 cap (push title の制約から) |
| `{date}` | 「5/16(土)」 | JST 計算、 `formatJstDate(scheduledAt)` で `M/D(曜)` |
| `{time}` | 「14:00」 | JST、 24h 表記、 `formatJstTime(scheduledAt)` で `HH:MM` |

実装時は **必ず venueName を sanitize** してから template 組み込み。
URL 取り込み起点の venue 名はサードパーティ由来 — XSS / prompt injection
の発生源になりうる (現状 push 通知は純テキストなので XSS は無いが、 将来
in-app inbox で HTML レンダリングする際の防御は今から組み込んでおく)。

## Edge cases

| 状況 | 動作 |
|---|---|
| `Venue.ceremonyStyles` が空 | `fallback` バリエーションを使用 |
| `scheduledAt` が null | リマインダー送信対象外 (B-2 候補抽出 SQL の WHERE で除外) |
| 同 visit × 同 timing が複数の cron tick で発火 | `NotificationSentLog @@unique([visitId, timing])` で 1 回保証 (B-2 で実装) |
| User の `NotificationPreference.timings.tXXh = false` | その timing のみ skip、 他 timing は送る (B-3 で実装) |
| User の `frequency = "important"` | T-24h のみ送信、 T-1h / T+30m は skip (B-3) |
| Push permission が `denied` | B-2 dispatcher は subscription 不在として silent skip (Sentry 出力なし、 normal flow) |
| Visit が取消 (`status="cancelled"`) | 候補抽出時に除外、 既送信分の取消通知は送らない (Phase 3 候補) |

## アクションボタン (push notification actions)

OS によって表示有無 / 数が異なる。 設計上は最大 2 つ用意し、 OS 側で自動
省略される前提:

| Timing | action 1 (primary) | action 2 (secondary) |
|---|---|---|
| T-24h | 「準備リストを開く」 → `/visits/{visitId}/prep` | 「見学日を変更」 → `/visits/{visitId}` |
| T-1h | 「下見ポイントを見る」 → `/visits/{visitId}/prep` | (なし) |
| T+30m | 「メモを残す」 → `/visits/{visitId}/way-home` | (なし) |

タップ無しのデフォルト click は **常に action 1 と同じ deep link**。

## i18n (将来)

現状 ja のみ。 英語化判断は商用化第 2 段で再検討 (`docs/PENDING.md`
D セクション 多言語化 🟡 と連動)。 英語コピーを追加するときは本テーブルを
`ja` カラム + `en` カラムの 2 列構造に拡張、 `src/lib/visit-reminder/
copy.ts` の `pickCopy(timing, venueKind, locale)` シグネチャを拡張。

## Lexicon 違反チェックリスト (mechanical)

本テーブルを書き換えるときは以下 grep で違反を検出:

```bash
# 急かしフレーズ
grep -nE "今すぐ|急いで|お忘れなく|至急" docs/ai/notifications/visit-reminder.md

# 売り込み語
grep -nE "おすすめ|一押し|今なら|限定|キャンペーン" docs/ai/notifications/visit-reminder.md

# 命令形 (です・ます以外)
grep -nE "してください|して下さい|お願いします" docs/ai/notifications/visit-reminder.md

# 絵文字 (push 本文には不可)
grep -nP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" docs/ai/notifications/visit-reminder.md
```

すべて 0 行であること (本ドキュメント自体の grep 例 / Lexicon 引用は OK
なので注意)。

## 関連ドキュメント

- 上位設計: `/tmp/haretoki-design-master-plan-2026-05-02.md` Track B
- Lexicon: [`docs/copy-lexicon.md`](../../copy-lexicon.md)
- 既存メール template (round 5/9 で実装、 daily-only 版): `src/lib/email/templates/visit-reminder.ts`
- B-1 (Service Worker + push permission opt-in): plan §B-1 参照、 未実装
- B-2 (cron dispatcher、 duplicate guard): plan §B-2 参照、 未実装
- B-3 (settings UI、 per-timing toggle): plan §B-3 参照、 未実装
- AI prompts drift hook (本 doc 系の同期も対象): `docs/harness/adr/0006-ai-prompts-drift-detection-via-posttoooluse-hook.md`

## 更新プロトコル

1. コピーを変える前に Lexicon `docs/copy-lexicon.md` を再確認
2. 本テーブルを編集 → 本ドキュメント末尾の grep 4 件を実行 → 全 0 行であること確認
3. `src/lib/visit-reminder/copy.ts` (B-0 完了後 B-2 で作成) を同 PR で同期
4. drift hook が `pairs_with` frontmatter を見て同 PR 検知 → 警告ゼロを確認
5. PR description に「コピー変更があります」を 1 行明記してレビューしやすく

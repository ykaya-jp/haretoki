---
name: realtime-push.notifications
pairs_with: src/lib/push/realtime-copy.ts
last_synced: 2026-05-03
---

# Couple-activity リアルタイム push 通知 — Copy Table 確定版

Phase 3 Level 3 wave 2 — Realtime broadcast (wave 1 with PaneA) を引き金に
配信される push 通知の **正本コピー**。 Push 通知 / in-app inbox 共に
ここを参照する。 コードは `src/lib/push/realtime-copy.ts` に const 化され、
docs/コードは **同 PR で同期** (drift hook が STDERR 警告)。

最終更新: 2026-05-03 (P3 L3 W2、 round 24)

## 設計判断

### Event 種別

4 種の event で push を送る (Realtime broadcast 受信時に
`dispatchRealtimeEvent` がフィルタ + 送信判定):

| Event | Trigger | UX 意図 |
|---|---|---|
| **partner_rating_added** | Owner / Partner が venue rating を保存した瞬間 | 「相手が評価をつけました」 — 相手の動きを近くに感じる |
| **partner_note_added** | 見学メモが初めて追加された瞬間 (visit 単位の最初の 1 件のみ) | 「相手が見学メモを残しました」 |
| **decision_saved** | 式場決定 (`makeDecision`) | 「式場が決まりました」 |
| **wedding_date_set** | 結婚式日付が初めてセットされた / 変更された瞬間 | 「晴れの日が決まりました」 |

> **重要**: dispatcher の throttle (`PushSendLog` `@@unique([recipientUserId,
> kind, scopeId, hourBucket])`) で同 (recipient × kind × scope × 1h)
> = 1 通保証。 Realtime broadcast が短時間に複数回叩いても重複送信しない。
> hour bucket は `floor(now / 3600s)` なので、 1h ごとに自動的に
> 「次の send が可能」になる (= scheduledAt 変更時の invalidation と
> 同パターン)。

### コンテキスト分岐 (venue 有無)

各 event は **venue 名が分かる** か **分からない** かでコピーを変える:

| Context | 該当する event | 補足 |
|---|---|---|
| **with-venue** | partner_rating_added / partner_note_added / decision_saved | venue 名を含めた「{venueName} に〜」型 |
| **no-venue** | wedding_date_set | 結婚式日は project 単位の節目なので venue 名は出さない |

`partner_note_added` と `partner_rating_added` は venue 必須 (scope =
venueId)。 `decision_saved` も venue 必須 (scope = venueId、 選んだ式場
そのもの)。 `wedding_date_set` は venue 無し (scope = projectId)。

将来 `venueName` が取得失敗した場合の fallback は **with-venue 文の
`{venueName}` 部分を「お選びの式場」に置換する** (送信を止めない —
realtime 体験の鮮度が最優先)。

## Copy 原則 (`docs/copy-lexicon.md` 準拠 + push 特有)

通知は **画面外のユーザーに割り込む surface** なので Lexicon 原則を厳格に
適用する。 `docs/ai/notifications/visit-reminder.md` で確立した規則を
そのまま継承:

- **急かさない**: 「今すぐ」「急いで」禁止
- **売らない**: 「おすすめ」「一押し」禁止
- **ふたり主語**: 「あなたが」→「おふたりで」、 actor は「相手」では
  なく「{partnerName}さん」 or 名前不明時は「相手の方」
- **保存系 → 残す**: 「保存しました」→「残しました」
- **絵文字禁止**: title / body 共に
- **晴れの日メタファー**: 控えめに 1〜2 語 (「光」「晴れ間」「歩き出す」)

### Push 通知の制約 (visit-reminder と共通)

| 場所 | 文字数目安 |
|---|---|
| `title` | 30 全角字以内 (~ 60 半角) |
| `body` | 80 全角字以内 (~ 160 半角) |
| `tag` | `realtime-push:<kind>:<scopeId>` で OS 側 dedupe |

## Copy Table — 確定版 (4 event × 2 context = 8 cell)

各セルは `{ title, body }`。 変数は `{venueName}` / `{partnerName}` のみ。
省略時 fallback 規則は本ドキュメント末尾参照。

### partner_rating_added (with-venue 必須)

| Context | title | body |
|---|---|---|
| **with-venue** | {partnerName}さんの評価が届きました | {venueName}に新しい評価が残されました。 ご一緒に確認してみませんか。 |
| **no-venue** | (該当なし — venue 必須 event) | — |

### partner_note_added (with-venue 必須)

| Context | title | body |
|---|---|---|
| **with-venue** | {partnerName}さんの見学メモが届きました | {venueName}での印象が残されました。 帰り道のメモが、 比べるときの灯りになります。 |
| **no-venue** | (該当なし — venue 必須 event) | — |

### decision_saved (with-venue 必須)

| Context | title | body |
|---|---|---|
| **with-venue** | 式場が決まりました | {venueName}での晴れの日に向けて、 ふたりの準備が始まります。 |
| **no-venue** | (該当なし — venue 必須 event) | — |

### wedding_date_set (no-venue 専用)

| Context | title | body |
|---|---|---|
| **with-venue** | (該当なし — project 単位の event) | — |
| **no-venue** | 晴れの日が決まりました | おふたりの一日まで、 ここから日数を数えていきます。 |

## Variable interpolation 規約

| Variable | 例 | サニタイズ | 取得不能時 fallback |
|---|---|---|---|
| `{venueName}` | 「ガーデンテラス青山」 | `sanitizeForPrompt()` 相当 + 60 字 cap | 「お選びの式場」 |
| `{partnerName}` | 「Yuki」 | trim + 30 字 cap、 HTML strip | 「相手の方」 |

実装時は **必ず venueName / partnerName を sanitize** してから template
組み込み。 URL 取り込み起点の venue 名や、 OAuth display name は
サードパーティ由来 — XSS / prompt injection の発生源になりうる。

## Edge cases

| 状況 | 動作 |
|---|---|
| venue / partner name が null | fallback 文字列に置換、 送信は続行 |
| 同 event が 1h 内に複数回発火 | `PushSendLog @@unique` で 1 通保証 |
| 1h 経過後の同 event | 新しい hour bucket → 再送信 OK |
| User の `notifyXxx` が false | その event のみ skip、 他 event は送る |
| User の `frequency = "off"` | すべて skip (既存仕様、 全 push surface 共通) |
| Actor 自身への通知 | Recipient リストから actor を除外 (B-2 と異なり couple activity は self-ping 不要) |
| Push permission が `denied` | dispatcher は subscription 不在として silent skip |

## アクションボタン (push notification actions)

OS によって表示有無 / 数が異なる。 設計上は最大 2 つ用意:

| Event | action 1 (primary) | action 2 (secondary) |
|---|---|---|
| partner_rating_added | 「評価を見る」 → `/venues/{venueId}` | (なし) |
| partner_note_added | 「メモを見る」 → `/venues/{venueId}#visit` | (なし) |
| decision_saved | 「決定を見る」 → `/journey` | (なし) |
| wedding_date_set | 「カウントダウンを見る」 → `/home` | (なし) |

タップ無しのデフォルト click は **常に action 1 と同じ deep link**。

## i18n (将来)

現状 ja のみ。 visit-reminder.md と同じく Phase 4 で en 列を併設する
2 列構造に拡張、 `pickRealtimeCopy(kind, hasVenue, locale)` シグネチャを
拡張する。

## Lexicon 違反チェックリスト (mechanical)

```bash
# 急かしフレーズ
grep -nE "今すぐ|急いで|お忘れなく|至急" docs/ai/notifications/realtime-push.md

# 売り込み語
grep -nE "おすすめ|一押し|今なら|限定|キャンペーン" docs/ai/notifications/realtime-push.md

# 命令形 (です・ます以外)
grep -nE "してください|して下さい|お願いします" docs/ai/notifications/realtime-push.md

# 絵文字
grep -nP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" docs/ai/notifications/realtime-push.md
```

すべて 0 行であること (本ドキュメント自体の grep 例 / Lexicon 引用は OK)。

## 関連ドキュメント

- 上位設計: `docs/phase3/partner-level-3-design.md` Wave 3.2
- Lexicon: [`docs/copy-lexicon.md`](../../copy-lexicon.md)
- 既存 visit-reminder copy: `docs/ai/notifications/visit-reminder.md` (B-0)
- B-1 PushSubscription / B-2 dispatcher / B-3 settings: 既に着地済み
- AI prompts drift hook: `docs/harness/adr/0006-ai-prompts-drift-detection-via-posttoooluse-hook.md`

## 更新プロトコル

1. コピーを変える前に Lexicon `docs/copy-lexicon.md` を再確認
2. 本テーブルを編集 → 本ドキュメント末尾の grep 4 件を実行 → 全 0 行であること確認
3. `src/lib/push/realtime-copy.ts` を同 PR で同期
4. drift hook が `pairs_with` frontmatter を見て同 PR 検知 → 警告ゼロを確認
5. PR description に「コピー変更があります」を 1 行明記

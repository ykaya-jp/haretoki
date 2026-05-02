# Resend webhook — 運用ガイド (P2 polish)

実 production で数日運用したあと、 ops が日次・週次で叩く想定の SQL 集計を
集約します。 すべて読み取りクエリ; サービス停止やデータ書き換えは一切なし。
`commercial-readiness.md` 第 3.7 項の「webhook 統合」と対になる *運用*
ドキュメントです。

> **対になる設計ドキュメント**
> - 設計判断: [`adr/0009-resend-webhook-and-vercel-botid.md`](adr/0009-resend-webhook-and-vercel-botid.md)
> - 実装: `src/app/api/webhooks/resend/route.ts` + `src/lib/email/delivery.ts` + `src/lib/email/suppression.ts`
> - 関連 cron: `/api/cron/email-suppression-retry` (soft-bounce の自動復活、 7 日)
> - alert route: `p2-email` (連続失敗 / bounce 率異常) と `p3-digest` (単発 bounce 通知)。 詳細は [`sentry-alerts.md`](sentry-alerts.md)

データ取得の前提: psql で Supabase の本番 DB に接続できる admin 権限の
operator が叩く想定です。 PII を含むカラムは `email_hash` 等で hash 済みなので
クエリ結果はそのまま Slack に貼っても OK (raw email は出ない)。

---

## 関連 schema (一覧)

| Table | 役割 |
|---|---|
| `notifications` (`Notification`) | in-app 通知 + Resend 配信状態 (`resend_message_id`, `email_delivery_status`) を保持 |
| `notification_preferences` (`NotificationPreference`) | per-user の email 受信可否 + suppress 理由 (`email_suppressed_reason`, `email_suppressed_at`) |
| `audit_logs` (`AuditLog`) | `webhook.resend.suppression-applied` 等、 webhook が flip した瞬間の記録 |

`email_delivery_status` の取り得る値 (`src/lib/email/delivery.ts` 参照):

```
sent / delivered / delivery_delayed / bounced / complained / opened / clicked
```

`email_suppressed_reason` の取り得る値 (`src/lib/email/suppression.ts` 参照):

```
hard_bounce / complained / soft_bounce / manual
```

---

## 1. 直近 7 日の bounce 率

「過去 7 日間に送ったメールのうち、 bounce / complaint 扱いになった割合」。
Resend dashboard でも見られますが、 自前 DB 側で読むと
**こちらで suppression が走った瞬間まで含めて数えられる** ので
推奨。 業界基準は **bounce ≤ 2%, complaint ≤ 0.1%** (Gmail postmaster
guideline)。

```sql
SELECT
  COUNT(*) FILTER (WHERE email_delivery_status IS NOT NULL) AS sent_total,
  COUNT(*) FILTER (WHERE email_delivery_status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE email_delivery_status = 'bounced')   AS bounced,
  COUNT(*) FILTER (WHERE email_delivery_status = 'complained') AS complained,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE email_delivery_status = 'bounced')
        / NULLIF(COUNT(*) FILTER (WHERE email_delivery_status IS NOT NULL), 0),
    3
  ) AS bounce_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE email_delivery_status = 'complained')
        / NULLIF(COUNT(*) FILTER (WHERE email_delivery_status IS NOT NULL), 0),
    3
  ) AS complaint_pct
FROM notifications
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND resend_message_id IS NOT NULL;
```

**判断:**
- `bounce_pct ≥ 2.0` → ESP の deliverability score 低下リスク。 直近の
  ハードバウンス先を当該 user に通知し、 メール変更を促す動線を
  検討する。
- `complaint_pct ≥ 0.1` → コピー / 頻度が刺さりすぎ。 [`B-3 reminder
  timing settings`](../../src/components/notifications/reminder-timing-settings.tsx)
  でユーザーが timing 単位で off にできるようになっているので、
  集中している timing を一時的に dispatcher 側で無効化することを検討。

---

## 2. suppression 理由別件数 (現役分のみ)

「現在 email がブロックされている user は何人いて、 理由は何か」。
soft_bounce は `email-suppression-retry` cron が 7 日後に自動復活するので、
**7 日経っても残っているもの** は何らかの異常 (cron 失敗 / 永続的な
DNS 問題 / 復活フローのバグ) を示します。

```sql
SELECT
  email_suppressed_reason          AS reason,
  COUNT(*)                         AS active_users,
  COUNT(*) FILTER (
    WHERE email_suppressed_at < NOW() - INTERVAL '7 days'
  )                                AS over_7d,
  COUNT(*) FILTER (
    WHERE email_suppressed_at < NOW() - INTERVAL '30 days'
  )                                AS over_30d,
  MIN(email_suppressed_at)         AS oldest_suppression_at
FROM notification_preferences
WHERE email_suppressed_reason IS NOT NULL
  AND email_enabled = false
GROUP BY email_suppressed_reason
ORDER BY active_users DESC;
```

**判断:**
- `hard_bounce` の `over_30d` が積み上がってきたら、 該当 user に
  「メールアドレスをご確認ください」 in-app banner を出す検討
  (Phase 3 候補)。
- `soft_bounce` の `over_7d > 0` は **cron が動いていない** サイン。
  Vercel cron の `/api/cron/email-suppression-retry` の最近 5 回の
  invocation log を確認 (Vercel dashboard → Cron Jobs → invocation
  history)。

---

## 3. soft-bounce 復活成功率 (過去 30 日)

`email-suppression-retry` cron が flip した user のうち、 その後 60 日
以内に再度 bounce が起きた割合。 高すぎる (≥ 20%) と「7 日 retry は
早すぎ」のサインなので、 cron の interval 拡張を検討。

```sql
WITH revived AS (
  SELECT
    a.target_id                         AS user_id,
    (a.created_at)                      AS revived_at
  FROM audit_logs a
  WHERE a.action = 'webhook.resend.suppression-applied'
    AND a.created_at < NOW() - INTERVAL '7 days'
    AND a.detail->>'flip' = 'soft_bounce_retry_revive'
)
SELECT
  COUNT(*)                                                  AS revived_users,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = revived.user_id
        AND n.email_delivery_status IN ('bounced', 'complained')
        AND n.created_at >  revived.revived_at
        AND n.created_at <  revived.revived_at + INTERVAL '60 days'
    )
  )                                                         AS re_bounced_60d,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = revived.user_id
          AND n.email_delivery_status IN ('bounced', 'complained')
          AND n.created_at >  revived.revived_at
          AND n.created_at <  revived.revived_at + INTERVAL '60 days'
      )
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS re_bounce_pct
FROM revived
WHERE revived_at >= NOW() - INTERVAL '30 days';
```

> NOTE: `webhook.resend.suppression-applied` audit detail の `flip` キーは
> `src/server/webhook/resend/handler.ts` で書き分けています。 `flip` を
> 増やすときは本ドキュメントの WHERE 句も合わせて更新する。

---

## 4. delivery_delayed が 24h 経っても delivered に上がらない hold queue

通常 Resend の `delivery_delayed` は再送が走って 数時間で `delivered` に
flip しますが、 24 時間以上停滞している = 受信側が grey-listing を
こじらせている / 再送試行回数の上限を超えた可能性が高い。 そのまま
放置すると最終的に `bounced` 扱いになるので、 件数を観測。

```sql
SELECT
  resend_message_id,
  user_id,
  type,
  created_at
FROM notifications
WHERE email_delivery_status = 'delivery_delayed'
  AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC
LIMIT 50;
```

> 50 件を超えたら、 当該 hour 帯に Resend 側で何か起きていた可能性。
> Resend の status page (https://status.resend.com/) と相互参照する。

---

## 5. webhook 受信件数 / 種類 (24h)

Resend webhook が **そもそも届いているか** の sanity check。 audit_logs に
`webhook.resend.suppression-applied` が 0 件だと「届いてない」のか
「届いたが suppression に当たらなかった」のか分からないので、
event 受信そのものは `notifications.email_delivery_status` の更新タイム
スタンプから推測します。

```sql
SELECT
  email_delivery_status                            AS status,
  COUNT(*)                                         AS events_24h,
  MIN(created_at)                                  AS earliest,
  MAX(created_at)                                  AS latest
FROM notifications
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND resend_message_id IS NOT NULL
GROUP BY email_delivery_status
ORDER BY events_24h DESC;
```

**判断:**
- `status = sent` のみで他が 0 件 → webhook URL が Resend dashboard 側で
  外れている可能性。 https://resend.com/webhooks で endpoint と
  subscription 設定 (email.{sent,delivered,bounced,...}) を再確認。
- `status = delivered` の `latest` が 1h 以上前 → 配信が止まっている。

---

## 6. 個別 user の delivery 履歴 (サポート対応用)

ユーザーから「メール届かないんですが」と問い合わせが来たときの 1 発目。

```sql
SELECT
  n.created_at,
  n.type,
  n.email_delivery_status,
  n.resend_message_id,
  np.email_enabled,
  np.email_suppressed_reason,
  np.email_suppressed_at
FROM notifications n
LEFT JOIN notification_preferences np
  ON np.user_id = n.user_id
WHERE n.user_id = $1::uuid     -- ← support form の user id を埋める
  AND n.resend_message_id IS NOT NULL
ORDER BY n.created_at DESC
LIMIT 30;
```

**読み方:**
- `email_enabled = false` + `email_suppressed_reason IS NOT NULL`
  → 過去のイベントで suppression に入っている。 reason が
  `hard_bounce` / `complained` なら user 側のメールアドレス問題、
  `soft_bounce` なら 7 日後の自動復活待ち、 `manual` ならユーザー本人が
  /mypage で off にした。
- `email_delivery_status` が 全部 `sent` で `delivered` が無い →
  webhook が届いていない (上記 §5 参照)。

---

## 7. 異常検知のしきい値

定期確認したい数値の目安。 commercial 段階での暫定値。

| 指標 | 通常範囲 | 異常しきい値 | 対応 |
|---|---|---|---|
| 7d bounce_pct (§1) | 0.5% 以下 | 2.0% 以上 | `p2-email` alert + 個別 bounce の中身を確認 |
| 7d complaint_pct (§1) | 0.05% 以下 | 0.1% 以上 | `p2-email` alert + 直近 7d で送った reminder 系の頻度を見直し |
| over_7d soft_bounce (§2) | 0 件 | 1 件以上 | `email-suppression-retry` cron 失敗を疑う |
| 24h hold queue (§4) | 5 件以下 | 50 件以上 | Resend status page 相互参照 |

このしきい値そのものを Sentry alert rule に変換するのは別タスク
([`sentry-alerts.md`](sentry-alerts.md) §"未配線" のところに移管)。

---

## 8. 更新ルール

このドキュメントは **実 prod の運用結果に応じて温度感を更新する**
種類のもの。 7 日 / 30 日運用後に以下を見直す:

1. しきい値が過剰反応していないか (alert fatigue を生んでいないか)
2. 運用してみて欲しくなった追加クエリの追加
3. webhook event 種を新規 subscribe したらカラム / status 値の追記

更新時は本ドキュメントの編集 + ADR-0009 の "運用上の学び" 節への
追記をセットで。

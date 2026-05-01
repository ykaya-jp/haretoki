# Cron Monitoring Playbook

5 つの Vercel Cron entry を定期検査するための手順書。各 cron 反映後 1 サイクル以内に
本ドキュメントの「初回検査」セクションを 1 回回し、以降は週次で「定期検査」を回す。

## 対象 Cron 一覧

| Path | Schedule (UTC) | Schedule (JST 等価) | Phase / 用途 |
|---|---|---|---|
| `/api/cron/generate-rituals` | `0 22 * * *` | 7:00 AM 毎日 | DailyRitual 一括生成 |
| `/api/cron/saved-search-notify` | `0 0 * * *` | 9:00 AM 毎日 | SavedSearch マッチ通知 |
| `/api/cron/decision-followup` | `0 0 * * *` | 9:00 AM 毎日 | 決定 7 日後フォローアップ |
| `/api/cron/visit-reminders-day-before` | `0 10 * * *` | **7:00 PM 毎日** | 翌日見学リマインダー |
| `/api/cron/visit-reminders-morning-of` | `0 23 * * *` | **8:00 AM 翌日** | 当日朝見学リマインダー |

> **重要**: Vercel cron schedule は UTC 解釈。JST 表示は +9h オフセット適用済み。
> JST には DST が無いため year-round 同じ。

## 初回検査 (deploy 後 1 サイクル以内)

### 1. Cron が発火したかを確認

Vercel CLI または Dashboard で runtime logs を確認:

```bash
# day_before cron — 19 JST 後（10 UTC 後）に確認
vercel logs https://haretoki.vercel.app --since 12h | grep "/api/cron/visit-reminders-day-before"

# morning_of cron — 8 JST 後（23 UTC 前日後）に確認
vercel logs https://haretoki.vercel.app --since 12h | grep "/api/cron/visit-reminders-morning-of"
```

期待ログ行 (`visit-reminder-handler.ts` が出力する構造化タグ):

```
[visit-reminder] phase=day_before candidates=N notified=N emailed=N emailFailed=0 errored=0 skipped=N durationMs=NNN
```

### 2. JSON return body の確認

cron route handler は以下の shape で 200 OK を返す:

```json
{
  "ok": true,
  "phase": "day_before" | "morning_of",
  "durationMs": <number>,
  "candidates": <number>,    // 50h 以内に scheduledAt がある visit 数
  "notified": <number>,      // 新規 Notification 行数
  "emailed": <number>,       // Resend 成功数
  "skipped": <number>,       // dedupe / off / window 外などで除外
  "errored": <number>,       // per-visit 例外で Sentry 報告した数 (要 0)
  "emailFailed": <number>    // Resend reject 数 (要 0)
}
```

### 3. Notification 行の dedupe 検証

`Notification.type` は `visit_reminder_${phase}:${visitId}` 形式で per-user
exact-match dedupe するため、以下の SQL で **同一 (userId, type) が 2 行以上**
存在しないことを確認:

```sql
-- 過去 24h で発生した visit_reminder_* 系通知の dedupe 違反検出
-- 期待: 0 行（同一 userId × type は 1 行までが invariant）
SELECT
  user_id,
  type,
  COUNT(*) AS dup_count,
  MIN(created_at) AS first_at,
  MAX(created_at) AS last_at
FROM notifications
WHERE
  type LIKE 'visit_reminder_%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id, type
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;
```

> dup_count が 2 以上の行があれば**実装 bug** — `prisma.notification.count(...)`
> による dedupe が機能していない。`visit-reminder-handler.ts:140` 周辺を確認。

### 4. 配信プロファイル確認

```sql
-- 過去 24h の visit_reminder_* 行を phase 別に集計
SELECT
  CASE
    WHEN type LIKE 'visit_reminder_day_before:%' THEN 'day_before'
    WHEN type LIKE 'visit_reminder_morning_of:%' THEN 'morning_of'
    WHEN type LIKE 'visit_reminder_before_departure:%' THEN 'before_departure (legacy)'
    ELSE 'unknown'
  END AS phase,
  COUNT(*) AS sent_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM notifications
WHERE
  type LIKE 'visit_reminder_%'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY sent_count DESC;
```

期待:
- `day_before` と `morning_of` の 2 phase のみ (Hobby plan 移行で `before_departure` は廃止済)
- `unique_users` <= `sent_count` (1 visit に 2 member 通知が普通)

### 5. メール失敗の有無確認

```sql
-- emailFailed > 0 が出た cron 実行があれば Sentry に記録される。
-- Sentry がまだ繋がっていない環境では Vercel logs を grep:
```

```bash
vercel logs https://haretoki.vercel.app --since 24h | grep "sendEmail failed"
```

期待: 0 件。出ていれば Resend 設定 (RESEND_API_KEY / EMAIL_FROM / domain
verification) を再確認。

## 定期検査 (週次)

### A. Cron 発火数の連続性

過去 7 日で各 cron が **7 回発火している**ことを確認:

```bash
for cron in generate-rituals saved-search-notify decision-followup visit-reminders-day-before visit-reminders-morning-of; do
  count=$(vercel logs https://haretoki.vercel.app --since 7d | grep -c "/api/cron/$cron")
  echo "$cron: $count fires"
done
```

期待: 全 cron 7 (± 1 の clock-skew 許容)。**0 や < 5 は cron schedule 無効化を疑う**
(Vercel project settings の Crons タブで enabled になっているか確認)。

### B. errored / emailFailed の累計

```bash
vercel logs https://haretoki.vercel.app --since 7d | \
  grep "\\[visit-reminder\\]" | \
  awk -F'errored=' '{print $2}' | awk -F' ' '{print $1}' | \
  paste -sd+ - | bc
```

期待: 0 (1 週で errored が累積しているなら Sentry に events が溜まっているはず)。

### C. dedupe invariant の継続

「初回検査 §3」の SQL を `INTERVAL '7 days'` に変えて週次実行。1 行でも
返ってきたら即修正対象。

## 異常パターンと初動対応

| 症状 | 想定原因 | 一次対応 |
|---|---|---|
| ログに cron 行が無い | Vercel cron 無効 / `CRON_SECRET` 不一致 | Vercel project settings → Crons enabled 確認 + env var 確認 |
| `candidates=0` が継続 | 実 visit データなし、または `(status, scheduledAt)` index 未適用 | `EXPLAIN` で index 使用確認 (`docs/harness/runbook.md` index 適用節) |
| `notified > 0` だが `emailed=0` | `RESEND_API_KEY` 未設定 / `isEmailAvailable()` false | Vercel env で `RESEND_API_KEY` を確認、未設定なら設計通り (in-app のみ) |
| `emailFailed > 0` | Resend 側 reject (domain 未 verify / bounce / rate limit) | Sentry の "[visit-reminder] sendEmail failed" event の `error` field を読む |
| `errored > 0` | per-visit 例外 (DB blip / FK violation) | Sentry の "visit-reminder-cron" action event を visitId で検索 |
| dedupe 違反 SQL が行を返す | `Notification.count(...)` の判定漏れ | `visit-reminder-handler.ts:140` の dedupe ロジックを再確認 (race condition の可能性) |

## Bundle Size Baseline (2026-05-02)

参考値 (Next.js 16 Turbopack build):

- `.next/static` 合計: 約 18 MB (compiled + gzipped)
- 最大 client chunk: ~437 KB (vendor 系: react / next runtime / framer-motion / tanstack-virtual)
- 第 2 chunk: ~330 KB
- 第 3 chunk: ~233 KB

mobile-first target (First Load JS ≤ 500 KB) は最大 chunk が単独 load される
worst case でも範囲内。**規模が拡大して 500 KB を超えそうになったら**
`@next/bundle-analyzer` を導入して構成を可視化:

```bash
npm install --save-dev @next/bundle-analyzer
# next.config.ts を分析モード対応にして ANALYZE=true npm run build
```

## 関連ドキュメント

- 実装: `src/server/cron/visit-reminder-handler.ts` / `src/lib/visit-reminders.ts` / `src/lib/email/templates/visit-reminder.ts`
- Cron route handler: `src/app/api/cron/visit-reminders-{day-before,morning-of}/route.ts`
- 設計判断: ADR が起票されていれば `docs/harness/adr/` 配下を参照
- 他 cron との一覧: `vercel.json` の `crons[]`

# Sentry Alerts + Vercel Observability Playbook

商用化フェーズの **アラート設計** と **構造化ログ taxonomy** の SoT。 アプリ側で
`captureError` / `captureMessage` を呼ぶたびに `component` + `alert_route` タグが
セットされ、Sentry 側の Alert Rule がそれを見て **Slack / Email / PagerDuty** に
ルーティングする。 構造化ログは Vercel Log Drain から JSON 単位で query 可能。

最終更新: 2026-05-02 (P2 round 12)

## 設計方針

- **Sentry = 「アラートして欲しい」**: 例外、 SLO 逸脱、 budget overrun
- **Vercel structured logs = 「あとでクエリしたい」**: cron run summary、 cache
  hit rate、 webhook 受信 → ダッシュボードや CSV 出力で集計
- ほとんどの場所は **両方を呼ぶ**: 例えば cron は `logEvent` で per-run summary +
  failure 時に `captureMessage` で alert
- DSN / log drain が未設定の env では両者とも **no-op**、 dev の noise ゼロ

## Sentry アラートタグ taxonomy

`src/lib/sentry.ts` が enforce する 2 つのタグ。 値は型で固定 (新規追加は
`SentryComponent` / `SentryAlertRoute` union と本ドキュメントを同 PR で更新)。

### `component`

| Value | サブシステム | 主な発火元 |
|---|---|---|
| `cron.visit-reminder` | 見学リマインダー cron | `src/server/cron/visit-reminder-handler.ts` |
| `cron.ai-cost` | Anthropic 月次/日次予算 | `src/lib/anthropic-usage.ts` |
| `cron.daily-ritual` | DailyRitual 生成 | `src/server/actions/ritual.ts` |
| `cron.saved-search` | SavedSearch マッチ通知 | `src/app/api/cron/saved-search-notify/` |
| `cron.decision-followup` | 決定 7 日フォロー | `src/app/api/cron/decision-followup/` |
| `webhook.resend` | Resend 配信イベント | `src/app/api/webhooks/resend/route.ts` |
| `botid` | Vercel BotID 検出 | `src/lib/botid.ts` |
| `ai.claude` | Claude SDK 呼び出し | `src/lib/anthropic.ts`, `*Server Actions` |
| `ai.cache` | AiCache / AiAnalysis | `src/lib/ai-cache.ts`, `src/server/ai/cache.ts` |
| `auth` | Supabase auth flow | `src/server/auth.ts`, login/signup |
| `db` | Prisma / Supabase DB | Server Actions の DB write |
| `support` | Support form | `src/app/(auth)/support/` |
| `rate-limit` | rate-limit 越え | `src/lib/rate-limit.ts` の caller |

### `alert_route`

| Value | 意味 | Sentry Alert → fan-out 先 |
|---|---|---|
| `p1-page` | データ消失 / 認証バイパス / 全停止 | Slack `#ops-p1` + PagerDuty (オンコール) |
| `p2-email` | サービス低下 / コスト超過 / 連続失敗 | Slack `#ops` + メール daily digest |
| `p3-digest` | 情報シグナル (bot ブロック、 単発 bounce、 drift) | メール weekly digest のみ |

`p1-page` は「夜中でも起きる」レベル、 `p2-email` は「朝確認」レベル、 `p3-digest`
は「週次振り返り」レベル。 **過剰アラートが noise になり alert fatigue を生む** ので
最初は controlled に。 1 月運用して件数 / 反応速度を見て閾値を調整する。

## イベントカタログ (Vercel Log Drain)

`src/lib/observability.ts` の `LogEventName` union が enforce する。 全イベントが
JSON 1 行として stdout に出るので、 Vercel Log Drain から query 可能。 Vercel
Dashboard の Logs ページでも `event:"<name>"` で filter できる (Hobby plan でも基本
観測 OK、 Drain は Pro 以上)。

| event | 発火元 | 主要 fields | 用途 |
|---|---|---|---|
| `ai_call` | `recordUsage()` (anthropic-usage.ts) | `model`, `inputTokens`, `outputTokens`, `costUsd`, `action` | per-call cost ダッシュボード |
| `ai_cost_summary` | `evaluateBudgetAlert()` (cron) | `dailyUsedUsd`, `dailyBudgetUsd`, `dailyPct`, `monthlyUsedUsd`, `monthlyBudgetUsd`, `monthlyPct`, `shouldAlert` | 日次コストレポート |
| `ai_cache_lookup` | `getCachedResponse()` | `outcome` ("hit" / "miss" / "expired") | hit rate モニタ |
| `ai_analysis_cache_lookup` | `getCachedAnalysis()` | `type`, `outcome` | per-type hit rate |
| `visit_reminder_cron` | visit-reminder-handler | `phase`, `candidates`, `notified`, `emailed`, `emailFailed`, `errored`, `skipped`, `durationMs` | cron 健全性 |
| `resend_webhook` | resend webhook route | `eventType`, `status`, `messageIdPrefix`, `applied` | メール配信プロファイル |
| `botid_block` | `detectBot()` | `scope` | bot 検出ベースライン |
| `rate_limit_exceeded` | rate-limit caller (TBD) | `key`, `windowMs`, `limit` | レート制限プロファイル |
| `support_message` | support form | `channel`, `outcome` | 問い合わせ件数 |
| `user_export` | `/api/user/export` | `bytes`, `bundleSize` | GDPR ポータビリティ利用率 |
| `user_delete` | `/api/user/delete` | `tablesAffected` | 退会数 |

新イベントを足すときは `LogEventName` 型と本テーブルを同 PR で更新。

## 推奨 Sentry Alert Rule (Project Settings → Alerts)

Sentry UI で以下 5 ルールを Set up。 全ルール共通で `Environment: production`、
`Frequency: every event` (event 単位で評価)。

### Rule 1: P1 Page

```
WHEN
  An issue is created
IF
  event.tags.alert_route equals "p1-page"
THEN
  Send a Slack notification to channel #ops-p1
  Send a PagerDuty alert (high urgency)
```

### Rule 2: P2 Digest

```
WHEN
  An issue is created OR an issue's count increases
IF
  event.tags.alert_route equals "p2-email"
THEN
  Send a Slack notification to channel #ops
  Send an email to ops@haretoki.app
```

### Rule 3: P3 Weekly Digest

```
WHEN
  An issue is seen more than 100 times in 1 week
IF
  event.tags.alert_route equals "p3-digest"
THEN
  Send an email to ops-digest@haretoki.app
```

### Rule 4: Cron Cost Overrun (specific)

```
WHEN
  An issue is created
IF
  event.tags.component equals "cron.ai-cost" AND event.level equals "error"
THEN
  Send a Slack notification to channel #ops-budget
  Send a PagerDuty alert (high urgency)
```

### Rule 5: Webhook Signature Anomaly (security)

```
WHEN
  An issue is created
IF
  event.tags.component equals "webhook.resend" AND event.tags.alert_route equals "p1-page"
THEN
  Send a Slack notification to channel #ops-security
```

## Issue Owner / 分担

Sentry の **Project → Settings → Ownership Rules** で以下のように設定:

```
path:src/server/cron/* @ops-team
path:src/app/api/webhooks/* @ops-team @security-team
path:src/lib/botid.ts @security-team
path:src/lib/anthropic*.ts @ai-team
path:src/server/actions/* @backend-team
```

(team handles は Sentry 上で組織する。 1 人開発フェーズではすべて同じ個人で OK)

## Suppression / Noise 制御

| イベント | 抑制ルール | 理由 |
|---|---|---|
| `botid_block` | level=warning、 個別 issue は muted on first occurrence、 weekly digest のみ | 攻撃者は周期的なので 1 件ごとに pager は noise |
| `ai_call` | Sentry には流さない (logEvent のみ) | 1 日数千件出るので Sentry 投入は予算が即死 |
| `visit_reminder_cron` (success path) | 同上 | 毎日 2 回成功で Sentry に行く必要なし |
| `webhook.resend` (event ignored) | level=info で Sentry に流すが alert は p3-digest | 新 event 種を見逃さない一方で fanout 抑止 |

## Local 動作確認

DSN 未設定で `captureError` / `captureMessage` を呼んでも no-op。 構造化ログは
console.info で確認可能:

```bash
# どの logEvent が fire したか
npm run dev
# その後 dev サーバの terminal output を grep:
#   Server log:  {"event":"visit_reminder_cron","phase":"day_before",...}
```

## Vercel Log Drain query 例

Vercel Pro 以上で外部 destination (Datadog / New Relic / 自前 Postgres) に Drain
設定可能。 Hobby は Logs ページで filter のみ。

```bash
# 過去 24h で AI コール数
vercel logs https://haretoki.vercel.app --since 24h | grep '"event":"ai_call"' | wc -l

# AI cache hit rate (round 6 で 47%→78% を target に強化)
vercel logs https://haretoki.vercel.app --since 7d \
  | grep '"event":"ai_cache_lookup"' \
  | jq -r '.outcome' | sort | uniq -c

# visit reminder cron 成功率
vercel logs https://haretoki.vercel.app --since 7d \
  | grep '"event":"visit_reminder_cron"' \
  | jq '{phase,notified,errored,emailFailed}'
```

## 配線後の検証チェックリスト (round 14 audit)

中央 / 開発者が deploy 後に **alert routing が期待通り fire するか** を検証する手順。
1 度通せば以降 alert タグの drift をすぐ発見できる。

### Vercel runtime logs から fire 件数を集計

```bash
# component 別の log 件数 (過去 7 日)
vercel logs https://haretoki.vercel.app --since 7d \
  | grep -E '"event":"(visit_reminder_cron|resend_webhook|botid_block|ai_cost_summary|email_suppression_retry)"' \
  | jq -s 'group_by(.event) | map({event: .[0].event, count: length})'

# alert 発火が集中した時間帯
vercel logs https://haretoki.vercel.app --since 7d \
  | grep '"shouldAlert":true' \
  | jq -r '.event'
```

### 配線済 vs 未配線 を grep で確認

```bash
# 新規追加 component を全部 grep
grep -rn "component:" src/ --include="*.ts" --include="*.tsx" \
  | grep -oE '"[a-z.\\-]+"' | sort -u
```

### Round 12 / round 14 配線レビュー

| Source | 期待 component | 期待 alertRoute | 状態 |
|---|---|---|---|
| `cron.ai-cost` 月次 overrun | `cron.ai-cost` | `p1-page` | ✅ wired (round 12) |
| `cron.ai-cost` 日次 overrun | `cron.ai-cost` | `p2-email` | ✅ wired (round 12) |
| `cron.ai-cost` snapshot upsert fail | `cron.ai-cost` | `p3-digest` | ✅ wired (round 13) |
| `cron.visit-reminder` per-visit error | `cron.visit-reminder` | `p2-email` | ✅ wired (round 12) |
| `cron.visit-reminder` sendEmail fail | `cron.visit-reminder` | `p2-email` | ✅ wired (round 12) |
| `cron.visit-reminder` persist messageId fail | `cron.visit-reminder` | `p3-digest` | ✅ wired (round 12) |
| `cron.email-suppression-retry` failure | `cron.email-suppression-retry` | `p2-email` | ✅ wired (round 14) |
| `webhook.resend` signature invalid | `webhook.resend` | `p1-page` | ✅ wired (round 12) |
| `webhook.resend` apply error | `webhook.resend` | `p2-email` | ✅ wired (round 12) |
| `webhook.resend` admin notice fail | `webhook.resend` | `p3-digest` | ✅ wired (round 14) |
| `webhook.resend` event ignored | `webhook.resend` | `p3-digest` | ✅ wired (round 12) |
| `botid` request flagged | `botid` | `p3-digest` | ✅ wired (round 12) |
| `auth` failures | (legacy shape extras) | — | 🟡 未配線 (低 priority) |
| `db` write failures (decisions / decision-todos / venues / coach / venue-search) | (legacy shape extras) | — | 🟡 未配線 (低 priority) |

未配線の sites は legacy shape (extras only) で動作中、 一切壊れていない。
Component / alertRoute タグを後付けしたい場合は次の round で順次 migrate。

### Sentry alert rule sanity (UI 側)

Sentry → Project → Issues で `alert_route:p1-page` で検索。 過去 7 日で 0 件
であれば「critical event が一度も無かった = 健全」 or 「アラート rule が
期待通り fire していない = 設計ミス」のどちらか。 月 1 回はセルフテスト
推奨 (Sentry UI → Issues → "Send test issue" で `alert_route:p1-page` タグ
付き発火 → Slack #ops-p1 / PagerDuty に着信するか目視)。

## 関連ドキュメント

- 実装: [`src/lib/sentry.ts`](../../src/lib/sentry.ts) + [`src/lib/observability.ts`](../../src/lib/observability.ts)
- Cron monitoring: [`docs/harness/cron-monitoring.md`](./cron-monitoring.md) (cron 個別の異常パターン table)
- AI prompts drift history: [`docs/harness/ai-prompts-drift-history.md`](./ai-prompts-drift-history.md) (drift hook log の集計)
- Commercial readiness: [`docs/harness/commercial-readiness.md`](./commercial-readiness.md) §3.1-3.9 (観測性章)
- ADR: [`docs/harness/adr/0009-resend-webhook-and-vercel-botid.md`](./adr/0009-resend-webhook-and-vercel-botid.md) (webhook + BotID の event 設計)

## 更新ルール

- 新 component 追加 → `SentryComponent` 型 + 本ドキュメントの component table を同 PR
- 新 event 追加 → `LogEventName` 型 + 本ドキュメントのイベントカタログを同 PR
- alert rule 変更 (Sentry UI 側) → 本ドキュメントの「推奨 Sentry Alert Rule」を同 PR
- 1 月運用後の閾値調整 (`p1` / `p2` / `p3` の配分) も本ドキュメントに記録

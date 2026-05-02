# Sentry Alerts — Setup Manual

**作成**: 2026-05-03 (paneA、Phase 4 launch readiness)
**前提 doc**: [`sentry-alerts.md`](./sentry-alerts.md) — タグ taxonomy + Rule 1-5
の pseudo-code 仕様 (これは設計、本 doc は **適用手順**)
**用途**: Sentry project 上に Rule 1-5 を **operator が UI で 1 度だけ手動設定** する
ためのステップバイステップ。Beta launch 前の launch-day-checklist.md T-30 段階で
完了確認するべき項目。

> **読み方**: 上から順に消化する。各 Rule の 5 ステップは `Sentry UI →
> Project Settings → Alerts → Create Alert Rule` の同じ画面遷移を 5 回繰り返す
> 形になる。最後に **動作 verify** (テスト event を送って alert が rotation
> 先に届く) のセクションで終わる。

---

## 0. 前提

- Sentry project は既に作成済 (`SENTRY_ORG=haretoki` + `SENTRY_PROJECT=haretoki-web`)
- 本番 env に `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` が wired
- alert routing 先 (Slack workspace / メール alias / PagerDuty service) は **設定済**
  - `#ops-p1` / `#ops` / `#ops-budget` / `#ops-security` Slack channels
  - `ops@haretoki.app` / `ops-digest@haretoki.app` メール alias
  - PagerDuty service の routing key (P1 用)
- 1 人運用フェーズなら上記 routing 先はすべて **operator 自身の email + DM channel**
  に向けても OK。後で team 編成時に Sentry の Notification Settings で再ルーティング可

---

## 1. Rule 1 — P1 Page (致命的 incident、夜中でも起こす)

### Sentry UI 操作

1. Sentry → 左サイド `Alerts` → 右上 `Create Alert`
2. `What should we alert you about?` で **`Issues`** を選択
3. `Select a project` で **haretoki-web** を選択 → `Set Conditions`
4. 設定:

| 項目 | 値 |
|---|---|
| Environment | `production` |
| When | `An issue is first seen` |
| If (any of) | `The event's tags` → key=`alert_route` → equals → value=`p1-page` |
| Then | `Send a notification to a Slack workspace` → channel=`#ops-p1` |
| Then (もう 1 つ追加) | `Send a notification to PagerDuty` → service=`<PagerDuty service>` urgency=`high` |
| Action interval | `5 minutes` (同じ issue が連続発火しても 5 分以内は重複抑制) |
| Rule name | `[P1] alert_route=p1-page` |

5. `Save Rule`

### 検証

```bash
# Local から 1 度だけ p1-page event を送る (`scripts/sentry-test-fire.ts`
# が無ければ `node` から直接 captureMessage を呼ぶ)
SENTRY_DSN="<本番 DSN>" node -e '
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: "production" });
  Sentry.captureMessage("[setup-test] p1-page route smoke", {
    level: "error",
    tags: { alert_route: "p1-page", component: "auth" },
  });
'
```

#ops-p1 Slack channel に通知が落ちて、PagerDuty incident が作成されることを確認 →
**incident は手動で resolve** (これはテスト発火だったので)

---

## 2. Rule 2 — P2 Digest (サービス低下、朝確認)

### Sentry UI 操作

| 項目 | 値 |
|---|---|
| Environment | `production` |
| When | `An issue is first seen` OR `The issue changes state from resolved to unresolved` |
| If | `The event's tags` → key=`alert_route` → equals → value=`p2-email` |
| Then | `Send a notification to a Slack workspace` → channel=`#ops` |
| Then | `Send a notification via Email` → recipient=`ops@haretoki.app` |
| Action interval | `30 minutes` |
| Rule name | `[P2] alert_route=p2-email` |

### 検証

```bash
SENTRY_DSN="<本番 DSN>" node -e '
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: "production" });
  Sentry.captureMessage("[setup-test] p2-email route smoke", {
    level: "warning",
    tags: { alert_route: "p2-email", component: "cron.ai-cost" },
  });
'
```

ops@haretoki.app に email、`#ops` Slack に通知。

---

## 3. Rule 3 — P3 Weekly Digest (情報シグナル、週次)

### Sentry UI 操作

| 項目 | 値 |
|---|---|
| Environment | `production` |
| When | `An issue is seen more than 100 times in 1 week` |
| If | `The event's tags` → key=`alert_route` → equals → value=`p3-digest` |
| Then | `Send a notification via Email` → recipient=`ops-digest@haretoki.app` |
| Action interval | `1 day` |
| Rule name | `[P3] alert_route=p3-digest` |

### 検証

P3 は閾値発火 (100 events/week) なので即時 fire しない。設定確認のみ:
- Sentry → Alerts → 一覧で Rule 3 が `Active`
- `Conditions` 欄が上記表と一致

---

## 4. Rule 4 — Cron Cost Overrun (特化型)

### Sentry UI 操作

| 項目 | 値 |
|---|---|
| Environment | `production` |
| When | `An issue is first seen` |
| If (all of) | `The event's tags component` → equals → `cron.ai-cost` AND `The event's level` → equals → `error` |
| Then | `Send a notification to a Slack workspace` → channel=`#ops-budget` |
| Then | `Send a notification to PagerDuty` → service=`<PagerDuty service>` urgency=`high` |
| Action interval | `1 hour` |
| Rule name | `[Cron] cost overrun` |

### 検証

```bash
SENTRY_DSN="<本番 DSN>" node -e '
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: "production" });
  Sentry.captureMessage("[setup-test] cron cost overrun smoke", {
    level: "error",
    tags: { component: "cron.ai-cost", alert_route: "p1-page" },
  });
'
```

`#ops-budget` Slack + PagerDuty incident。

---

## 5. Rule 5 — Webhook Signature Anomaly (security)

### Sentry UI 操作

| 項目 | 値 |
|---|---|
| Environment | `production` |
| When | `An issue is first seen` |
| If (all of) | `The event's tags component` → equals → `webhook.resend` AND `The event's tags alert_route` → equals → `p1-page` |
| Then | `Send a notification to a Slack workspace` → channel=`#ops-security` |
| Action interval | `5 minutes` |
| Rule name | `[Sec] webhook signature anomaly` |

### 検証

```bash
SENTRY_DSN="<本番 DSN>" node -e '
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: "production" });
  Sentry.captureMessage("[setup-test] webhook signature smoke", {
    level: "error",
    tags: { component: "webhook.resend", alert_route: "p1-page" },
  });
'
```

`#ops-security` Slack。

---

## 6. Project-level 設定

5 Rule を作った後、project 全体の Notification 設定を 1 度だけ確認:

### Sentry UI: Settings → Project → Alerts → Issue alerts

- [ ] **Default Alert Rule** が無効化されている (= Sentry の組み込み「new issue」
  全体通知。Rule 1-5 と被るので止める)
- [ ] **Quota Notifications** が ops@haretoki.app に届く (event quota の 80% / 100% 通知)

### Sentry UI: Settings → Project → Performance

- [ ] `Apdex Threshold` = 300ms (default)
- [ ] **Performance alerts** は **launch 後 1 週間は OFF** にする (baseline 取得 →
  実数値で threshold を切るのが順序)

### Sentry UI: Settings → Project → Inbound Filters

- [ ] `Filter out events from legacy browsers` ON (古い Safari からの noisy event
  を除外)
- [ ] `Filter out events from web crawlers` ON
- [ ] `Custom IP allow-list` 空のまま (本番 IP を絞る運用は後)

---

## 7. Ownership Rules (任意、team 運用時のみ)

1 人運用フェーズではスキップ。team 化したら `sentry-alerts.md` § Issue Owner /
分担 の path-based ownership ルールを Sentry → Settings → Project → Ownership
Rules に貼る:

```
path:src/server/cron/* @ops-team
path:src/app/api/webhooks/* @ops-team @security-team
path:src/lib/botid.ts @security-team
path:src/lib/anthropic*.ts @ai-team
path:src/server/actions/* @backend-team
```

---

## 8. 設定後の最終確認 (launch-day-checklist.md と連動)

- [ ] `Sentry → Alerts` に **5 ルール表示**:
  - `[P1] alert_route=p1-page` (Active)
  - `[P2] alert_route=p2-email` (Active)
  - `[P3] alert_route=p3-digest` (Active)
  - `[Cron] cost overrun` (Active)
  - `[Sec] webhook signature anomaly` (Active)
- [ ] 上記 5 つの **smoke event を 1 度ずつ発射** → 想定 routing 先で受信
- [ ] **smoke event を Sentry UI で `Resolved` にマーク** (test 由来の noise を消す)
- [ ] launch-day-checklist.md の "T-30 → Sentry alert routing 確認" 行を ✅

---

## 9. 既存 alert rule の bulk export / import (将来の作業)

operator が Sentry project を別 org に移すか、staging 環境を新設するときに本 doc
の作業を毎回繰り返さないように、**Sentry REST API で rule を bulk export → import**
できる。今 round では実装しない (1 人運用 + 単一 production project では over-engineering)
が、参考まで:

```bash
# Export — current rules dump
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/rules/ \
  > sentry-rules-snapshot.json

# Import — bulk POST (要 schema validation、Sentry の internal type に合わせる必要)
# 詳細は https://docs.sentry.io/api/projects/create-an-issue-alert-rule/
```

将来 staging を立てるときは `scripts/bootstrap-sentry-alerts.ts` を用意してこの
flow を 1 行で回せるようにする。それまでは本 doc 沿いに UI で手動設定。

---

## 関連ドキュメント

- `docs/harness/sentry-alerts.md` — Rule 設計の SoT (本 doc は適用手順)
- `docs/release/launch-day-checklist.md` § T-30 — Sentry alert wiring 確認
- `src/lib/sentry.ts` — タグ taxonomy enforcer
- `docs/harness/runbook.md` — 緊急時の triage 手順

---

## 履歴

- 2026-05-03 (paneA、Phase 4 launch readiness): 初版

# Phase 5 — Observability Tier 2 (APM)

「晴れ時 (Haretoki)」 で **Phase 5 候補** として検討する Application
Performance Monitoring (APM) 層の比較ドキュメント。 Phase 4 で
Sentry (= errors + 警告) は既に動いているが、 **request-level
レイテンシ** / **DB query タイミング** / **per-route bottleneck** を
継続的に観測する仕組みは未導入。

本ドキュメントはコードを書く前段階の **方針合意** を目的とする。

最終更新: 2026-05-04 (Phase 4 完了タイミングで起草、 着手は Phase 5)

> **対になるドキュメント**
> - 既存検知層: [`../harness/sentry-alerts.md`](../harness/sentry-alerts.md)
> - on-call 段階モデル: [`../harness/on-call-rotation.md`](../harness/on-call-rotation.md)
> - launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)
> - business KPI 設計: [`../business/churn-prediction-model.md`](../business/churn-prediction-model.md)

---

## 1. なぜ APM が必要か

Phase 4 までに揃ったもの:

- ✅ **エラー検知**: Sentry が auth / cron / push 失敗を p1/p2/p3 にルーティング
- ✅ **長期 KPI**: /admin/metrics + /api/cron/monthly-report で MAU /
  funnel / 課金前提
- ✅ **ヘルス**: /admin/health で Supabase / Vercel / Anthropic / Resend
  の生死 + storage usage
- ✅ **コスト**: /admin/cost で Anthropic / push activity の rolling 集計

**揃っていないもの**:

- ❌ **per-request latency** — どのページが遅いか経時的に追えない
- ❌ **DB query スパン** — N+1 が発生したか、 prisma が slow query を
  履いたかの可視性ゼロ (= Sentry breadcrumb で見えるのは error 時のみ)
- ❌ **distributed tracing** — Vercel Function → Supabase → Anthropic
  の dependency chain で「どこで時間が溶けたか」 が分からない
- ❌ **frontend perf real-user metrics** — Web Vitals は Vercel
  Analytics で見えるが、 ユーザー操作 → response の時間軸統合がない

これらを埋めるのが APM = Tier 2 観測層。

---

## 2. 評価軸

### 2.1 4 軸 (= 重み付き)

| 軸 | 重み | 説明 |
|---|---|---|
| **コスト** | 高 | Beta スケールでは月 $0-50 が許容、 GA で月 $200 程度まで |
| **Vercel + Next.js 互換性** | 高 | App Router / Edge Runtime / Cache Components / 我々の stack で動く前提 |
| **観測の深さ** | 中 | DB query span / external HTTP / コード行レベル / RUM |
| **セットアップの簡便さ** | 中 | Beta 期 1 人開発 → 2 日以内に install + 値が出る前提 |

### 2.2 評価しないこと (= scope 外)

- log 集中管理 (= Vercel Log Drains で十分)
- security observability (= Sentry の component=auth + audit_logs で十分)
- インフラ監視 (= Vercel + Supabase の dashboard で十分)

---

## 3. 候補

### 3.1 Datadog APM

- **コスト**: $31/host/month (= 1 host minimum)、 加えて trace 量で従量
  → Beta で **月 $50 〜 $100** 想定、 GA で **月 $200+**
- **Vercel/Next 互換**: Vercel Marketplace integration あり、 Next 14+
  の App Router で動作確認済 (Datadog 公式 docs)
- **観測の深さ**: ⭐⭐⭐⭐⭐ — DB query span (Prisma)、 external HTTP、
  RUM、 dependency map、 全部入り
- **セットアップ**: ⭐⭐⭐ — Vercel Marketplace から数クリック、
  ただし dashboard 学習コスト 中

### 3.2 New Relic APM

- **コスト**: 個人 dev tier 100 GB/月 まで無料 — Beta 期は
  **無料で済む可能性高**、 GA で **月 $99-$200** 想定
- **Vercel/Next 互換**: 公式 Next.js integration あり、 instrumentation 軽
- **観測の深さ**: ⭐⭐⭐⭐ — DB query span、 RUM、 alert ルール柔軟
- **セットアップ**: ⭐⭐⭐ — UI が改善されたが Datadog より学習コスト高
  (= 機能多すぎて Beta 規模で持て余す)

### 3.3 Sentry Performance (= Sentry の APM 拡張)

- **コスト**: 既存 Sentry プランに含まれる、 transaction 100k/月 まで
  無料 → Beta で **追加コスト 0**、 GA で transactions が増えれば
  **月 $26-$80**
- **Vercel/Next 互換**: ⭐⭐⭐⭐⭐ — `@sentry/nextjs` で既に動いている
  Sentry SDK にフラグを足すだけ
- **観測の深さ**: ⭐⭐⭐ — request-level + DB query (= prisma
  instrumentation あり)、 RUM (= 別 SDK)、 distributed trace あり
- **セットアップ**: ⭐⭐⭐⭐⭐ — **既存 Sentry config の数行追加** で
  動く、 学習コスト最小

### 3.4 Grafana Cloud (Loki + Tempo + Prometheus)

- **コスト**: Free tier ($0、 50 GB logs / 50 GB metrics / 100 GB
  traces 月)、 Pro $19/月以降 → Beta 期は **無料**、 GA で **月
  $50-$100**
- **Vercel/Next 互換**: ⭐⭐⭐ — OpenTelemetry 経由で Vercel Functions の
  trace を流す、 設定の手数 中
- **観測の深さ**: ⭐⭐⭐⭐ — OTel エコシステムなのでベンダーロックイン低、
  custom metrics の自由度高
- **セットアップ**: ⭐⭐ — OpenTelemetry collector の設定が学習コスト高、
  Beta 期 1 人開発で 2 日では入らない

### 3.5 OpenTelemetry self-host (= 完全自前)

- **コスト**: 自前ホスト料金のみ、 月 **$10-$30** (Vercel Function 内に
  collector はキツい → 別 worker)
- **Vercel/Next 互換**: ⭐⭐⭐ — 同上
- **観測の深さ**: ⭐⭐⭐⭐⭐ — custom 自由
- **セットアップ**: ⭐ — 1 人開発の Beta 期に手を出すと 2 週間
  消えるレベル、 完全に却下

---

## 4. 比較表 (= TL;DR)

| | Datadog | New Relic | **Sentry Performance** | Grafana Cloud | OTel self-host |
|---|---|---|---|---|---|
| Beta コスト | $50-$100/月 | $0 | **$0** | $0 | $10-$30/月 |
| GA コスト | $200+/月 | $99-$200/月 | **$26-$80/月** | $50-$100/月 | $30-$100/月 |
| Vercel/Next 互換 | ✅ | ✅ | **✅✅** | ⚠️ OTel 経由 | ⚠️ OTel 経由 |
| 観測の深さ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| セットアップ | ⭐⭐⭐ | ⭐⭐⭐ | **⭐⭐⭐⭐⭐** | ⭐⭐ | ⭐ |
| 既存ツール再利用 | ❌ 別 SDK | ❌ 別 SDK | **✅ 既存 Sentry** | ❌ 新規 | ❌ 新規 |

---

## 5. 推奨

### 5.1 段階移行プラン (= [`on-call-rotation.md`](../harness/on-call-rotation.md) §2.3 と整合)

| 段階 | APM | 月額追加 | 主な得るもの |
|---|---|---|---|
| **0. Beta-private (現状)** | なし | $0 | — |
| **1. Closed Beta (10-20 名)** | **Sentry Performance** にフラグ ON | $0 (= 既存無料 quota 内) | request latency 経時、 DB span |
| **2. Open Beta cut1 (50 名)** | Sentry Performance + Sentry RUM SDK | $0-$26 | front + back を一画面で |
| **3. Open Beta cut2 (200 名)** | Sentry Performance pro tier | $26-$80 | sample rate 上げる、 alert ルール拡張 |
| **4. GA (1000 DAU)** | Sentry Performance + 必要に応じて Datadog 検討 | $80 + (Datadog 検討) | 大規模 dependency map / SLO 表明 |

### 5.2 第 1 候補 = Sentry Performance、 理由

- 既に `@sentry/nextjs` が動いていて、 **数行の config 追加で APM が
  立ち上がる** = 1 人開発の Beta 期に 学習コストを払わなくていい
- transaction 100k/月 までは追加コスト ゼロ → Closed Beta cut1 規模
  なら確実に無料枠内
- alert taxonomy が Sentry alert (`p1-page` / `p2-email` /
  `p3-digest`) と統一できる → on-call が同じ受信経路で APM signal も
  受け取れる ([`sentry-alerts.md`](../harness/sentry-alerts.md))
- DB query span は Prisma instrumentation で取れる ✅
- distributed trace (= Vercel Function → Supabase → Anthropic chain)
  も取れる ✅
- 観測の深さで Datadog に劣る部分 = custom dashboard の自由度。
  Beta スケールでは preset で十分

### 5.3 段階 4 (GA) で Datadog を検討する trigger

- DAU 1000 超え + APM 月額 $80 を超えるトランザクション量
- 課金プラン導入 → 顧客 SLA 表明 → distributed trace の dependency map
  で「我々のせいか / 上流のせいか」 を即時切り分ける必要が出る
- **Sentry Performance で困った具体例が出ている** (= 「dashboard が
  柔軟性足りない」 等の実問題) — 困っていないなら移行 ROI 不明

---

## 6. Sentry Performance 着手プラン (= Phase 5.1 候補)

### 6.1 タスク (= 1-2 日)

- [ ] `sentry.client.config.ts` / `sentry.server.config.ts` で
      `tracesSampleRate: 0.1` (= 既存値) を確認、 Performance enable
- [ ] Prisma instrumentation を `@sentry/nextjs` integration に追加
      (= `Sentry.prismaIntegration({ client: prisma })` 1 行)
- [ ] external HTTP instrumentation を Anthropic / Resend / Supabase
      の各クライアントに wire (= fetch wrapper 2 〜 3 箇所)
- [ ] sentry.io dashboard で Transaction 一覧が出ることを確認
- [ ] 主要 server action 5 件 + 主要 page 5 件で span が見えることを
      実 prod で確認
- [ ] Sentry の Performance alert ルールを 3 件 set:
    - "p99 latency > 5s for any route" → p2-email
    - "DB query > 2s on any single transaction" → p3-digest
    - "Anthropic call > 30s" → p2-email
- [ ] 本ドキュメント §5.1 の段階 1 を「実装済」 に update + ADR 切る

### 6.2 観測トリガー = いつ着手するか

- [ ] Open Beta cut1 (= 50 名規模) に入ろうとしている (= データ量が
      意味ある statistics になる規模)
- [ ] ユーザーから「アプリ重い」 のフィードバックが来始める (= 本来
      欲しい signal、 これが来てから着手で十分)
- [ ] Sentry の既存 errors-only ダッシュボードでは遅延の根本原因が
      特定できないケースが 1 件以上発生

---

## 7. 着手判断 (= ALL met)

```
- [ ] beta-launch-plan.md の Closed Beta cut1 に着地済み
- [ ] Sentry の現プラン (= 無料枠 or 既存有償) で transaction quota
      が足りる見込み
- [ ] APM data の見方を学ぶ時間 (= 半日) を確保できる
- [ ] 着手後の "問題未発見でも継続" コスト ($0-$80/月) を許容
```

上記 4 つが揃わない限り着手しない。 Beta 段階で APM を入れたが
「眺めるだけで何もしない」 状態は無駄。

---

## 8. 関連ドキュメント

- 既存検知 alert taxonomy: [`../harness/sentry-alerts.md`](../harness/sentry-alerts.md)
- on-call 段階モデル: [`../harness/on-call-rotation.md`](../harness/on-call-rotation.md)
- launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)
- DR drill: [`../harness/dr-drill-plan-2026-Q3.md`](../harness/dr-drill-plan-2026-Q3.md)
- Phase 5 上位 churn 予測: [`../business/churn-prediction-model.md`](../business/churn-prediction-model.md)
- Sentry 公式 Performance docs: https://docs.sentry.io/product/performance/

---

## 9. 更新ルール

- 各 APM の pricing が変わったら §3 を refresh (年 1 回程度)
- Sentry Performance を着手したら §6 の checkbox を完了にする + ADR
  切って本ドキュメントを decouple
- Datadog 検討段階に到達したら §5.3 trigger を実例と照合 + 本セクションを
  詳細化
- 別の APM 候補 (= 新ベンダー登場) があれば §3 に追加 + §4 比較表 update

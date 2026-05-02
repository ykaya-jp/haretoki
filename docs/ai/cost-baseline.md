# Anthropic Cost Baseline + Operations

Anthropic API spend を「日次で見る / 月次で alert する / dashboard で振り返る」
ための運用ガイド。 商用化フェーズの cost predictability を担保する SoT。

最終更新: 2026-05-02 (P2 round 13、 cost dashboard skeleton + Upstash Redis backend)

## 構成

3 レイヤーで spend を追跡する:

1. **per-call** (`event:"ai_call"`): `recordUsage()` から structured log。
   `src/lib/anthropic-usage.ts` の in-memory bucket に accumulate。
2. **daily summary cron** (`/api/cron/ai-cost-summary`): 24h + 30d window
   で `AiCache` / `AiAnalysis` / `Estimate` の row 数 × per-model 平均
   token から spend を推定 → `evaluateBudgetAlert()` が Sentry に
   captureMessage、 `event:"ai_cost_summary"` を log、 **
   `AiCostSnapshot` table に row 1 件を upsert**。
3. **dashboard** (`/admin/cost`): 直近 30 snapshot を読んで table 表示。
   `requireAdmin()` で `ADMIN_EMAILS` env のリストにある email のみ
   アクセス可。 それ以外は `notFound()` で 404 (admin の存在自体を隠す)。

## 環境変数

| Var | 用途 | 例 |
|---|---|---|
| `ANTHROPIC_DAILY_BUDGET_USD` | 日次予算 (USD)、 超過で Sentry warning | `5` |
| `ANTHROPIC_MONTHLY_BUDGET_USD` | 月次予算 (USD)、 超過で Sentry error | `100` |
| `CRON_SECRET` | cron 認証 | `openssl rand -hex 32` |
| `ADMIN_EMAILS` | `/admin/*` page 入場可の email リスト (comma 区切り) | `you@haretoki.app` |
| `UPSTASH_REDIS_REST_URL` | rate-limit Redis backend (なければ in-memory) | Upstash console から |
| `UPSTASH_REDIS_REST_TOKEN` | 同上 token | 同上 |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry 性能トレース sampling (0.0-1.0、 default 0.1) | `0.1` |

## 観測 surface

### A. Vercel structured logs (Hobby OK)

`logEvent({ event: "ai_call", ... })` 由来の JSON 1 行が stdout に出る。
Vercel Logs ページで `event:"ai_call"` filter、 または CLI:

```bash
# 過去 24h の AI コール数 + total cost
vercel logs https://haretoki.vercel.app --since 24h \
  | grep '"event":"ai_call"' \
  | jq '[.costUsd] | add'

# 過去 24h で最もコストが高い action
vercel logs https://haretoki.vercel.app --since 24h \
  | grep '"event":"ai_call"' \
  | jq -s 'group_by(.action) | map({action: .[0].action, calls: length, totalUsd: ([.[].costUsd] | add)})'

# 過去 7d の cache hit rate
vercel logs https://haretoki.vercel.app --since 7d \
  | grep '"event":"ai_cache_lookup"' \
  | jq -s 'group_by(.outcome) | map({outcome: .[0].outcome, count: length})'

# 直近の cost summary cron 実行
vercel logs https://haretoki.vercel.app --since 7d \
  | grep '"event":"ai_cost_summary"' \
  | jq '{dailyUsedUsd, dailyPct, monthlyUsedUsd, monthlyPct, shouldAlert}'
```

### B. /admin/cost dashboard

Vercel Hobby でも動く UI。 `ADMIN_EMAILS` に自分の email を追加 (Vercel
env or `.env.local`) して `/admin/cost` にアクセス。

表示内容:
- Latest snapshot card (日次 / 月次 / alert 状態)
- 直近 30 snapshot の table (アラート行は赤背景)
- Latest dailyByBucket detail (haiku / sonnet / sonnet-pdf 別)
- 現在の rate-limit backend (in-memory / redis)

### C. Sentry alerts

`docs/harness/sentry-alerts.md` のルーティングテーブルが SoT。 cost 関連:
- `cron.ai-cost` × `error` (月次超過): **p1-page** → PagerDuty
- `cron.ai-cost` × `warning` (日次超過): **p2-email** → Slack #ops
- `cron.ai-cost` × `p3-digest` (snapshot upsert 失敗): weekly digest

### D. AiCostSnapshot table 直接 query

```sql
-- 直近 30 日の spend
SELECT snapshot_date, daily_used_usd, daily_budget_usd, monthly_used_usd, should_alert
FROM ai_cost_snapshots
ORDER BY snapshot_date DESC
LIMIT 30;

-- 過去 30 日のうち alert tripped した日
SELECT snapshot_date, daily_used_usd, monthly_used_usd
FROM ai_cost_snapshots
WHERE should_alert = true
  AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY snapshot_date DESC;

-- per-bucket aggregate (last 7 days)
SELECT
  jsonb_object_keys(daily_by_bucket) AS bucket,
  SUM((daily_by_bucket->jsonb_object_keys(daily_by_bucket)->>'estCostUsd')::numeric) AS total_usd,
  SUM((daily_by_bucket->jsonb_object_keys(daily_by_bucket)->>'calls')::int) AS total_calls
FROM ai_cost_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY 1
ORDER BY 2 DESC;
```

## 推定方式の前提と既知の限界

1 call あたりの token 数は **過去ログから観測した平均** (sample week 2026-04):

| Bucket | model | input avg | output avg | 用途 |
|---|---|---|---|---|
| haiku | claude-haiku-4-5 | 5,000 | 800 | coach / fit-reason / ritual / vibe / matrix-insight / url-extract |
| sonnet | claude-sonnet-4-6 | 2,000 | 1,500 | onboarding / comparison / review-summary |
| sonnet-pdf | claude-sonnet-4-6 (document-block) | 12,000 | 2,500 | estimate-extract |

**正確な finance ledger ではない**。 30% 程度の drift は許容、 真の total
spend は **Anthropic admin dashboard** が SoT。 cron は budget guardrail
としての用途 (「今日急に $3 → $50 に跳ねた」を検出する仕組み)。

drift 観測手段:
- Per-call `event:"ai_call"` ログには **実 inputTokens / outputTokens** が
  記録されている (Anthropic SDK の usage 返却値)
- `MODEL_AVG_TOKENS` 定数 (cron route 中) と実 log の中央値が乖離していたら
  定数を bump。 PR で同 commit に doc 反映

## 1 ヶ月運用後のチューニング 

下記を 1 ヶ月後に振り返り、 必要なら数値見直し:

1. `ANTHROPIC_DAILY_BUDGET_USD` / `MONTHLY_BUDGET_USD` の妥当性
   (alert が毎日 trip / 1 度も trip しない、 どちらも noise)
2. Per-model 平均 token の drift (上記方法で監査)
3. `AiCostSnapshot` の retention (1 年後に 365 行、 容量問題なし。 5 年で
   1825 行、 まだ trivial。 削除 cron は最低 5 年後で OK)
4. /admin/cost の 30 行 table が too narrow / wide ではないか

## Round 15 (2026-05-02) — Forecast + cache-hit-rate 拡張

`/admin/cost` に 2 セクション追加:

1. **Month-end forecast** — 過去 7 日 (window) の `dailyUsedUsd` 平均を月末
   までの remaining-days に乗じた線形予測。`forecastMonthlyCostUsd()` を
   `src/lib/anthropic-usage.ts` に追加。式:
   ```
   forecast = monthToDateUsd + trailingDailyAvgUsd × remainingDays
   pace = forecast/budget ≤80% → "under" / 80-110% → "watch" / >110% → "over"
   ```
   `windowDays` は引数で上書き可 (default 7)、`now` も override 可 (test 用)。
   月末日数は UTC 計算 (JST host で 1 日ずれる罠あり、tests でカバー)。

2. **Estimate-PDF cache hit rate (24h, approx)** — 過去 24h の
   `estimate (sourceType=ai_extracted) row count − aiCache (model=sonnet)
   write count ≈ cache hits`。Signed-URL fallback も AiCache に書くため、
   files-api / signed-url の tier 内訳までは出せない (tier 別の counter は
   structured log `event:"estimate_extract_tier"` を log drain でパースする
   future task)。

### Cache 統合 (round 15)

`reviews.ts` (review-summary) と `venues.ts` (url-extraction) の cache 経路を
低水準 `computeInputHash + getCachedResponse + askClaude + setCachedResponse`
4 ステップから `cachedAskClaude({system, userMessage, model, maxTokens,
promptVersion})` 1 ステップに統合。hash recipe が
`{system, user, model, version, maxTokens}` に揃うので model swap / prompt
revision が **自動 cache buster** として効く。`REVIEW_SUMMARY_PROMPT_VERSION`
+ `URL_EXTRACTION_PROMPT_VERSION` を caller side で 1 から開始。

→ 旧 hash recipe の cache row (`{system, user}` のみ) は miss 扱いで自然に
   evict される。一時的に Claude call 増 (24h で settle)。

## 関連ドキュメント

- 実装: `src/lib/anthropic-usage.ts` (per-call accounting + budget evaluation + month-end forecast)
- Cron: `src/app/api/cron/ai-cost-summary/route.ts`
- Dashboard: `src/app/admin/cost/page.tsx`
- Schema: `prisma/schema.prisma` `AiCostSnapshot`
- Sentry routing: `docs/harness/sentry-alerts.md`
- Cron monitoring (cost cron 含む全 cron 監視): `docs/harness/cron-monitoring.md`
- Models 一覧: `docs/ai/models.md`

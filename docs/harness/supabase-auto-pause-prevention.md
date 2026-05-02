# Supabase auto-pause — prevention & recovery

「晴れ時 (Haretoki)」 の本番 DB / Auth / Storage は Supabase free-tier。
このプランは **7 日間 inbound traffic がない** と project を auto-pause
し、 復旧するまで **すべての API 応答が "Invalid API key"** になります。
本ドキュメントは 2026-05-03 に発生した実 incident をふまえた:

1. 何が起きたかの retrospective
2. 症状の見分け方 (Sentry / log / 実 prod URL)
3. 復旧手順
4. 再発防止策 (daily ping cron / Pro 移行判断)

を集約したものです。 auto-pause 関連で何か起きたら、 まずここを読む。

最終更新: 2026-05-03 (incident retrospective)

> **対になるドキュメント**
> - `/admin/health` 1 view monitor (`src/app/admin/health/page.tsx`)
> - 防止 cron: `/api/cron/supabase-health` (`src/app/api/cron/supabase-health/route.ts`)
> - 純粋 helper: `src/lib/health-check.ts`
> - 関連 alert routing: [`sentry-alerts.md`](sentry-alerts.md)
> - Beta launch rollback flag 一覧: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md) §5

---

## 1. 2026-05-03 incident retrospective

### タイムライン (JST)

| time | event |
|---|---|
| ~ T-7 days | 最後の本番 inbound traffic (cron 以外の人由来 traffic 無し) |
| 2026-05-03 17:13 | user が prod を訪問 → 真っ白画面 |
| 2026-05-03 17:13-17:16 | Supabase auto-pause 状態、 すべての auth 呼び出しが `AuthApiError: Invalid API key` で失敗 |
| 2026-05-03 17:16 | user が Supabase dashboard で Restore action (推定) または free-tier 自動復帰 |
| 2026-05-03 17:34 | prod 200 OK + landing render 確認、 完全復旧 |

ユーザー影響: 約 3 分間 prod が完全に落ちていた。 影響ユーザー数は
不明 (Beta 前なので少なくとも作者本人 + 妻のみ確実、 他に landing
を踏んだ visitor がいた可能性)。

### 根本原因

Supabase free-tier の auto-pause:

- 7 日連続で inbound traffic (REST / Auth / Realtime / Storage) が
  無いと、 project が PAUSED 状態に入る
- PAUSED 状態の project は **API key そのものが無効** として扱わ
  れる (= rotate されたわけではないが、 認証が一律に拒否される)
- 復旧は dashboard の "Restore project" で 1-3 分

なぜ traffic が途絶えたか:

- daily cron は **すべて Vercel→ 自分自身** で完結する処理 (visit-
  reminder / ai-cost-summary / data-retention-sweep / など) で、
  **どれも Supabase REST に inbound しない**
- `email-suppression-retry` のような cron も Prisma (= PgBouncer 経由
  pooler) で Supabase Postgres には触るが、 free-tier の auto-pause
  カウンタは **REST API + Auth API への inbound** を見ているらしい
  (Supabase docs に明文化されてはいないが、 incident 後の Restore
  ボタンを押した直後に traffic counter が 0 から再開した観察事実から
  推定)
- 妻 + 作者しか訪問しない Beta 前期間は、 7 日 inactivity が容易に
  発生する

---

## 2. 症状の見分け方

auto-pause を疑うときに最初に見るもの。 **真っ白画面** + 以下のどれか
が当てはまれば auto-pause の確度が高い。

### Sentry

- `AuthApiError: Invalid API key` が **複数 user 同時** に発火
- `component=auth` のエラーが直近 1 分で N 件以上
- Vercel cron `cron.health` が `level=warning` で degraded / failed を
  報告 → 直近の daily ping 結果

### Vercel logs

- ルート (/) 含む multiple route で `500` が連発
- `/api/auth/*` (Supabase client が裏で叩く endpoint) で 401 / 403
  が連発

### 実 prod URL

- `curl -I https://haretoki.app/` → 500 / 503
- `curl -I https://<project>.supabase.co/rest/v1/` → 401 + body に
  `Invalid API key`

### `/admin/health`

- Supabase 行が **failed** になっており、 latency / status code が
  401 〜 503

> **Tips**: Supabase dashboard を開かなくても、 `/admin/health` 1 view
> でほぼ判別できる。 アクセス権がない場合は `curl -I` 2 行目を読む。

---

## 3. 復旧手順 (5 分)

3 ステップ。 順番が重要 (最後の verify を飛ばすと "復旧したつもり"
が増える)。

### 3.1 Restore

1. https://supabase.com/dashboard にログイン
2. Haretoki project (本番) を開く
3. 上部に "This project has been paused" のバナーが出ていれば、
   **Restore project** ボタンをクリック
4. 1-3 分待つ (status が "Active" になるまで)

> バナーが出ていない (= 自動復帰した、 もしくは別の問題) ときは §4 へ。

### 3.2 API key の rotate チェック

Supabase は restore 直後に **API key を回さない**(2026-05-03 観察)。
ただし将来仕様が変わる可能性があるので、 念のため確認:

1. dashboard → Settings → API
2. `anon public` key と `service_role` key を表示
3. Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   と完全一致するかを目視
4. **一致しない場合のみ**:
   - Vercel dashboard → Settings → Environment Variables
   - 該当 var を update → "Redeploy" を選択
   - 完全反映まで 1-2 分

### 3.3 verify

最後に **2 surface** で実通信を確認:

```bash
# 1. landing 200 OK + HTML
curl -s -o /dev/null -w "%{http_code}\n" https://haretoki.app/

# 2. Supabase auth health 200
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  https://<project-ref>.supabase.co/auth/v1/health
```

両方 200 が出れば復旧確定。 `/admin/health` も再 load して
Supabase 行が "ok" / 緑バッジに戻っていることを目視。

---

## 4. 復旧できない場合 (Restore してもダメ)

ここまで来ると Supabase 側の本格的なインシデント / 課金 / 設定問題
の疑いが強い。 順に試す:

| symptom | likely cause | action |
|---|---|---|
| Restore ボタンが grey out | Free-tier Project Limit に到達 (account に > 2 active project がある) | 不要な project を pause / delete |
| Restore 後も 401 が続く | API key rotate された (極稀) | §3.2 の env update + redeploy |
| Restore 後も 5xx が続く | DB schema 内のデータが破損 | migration history を `npx prisma migrate status` で確認 → Supabase support |
| dashboard 自体に入れない | Supabase 側の outage | https://status.supabase.com/ 確認 |

---

## 5. 再発防止策

### 5.1 Daily ping cron (本 PR で着地)

`/api/cron/supabase-health` を vercel.json に追加 (`0 4 * * *` UTC =
13:00 JST)。 1 日 1 回 `auth/v1/health` を叩いて auto-pause カウンタを
リセットする。

- 7 日 inactivity 条件は満たされなくなる (毎日 inbound)
- 同時にレイテンシを観測 → degraded / failed なら Sentry alert
- 詳細実装: `src/app/api/cron/supabase-health/route.ts`、 純粋 helper
  + 閾値は `src/lib/health-check.ts`

> 既存 cron 7 本との時刻被りを避けるために 4 UTC を選択 (他は
> 0/1/2/3/10/13/22/23 を使用済)。 13:00 JST = 平日昼で、 仮に問題が
> 出ても Sentry 通知 → 同日中に対処できる時間帯。

### 5.2 Pro plan 移行 (選択肢、 未着手)

Supabase Pro ($25/mo) は **auto-pause 無し**。 Beta cut2 (50 名超え)
or DAU が安定的に 10+ になった時点で見直し。 今は cron で十分。

判断材料は `docs/release/beta-launch-plan.md` §3 metrics gate で見る。

### 5.3 Sentry alert routing

`cron.health` component の event は:

- `level=warning + alertRoute=p3-digest` (degraded) — 週次 digest
- `level=warning + alertRoute=p2-email` (failed) — daily digest

`p1-page` (PagerDuty 起こす) には乗せていない。 daily ping の failure
は **leading indicator** で、 user-visible outage が起きていれば別経路
(auth エラー多発) で p1-page が先に鳴るため。

---

## 6. 運用チェックリスト

週次レビュー時 (Beta 期間):

- [ ] `/admin/health` を開いて 4 services すべて緑
- [ ] Vercel dashboard → Cron Jobs → `supabase-health` の last 7 invocation
      がすべて 200
- [ ] Sentry に `cron.health` warning が無い (= degraded / failed が無い)
- [ ] `/admin/audit` で `admin.health.viewed` の自分のログが残っている
      (= page そのものが動いている)

月次レビュー時:

- [ ] DAU / WAU が増えてきたら Pro plan 移行を再検討
      (cron が抑止してくれているとは言え、 課金移行のほうが運用負荷が
      低い)

---

## 7. 関連リンク

- 設計判断 (まだ ADR 化していない、 Beta 後に書く): TBD
- Sentry alert taxonomy: [`sentry-alerts.md`](sentry-alerts.md)
- Resend webhook 運用: [`webhook-ops.md`](webhook-ops.md)
- Beta rollback 全体: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md) §5
- Supabase 公式 auto-pause docs: https://supabase.com/docs/guides/platform/billing-faq#what-happens-when-my-project-is-paused

---

## 8. 更新ルール

このドキュメントは **incident のたびに retrospective を §1 に追記する**
種類のもの。 過去の事象を消さず、 タイムライン形式で蓄積する:

```
### YYYY-MM-DD incident
- timeline: HH:MM 〜 HH:MM
- root cause: <1 line>
- resolution: <1 line>
- learning: <1 line>
```

復旧手順 (§3) 自体は Supabase の dashboard UI が変わったときに
更新する。 半年に 1 回くらい目視確認。

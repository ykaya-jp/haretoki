# Launch-Day Checklist — Beta deploy 直前 30 分の手順

**作成**: 2026-05-03 (paneA、Phase 4 launch readiness)
**用途**: Beta launch (初回 5 名段階開放) の **当日 deploy ボタンを押す前 30 分** に
オペレーター 1 人で消化する確認手順。各項目に「OK / 要対応 / N/A」を付けて記録する
ことで、launch 後の post-mortem で「事前確認は揃っていたか」が必ず追える。

> **読み方**: 上から順に消化する。**T-30 → T-15 → T-0 → T+15 → T+60** の 5 段階で
> 区切ってある。各段階の最後に「次段階に進んでよいか」の判断ゲートがある。
> 落ちたゲートでは launch を後ろ倒しにする (やるべきでない場合の判断基準も明記)。

---

## T-30 (deploy 30 分前): 環境確認

### Supabase

- [ ] **本番プロジェクトが live 状態か**: <https://supabase.com/dashboard/project/_> →
  プロジェクト名・region (Tokyo) を確認、`Pause` ボタンが灰色 (= active) なこと
- [ ] **`/admin/health` を本番 URL で開く**: Supabase 行が status=`ok` + latency ≤ 800ms
  (`HEALTH_OK_THRESHOLD_MS`)
- [ ] **Supabase auto-pause prevention cron が直近 24h で走った跡がある**:
  `/admin/health` の Cron run status (24h) で `supabase-health` 行が `ok`
- [ ] **`docs/phase3/realtime-rls-policy.sql` が本番に適用済**:
  Supabase dashboard → Database → Policies で `realtime.haretoki_project_member`
  関数と policy 2 つ (`SELECT` / `INSERT`) が見えること

### Vercel

- [ ] **本番 alias が想定 deploy を指している**:
  `vercel alias ls --scope haretoki | head -3` で `haretoki.app` (or assigned domain)
  が今 deploy 予定の SHA に向く
- [ ] **本番 env が揃っている** (Vercel project settings → Environment Variables →
  Production):
  - `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
    `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY` + `ANTHROPIC_DAILY_BUDGET_USD` + `ANTHROPIC_MONTHLY_BUDGET_USD`
  - `RESEND_API_KEY` + `RESEND_WEBHOOK_SECRET` + `EMAIL_FROM`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`
  - `CRON_SECRET`
  - `ADMIN_EMAILS` (オペレーター email を含むこと)
  - `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`
  - `GUEST_COOKIE_SECRET_K1` (rotation 用 K2 は optional)
  - `NEXT_PUBLIC_APP_URL` = `https://haretoki.app` (or 本番 domain)

### Sentry

- [ ] **`/admin/health` の Sentry incidents (24h) widget で REST probe live を確認**
  (`SENTRY_AUTH_TOKEN` 反応)
- [ ] **過去 24h の error ≤ 5 / warning ≤ 30** ✓
  (= 「現状 baseline が静か」の証拠。これより多い場合は launch 前に triage)
- [ ] **alert routing 確認**: `docs/harness/sentry-alerts.md` の p1-page / p2-email /
  p3-digest の各 channel が **オペレーター 1 人以上に到達する** こと

---

## T-30 → T-15 ゲート: 「環境準備」OK 判定

すべて ✅ なら次へ。**1 つでも要対応なら deploy を後ろ倒す**:

| 落ちた項目 | 対応 |
|---|---|
| Supabase auto-pause | dashboard で `Restore` → `/admin/health` で `ok` 復帰確認 → 30 分待機して安定確認 |
| Vercel env 不足 | env 追加 → preview deploy で smoke → 改めて T-30 から |
| Sentry env 不足 | 出荷後の検知不能リスク大 → 必ず launch 前に解消 |
| Sentry baseline 騒がしい | 直近 incident を triage → noise なら filter 追加、real なら fix → 改めて T-30 から |

---

## T-15 (deploy 15 分前): 機能ゲート

### Realtime (Phase 3 L3)

- [ ] **2 ブラウザ目視 verify** (ステージング or 直前 preview):
  Chrome + Firefox で同じ project を開く → 一方で venue rating を保存 →
  もう一方に「{partner name}さんが評価を残しました」 toast が 5 秒以内に到達
- [ ] **/admin/cost の "Realtime broadcasts (7d)" failure rate ≤ 1 %**

### EmptyState (Phase 3 D1)

- [ ] **空 DB account で 4 surface を 375px (Mobile Chrome) で目視**:
  - `/preparation` → 「決めるのは、まだ先で大丈夫」 + CTA `/compare`
  - `/visits` → 「見学を入れたら、ここに記録が残ります」 + CTA `/candidates`
  - `/checklist` → 「気になる式場が決まると、…」 + CTA `/candidates`
  - `/journey` → 「ふたりの式場さがしの記録は、まだ始まったばかり」 + CTA `/explore`
- [ ] **`tests/e2e/empty-state-coverage.spec.ts` (D6) が CI で GREEN**

### Loading (Phase 3 D4)

- [ ] **DevTools Network = Slow 3G + 375px** で `(app)/loading.tsx` (root) +
  `/home` `/visits` `/journey` の 4 page を navigate → editorial skeleton (gold
  shimmer) が表示、spinner-only 画面が無い
- [ ] **Reduced motion** (DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`)
  で shimmer が静止する

### Auth + Onboarding

- [ ] **新規 signup → email confirm → onboarding → /home 着地** が完了する
  (テスト account で 1 周)
- [ ] **/login で Google OAuth が returnable** (signup 経由じゃない既存 account を想定)
- [ ] **/invite/[token]/view + /accept-invite の 4 状態** (welcome / consumed /
  invalid / expired) が ステージング or preview で全パス

---

## T-15 → T-0 ゲート: 「機能 OK」判定

すべて ✅ なら deploy 実行。落ちた項目別:

| 落ちた項目 | 対応 |
|---|---|
| Realtime toast 不到達 | RLS policy 適用漏れ可能性 → SQL editor で `realtime.messages` の policy 再確認 → broadcast 経路は service-role bypass なので publish 側は無関係、subscribe 側 RLS だけ |
| EmptyState 文言ズレ | D1/D6 spec を re-run → snapshot 差分があれば修正 PR を別 deploy |
| Loading editorial 化漏れ | D4 spec の対象 file を grep → bg-muted animate-pulse が残っていれば即修正 |
| Auth フロー破綻 | **launch 中止** — 認証は launch 後に絶対動いていなければならない最低線 |

---

## T-0 (deploy): 実行

```bash
cd /home/yusuke_kaya/projects/haretoki
git checkout main && git pull origin main
git merge --no-ff develop -m "release: beta launch $(date -u +%Y-%m-%d)"
git push origin main

# Option A — 通常 deploy
vercel --prod

# Option B — quota 上限近いとき (alias-swap、最近の lesson)
# 1. preview deploy が直近 GREEN であることを確認
# 2. その preview の URL を取得 (vercel ls で SHA 一致を確認)
# 3. vercel alias set <preview-url> haretoki.app
```

deploy 直後:

- [ ] `vercel ls --prod | head -3` で新 deploy の status=`Ready`
- [ ] `curl -I https://<production-domain>/` が 200 OK
- [ ] **`/admin/health` を本番 URL で開く**:
  - Supabase live probe `ok`
  - Cron run status の `supabase-health` が **deploy 後の最初の cron tick まで** は
    旧 deploy の `ok` 行のまま (これは正常 — 次回 04:00 UTC tick まで待つ)
  - Sentry incidents (24h) で deploy 直後に新規 `error` が出ていない

---

## T+15 (deploy 15 分後): 段階開放準備

- [ ] **オペレーター自身で本番に新規 signup → onboarding → 1 venue 追加 → 1 rating
  保存 → 1 visit 入力**: 5 行為すべてが完了 (= 主要パスが prod で生きている)
- [ ] **Sentry に上記行為由来の error が無い** (warnings は許容、errors はゼロが理想)

---

## T+15 → T+60 ゲート: 「初回 5 名段階開放」許可判定

オペレーター 1 周ですべて OK なら **5 名招待を発射**:

```text
1. オペレーター → 招待リスト (5 名) のうち 1 名に直接 DM で URL 送信
   "Beta 開放しました、よければ触ってみてください。困ったら support@haretoki.app へ"
2. 5 名全員に同時送信ではなく **15 分インターバル** で 1 名ずつ送信
   → 各 user の onboarding を /admin で見ながら、Sentry incident をリアルタイム追跡
```

各招待後:

- [ ] **15 分間 /admin/health + Sentry incidents を観察**
- [ ] **新 user が onboarding 完了するか** (5 質問 → /home 着地) を `/admin/onboarding-funnel`
  の event count で確認
- [ ] **最初の 1 名から rating か note の入力があるか** を `/admin/cost` の Realtime
  broadcasts カウントで確認

---

## T+60: 「launch 落ち着いた」判定

5 名全員に招待済 + 60 分経過時点で:

- [ ] **Sentry critical = 0、warning ≤ 10** (新規 incident は launch 前 baseline 内に
  収まっている)
- [ ] **`/admin/health` 全行 `ok`**
- [ ] **オペレーターが「即時介入が必要な事象は無い」と判断**

OK なら **当日 launch は完了**。明日朝 09:00 JST に再度 `/admin/health` + Sentry を
眺めて夜間 cron が全部 `ok` を確認する習慣を始める。

---

## ロールバック手順 (launch 中の致命傷時)

| 事象 | 対応 |
|---|---|
| 認証完全死 (新規 / 既存 user 全員ログイン不能) | `vercel alias set <previous-prod-deploy-url> haretoki.app` で alias を巻き戻し → Sentry に状況メモ → 招待停止 |
| Realtime broadcast 暴走 (Supabase 接続上限を圧迫) | `src/lib/realtime/publish.ts` の冒頭に `return;` を 1 行追加 → preview deploy → alias swap (CDC 経路は影響なし、データ整合性は保たれる) |
| Cron 全停止 (3 cron 連続 missing) | Vercel dashboard → Cron tab → 各 cron を手動 trigger で復帰確認、ダメなら `CRON_SECRET` 一致確認 |
| AI コスト暴走 (1 時間で daily budget の 50% 超過) | `DISABLE_AI=1` を Vercel env に追加 → 即座に redeploy → AI feature 全停止 |

---

## 関連ドキュメント

- `docs/phase3/COMPLETION.md` § 5 商用化 launch checklist (Phase 3 出荷前提)
- `docs/release/beta-launch-plan.md` (前後のプラン全体像、本 doc は当日手順)
- `docs/harness/sentry-alerts.md` (alert routing 詳細)
- `docs/harness/supabase-auto-pause-prevention.md` (Supabase 自動停止対策)
- `docs/phase3/realtime-rls-policy.sql` (Supabase 適用 SQL)
- `vercel.json` (cron 一覧、本 doc Cron セクションと 1:1 対応)

---

## 履歴

- 2026-05-03 (paneA、Phase 4 launch readiness): 初版作成

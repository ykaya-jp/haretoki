# Beta Launch Plan

「晴れ時 (Haretoki)」 Closed Beta → Open Beta → 一般公開 (GA) までの
**stage-gate 計画書**。 機能ロードマップは
[`docs/roadmap.md`](../roadmap.md)、 商用化要件チェックリストは
[`docs/harness/commercial-readiness.md`](../harness/commercial-readiness.md)、
本ドキュメントは「**いつ・誰に・どう開放するか**」の運用判断のための
ものです。

最終更新: 2026-05-03 (P3 L3 wave 2 完了反映 — 1008 spec、push realtime
fan-out + per-event throttle 実装済)

---

## 0. 全体タイムライン

```
Phase 1 (済) ─→ Phase 2 (済) ─→ Phase 3 (進行中) ─→ Closed Beta ─→ Open Beta ─→ GA
   MVP             商用化準備      Realtime + push     5-10名          50-200名      公開
   2026-04             2026-05         2026-05/06       T+0 (cut1)      T+2 weeks    T+6 weeks
```

各 Phase の完了条件と Beta gate は本ドキュメント §3 / §4 で詳細。

---

## 1. Phase 別 完了状態 (2026-05-03 時点)

### Phase 1 — MVP (✅ 完了)

「妻 200 点」 評価が出るまで。 venue 比較・見積 X-ray・visit memo・
decision · todo の中核体験。 詳細は
[`docs/archive/`](../archive/) の round 1〜10 を参照。

### Phase 2 — 商用化準備 (✅ 完了)

`docs/harness/commercial-readiness.md` の must-have 16 件をすべて消化。
B-0/B-1/B-2/B-3 (visit reminder push)、 C-0/C-1/C-2 (OG / family share /
countdown)、 audit + CSP + retention + Resend webhook + BotID で
**外部公開できる安全運用基盤** が揃った。 1008 spec / lint 0 /
build success が gate.

| 軸 | 状態 |
|---|---|
| 法務 / コンプライアンス | ✅ pp / tos / GDPR-light delete + export / DPA template |
| セキュリティ | ✅ CSP + BotID + audit log + family share の 256-bit token + IP rate limit |
| 観測性 / 運用 | ✅ Sentry alert taxonomy + Resend webhook + retention cron + admin/audit + admin/cost |
| スケール | ✅ Upstash rate limit + N+1 退治 + Anthropic budget cron + Vercel Fluid Compute |
| UX 商用化要件 | ✅ 4 タブ刷新 + dark mode + 375px mobile-first + family share + countdown |
| ビジネス | 🟡 サポート窓口 + 利用規約 / プライバシー (済)、 価格 / 課金は GA 直前 |

### Phase 3 — Partner full + Realtime + push (進行中)

| Wave | 状態 | 担当 |
|---|---|---|
| Level 1 admin dashboards | ✅ /admin/cost + /admin/audit + /admin/family-share + /admin/visit-reminders + /admin/partner-l2-stats | C2 + B |
| Level 3 wave 1 — Realtime broadcast 基盤 | 🟡 進行中 | A |
| Level 3 wave 2 — push fan-out + per-event throttle | ✅ 着地済 (本 PR の 1 つ前で merge) | B |
| Level 3 wave 3 — multi-device conflict (VisitNote.version) | ❌ 未着手 | A 想定 |
| Level 3 wave 4 — RLS + 完了 | 🟡 進行中 | A |

Phase 3 完了条件: Realtime broadcast → push → in-app notification の
**3 surface 全部動いて Sentry alert が静か** な状態が 7 日続くこと。

---

## 2. Closed Beta gate (= Phase 3 完了 + α)

下記を **すべて** ✅ にしてから Closed Beta cut1 (5-10 名)。

### 2.1 機能 gate

- [ ] Phase 3 wave 1〜4 のすべての PR が develop に merge 済
- [ ] [`docs/phase3/integration-test-checklist.md`](../phase3/integration-test-checklist.md)
      のチェックを Playwright e2e (`tests/e2e/phase3-integration.spec.ts`) で自動化
- [ ] 1 人 owner + 1 人 partner の **二者間 reproduction** で
      `decision_made` → realtime broadcast → in-app toast → push 通知
      の連鎖を実機 (iPhone Safari + Android Chrome) で 1 回成功

### 2.2 観測 gate

- [ ] Sentry の `p1-page` alert route に過去 7 日 0 件
- [ ] `p2-email` route が weekly digest 1 通以下 (突発的な webhook
      エラー以外で連続発火していないこと)
- [ ] `/admin/cost` の Anthropic monthly forecast が予算内
- [ ] `/admin/audit` の suspicious-pattern banner が直近 7 日空
- [ ] `/admin/cost` 新セクション (P3 L3 W2) の "Realtime push 7d"
      `sent7d > 0` 行があること (= dispatcher が 1 回でも実発火している)

### 2.3 運用 gate

- [ ] Vercel cron 7 個 (visit-reminders {day-before / morning-of /
      way-home}, ai-cost-summary, email-suppression-retry,
      data-retention-sweep, decision-followup, saved-search-notify,
      generate-rituals) の直近 invocation がすべて success
- [ ] `docs/harness/webhook-ops.md` の §1 7d bounce_pct < 2.0%、
      §2 over_7d soft_bounce = 0
- [ ] 環境変数チェック: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` /
      `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `RESEND_API_KEY` /
      `RESEND_WEBHOOK_SECRET` / `CRON_SECRET` / `ADMIN_EMAILS` /
      `GUEST_COOKIE_SECRET_K1` / `K2` がすべて prod に注入されている

### 2.4 法務 gate

- [ ] `/privacy` と `/terms` の最終確認 (作者 + 妻が読み切り)
- [ ] 利用規約に「Closed Beta — フィードバック前提、 サービス停止
      可能性あり」 の 1 行
- [ ] サポート窓口 (`SUPPORT_EMAIL`) 受信確認

---

## 3. Open Beta gate (Closed Beta T+2 weeks 想定)

Closed Beta の 5-10 名から「致命的な誤動作なし + 中立的な体感」が
返ってきたら Open Beta (50-200 名) に拡げる。 追加で必要な gate:

### 3.1 メトリクス gate

- [ ] DAU / WAU が観測できる (`PostHog` connected — 既に配線済、 数値の
      sanity check のみ)
- [ ] 1 ユーザーあたりの venue 登録数 中央値 > 3 (= 体験のコア
      「比べる」 まで届いている)
- [ ] partner invite 受諾率 > 30% (Phase 3 の主役、 Closed Beta の
      数値が低すぎたら invite UI の copy をやり直し)

### 3.2 サポート gate

- [ ] Closed Beta 期間中に届いたサポート問い合わせをカテゴリ分類
      し、 上位 3 件を直してから Open Beta
- [ ] サポート用 FAQ ページ (`/support`) を Closed Beta の
      問い合わせ駆動で初版作成

### 3.3 観測の継続

- Closed Beta gate の §2.2 すべて再確認
- `/admin/cost` Anthropic monthly forecast を Open Beta 想定 100 名で
  再投影。 月間予算超過想定なら `ANTHROPIC_MONTHLY_BUDGET_USD` を 200
  に bump + alert threshold を更新

---

## 4. GA gate (Open Beta T+4 weeks = T+6 weeks 想定)

Open Beta で「想定通り動く + ユーザーが定着している」 ことを示せたら
GA。 課金 / プレスリリース はここから。

### 4.1 ビジネス gate

- [ ] 課金体系を ADR で確定
      (`docs/harness/adr/00xx-pricing-model.md` 新規)
- [ ] Stripe 統合 (Beta は無料想定、 GA から課金)
- [ ] 利用規約から「Closed Beta — フィードバック前提」を削除、
      公式版に置換
- [ ] DPA / DPS / 個人情報取扱委託契約 のテンプレを取引先想定で
      固める

### 4.2 ロードマップ整理

- `docs/roadmap.md` の "Beta 後の Phase 4" 候補 (多言語化、 海外
  進出、 Pro 課金プラン) を ADR 化
- 観測コスト想定: GA 想定 1000 DAU で Sentry / Resend / Anthropic
  / Vercel / Supabase の月額試算を再投影

---

## 5. ロールバック計画 (どの gate でも適用)

致命的な不具合 (= データ消失、 認証バイパス、 本番停止 30 分超) が
発生した場合の手順。 詳細は
[`docs/harness/runbook.md`](../harness/runbook.md) §"インシデント対応"
を参照。 ここでは Beta 特有の判断軸のみ:

### 5.1 機能フラグ即停止

| 軸 | フラグ | 効果 |
|---|---|---|
| Push 配信 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` を空に | dispatcher が silently skip |
| Realtime broadcast (wave 1 着地後) | Supabase Realtime publication をオフ | 全 client が ポーリング fallback (router.refresh()) |
| BotID | `BOT_ID_ENABLED` を空に | gate 解除、 通常通り動く |
| Family share 公開 | `family_invitations.expires_at` を一括 NOW() に | 全 link が即時失効 (DB 直叩き、 SQL は webhook-ops.md と同じ admin connection を使う) |
| Anthropic 全停止 | `DISABLE_AI=1` | コーチ + 全 AI 機能が "AI 一時停止中" copy にフォールバック |
| 全停止 | Vercel deployment rollback (前 deploy の URL) | 5 分以内に復帰 |

### 5.2 Beta 特有の判断

- Closed Beta 中の致命傷: 該当の 5-10 名に **個別 email で謝罪 + 修正
  完了通知**。 サービス停止判断は作者裁量で OK
- Open Beta 中の致命傷: Sentry alert + 自動メール (運用 NG なら
  PagerDuty 想定)。 50-200 名の影響は無視できないが、 GA ではない
  ので「サービス停止 → 修正 → 再開」 の運用パターンを通せる
- GA 後の致命傷: SLA を作ってから判断 (Beta では SLA を持たない)

### 5.3 マイグレーション ロールバック

P2 / P3 の migration はすべて **additive only**:

- `add_push_subscription`, `add_visit_reminder_sent`,
  `add_reminder_timing_toggles`, `add_family_invitation`,
  `add_decision_wedding_date`, `add_push_send_log_and_partner_toggles`

これらはすべて新規 table / 新規 column の追加のみで、 既存 data の
変更 / 削除を伴わない。 万一 migration 直後に問題が出ても、
**deployment rollback だけで安全に戻せる** (新カラムは null 扱いに
なるか、 default で埋まる)。 destructive な migration は GA 後の
「legacy column drop」 まで実装しない方針。

---

## 6. ロールアウト スケジュール (想定)

下記はすべて目安。 上記 gate の結果次第で前後する。

| 段階 | 想定週 | 規模 | 主な確認項目 |
|---|---|---|---|
| Closed Beta cut1 | T+0 | 作者 + 妻 + 友人カップル 2-3 組 | 致命傷 / 体感のずれ |
| Closed Beta cut2 | T+1 week | 10-15 名 | partner invite 受諾、 push 通知到達 |
| Open Beta cut1 | T+2 weeks | 50 名 | サポート問い合わせ件数、 churn |
| Open Beta cut2 | T+4 weeks | 200 名 | DAU/WAU、 venue 登録中央値 |
| GA | T+6 weeks | 公開 | プレス / 課金 / 公式マーケ |

各段階で Sentry / Vercel cron / `/admin/cost` / `/admin/audit` / 7d
bounce 率を 1 度はチェックするチェックリストを `runbook.md`
"weekly Beta review" として別途整備予定 (本 PR の範囲外)。

---

## 7. 関連ドキュメント

- 機能 ロードマップ: [`docs/roadmap.md`](../roadmap.md)
- 商用化要件 チェックリスト: [`docs/harness/commercial-readiness.md`](../harness/commercial-readiness.md)
- Phase 3 設計: [`docs/phase3/partner-level-3-design.md`](../phase3/partner-level-3-design.md)
- Phase 3 統合テスト: [`docs/phase3/integration-test-checklist.md`](../phase3/integration-test-checklist.md)
- 観測 alert taxonomy: [`docs/harness/sentry-alerts.md`](../harness/sentry-alerts.md)
- Resend webhook 運用: [`docs/harness/webhook-ops.md`](../harness/webhook-ops.md)
- インシデント対応 runbook: [`docs/harness/runbook.md`](../harness/runbook.md)

---

## 8. 更新ルール

- Closed Beta cut1 / Open Beta cut1 / GA の「実施日」と「実施
  ユーザー数」を本ドキュメント §6 表に追記
- 各 gate の checkbox は実際にチェックした人 + 日付を inline で残す
  (例: `[x] (yusuke 2026-05-15)`)
- ロールバック発動時は §5 に「事象 / 対処 / 学び」を 3 行で残す
- gate を満たさず延期した場合は §0 のタイムラインを ぐるっと
  ずらす — Phase 3 が 1 週間延びたら Closed Beta cut1 も 1 週間延びる

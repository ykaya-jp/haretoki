# 0009. Resend webhook + Vercel BotID をフィーチャーフラグ可能な形で導入する

- **Status**: Accepted
- **Date**: 2026-05-02
- **Deciders**: yusuke.kaya

## Context

`commercial-readiness.md` の 16 件の must-have のうち、 上位 4 件が以下:

- 2.3 Rate limiting 汎用化 (worker A 並走中)
- **2.8 Bot 対策 (Vercel BotID)** — signup / 高コスト endpoint への bot 流入が現状無防備
- **3.7 Resend webhook 統合** — sendEmail 失敗の事後検知 + bounce / complaint による
  自動 suppression が無く、 Resend deliverability score を傷める risk
- 3.8 Anthropic コスト alert (今回は対象外)

両者とも **本番運用品質** の項目で、 機能追加というより infrastructure に近い。
特に 3.7 は既に visit-reminder cron で `emailFailed` counter を入れたが、
**Resend 側の事後イベント (bounced / complained) を受けて suppression する経路** が
無かった。 一度 bounce した address に翌日もメールを送り続けるのは ESP の policy 上
deliverability に直撃するため、 無料運用でも放置できない。

BotID は Vercel 純正 (2025-06 GA)、 server-side `checkBotId()` + client-side
`BotIdClient` の組み合わせで、 CAPTCHA を出さずに bot を弾ける。 既存の per-user
in-memory rate limit (`/api/coach/stream`) は **同一ユーザーの暴走** には効くが、
**新規 bot account 量産 + 1 回ずつ叩く** パターンは素通りしてしまう。

## Decision

両者を **同 PR で導入し、 環境変数で機能フラグ化する**。 具体的には:

### Resend webhook
1. `Notification` table に `resend_message_id` (text, indexed) と
   `email_delivery_status` (text) の 2 列を additive 追加 (migration
   `20260502032400_add_notification_email_delivery`)
2. `src/lib/email/delivery.ts` に `EmailDeliveryStatus` 定数 + suppression set
   (`bounced` / `complained`) を集約
3. `src/app/api/webhooks/resend/route.ts` で Resend SDK の
   `resend.webhooks.verify()` (Svix HMAC SHA-256) を呼んで signature を検証、
   イベントを type → status mapping、 該当 Notification を update、
   suppression status なら `NotificationPreference.emailEnabled = false` を upsert
4. `visit-reminder-handler.ts` は send 成功時に `resendMessageId` を Notification 行に
   保存 (webhook の join key)
5. `RESEND_WEBHOOK_SECRET` 未設定なら 503 を返す (機能 OFF と同じ effect)

### Vercel BotID
1. `botid` パッケージを dependency 追加 (Vercel 純正、 small)
2. `src/lib/botid.ts` に `detectBot(scope)` wrapper、 `BOT_ID_ENABLED` flag で
   on/off、 SDK 例外時は **fail-open** (legitimate user を巻き込まない)
3. `src/app/layout.tsx` の root layout に `BotIdClient` を mount、
   protect 配列に `/api/coach/stream` (POST) / `/api/user/delete` (DELETE) /
   `/api/user/export` (GET) の 3 endpoint
4. 該当 route handler の最初で `detectBot()` を呼び、 `blocked` なら 403 + Sentry
   `[botid]` warning level capture

両者共 `BOT_ID_ENABLED` / `RESEND_WEBHOOK_SECRET` を **本番だけ設定** することで
local dev / preview 環境では無効化、 本番で段階的に enforcement 可能。

## Consequences

良かった点:

- **Resend deliverability の自動防衛**: bounce / complaint で即 suppression、 ESP
  の sender reputation を守る
- **Notification table が email lifecycle の SoT になる**: 今後 admin UI 等で
  「この通知のメール開封されたか」を 1 query で答えられる
- **BotID のフィーチャーフラグ化で安全に enforcement 移行**: prod で 1 週観測 →
  false-positive 率を確認 → 安心して `BOT_ID_ENABLED=1` 投入できる
- **commercial-readiness.md 16 件中 2 件が ✅ に昇格** (2.8 Bot 対策、 3.7 Resend
  webhook)
- **failure mode の対称性**: Resend webhook は "secret 未設定 → 503"、 BotID は
  "flag 未設定 → fail-open"、 どちらも明確

悪かった点 / 後始末:

- **Webhook 公開 endpoint が 1 つ増える**: signature verification は強いが、 DoS
  対策 (massive payload / CPU-bomb) は別途必要。 Vercel の edge-level rate
  limit + 関数 timeout で当面は十分、 必要なら BotID を webhook にも適用検討
- **botid SDK が新規 dep**: 1 package 追加、 supply chain risk は admit。 official
  Vercel package で代替候補なし
- **`runtime = "nodejs"` 明示が Cache Components 違反**: webhook route で当初
  `export const runtime = "nodejs"` を書いたら Turbopack build が拒否、 削除して
  framework default (Node) に任せる対応。 同じ罠に Server Actions 系で当たる
  可能性あり、 `docs/harness/runbook.md` トラブルシュートに追記候補
- **Webhook 署名検証は "fail closed"**: signature 無効 → 400 で拒否。 Resend
  secret 回転時に webhook が 1 サイクル落ちる risk → 旧 secret + 新 secret の
  二段階対応が将来必要 (`GUEST_COOKIE_SECRET_K1/K2` パターン参照)
- **Notification.resendMessageId の cleanup**: 行が無限に増える。 90 日後に
  webhook が来る確率はほぼ 0 なので、 バッチ削除 cron を将来追加 (Phase 3)

## Alternatives considered

- **svix SDK を別途依存**: Resend SDK が svix を内部で使っているので duplicate に
  なる。 `resend.webhooks.verify()` で十分、 svix を直接 import しない
- **EmailSuppression table を別 model 化**: address 単位 (user 単位ではなく) の
  suppression。 GDPR delete 後も残せる利点はあるが、 現状無料サービスで
  re-signup → 同 address 復活は許容範囲。 `NotificationPreference.emailEnabled`
  flip で十分シンプル
- **BotID を middleware.ts に書く**: 全 path を一律 check できるが、 (1) BotIdClient
  の `protect` 配列で path-level instrumentation が前提、 (2) middleware は edge
  で走るため `botid/server` の Node-only API と相性悪い、 (3) 必要 path だけに
  絞る方が false-positive リスク低い。 route-level 検査に倒した
- **BotID を fail-closed**: 厳密だが、 BotID 落ちで全 coach chat が死ぬ。
  fail-open + Sentry 監視で異常検知に倒した
- **`runtime = "nodejs"` を維持して Cache Components 解除**: 全 route 影響、
  pp 性能 regression。 webhook 1 個のために全体方針は変えない判断

## References

- 前提となる commercial readiness: [`docs/harness/commercial-readiness.md`](../commercial-readiness.md) §2.8 + §3.7
- 実装:
  - `src/app/api/webhooks/resend/route.ts`
  - `src/lib/email/delivery.ts`
  - `src/lib/botid.ts`
  - `src/server/cron/visit-reminder-handler.ts` (resendMessageId 保存)
  - `prisma/migrations/20260502032400_add_notification_email_delivery/`
- Resend webhook spec: Context7 `/resend/resend-node` (2026-05-02 確認)
- Vercel BotID: Context7 `/vercel-labs/botid-nextjs-starter` (2026-05-02 確認)
- 関連 ADR: なし (将来 webhook 系を増やす時に webhook 設計 ADR を別途検討)

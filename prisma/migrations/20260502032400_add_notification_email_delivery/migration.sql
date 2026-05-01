-- P2.D: Resend webhook delivery tracking columns on notifications.
--
-- Both columns are nullable text + a partial index — additive only,
-- safe to apply to a live DB. Same risk profile as W20-3 soft-delete
-- and the round 1 / round 2 perf index migrations.
--
-- 1. resend_message_id (text, nullable, indexed)
--    Stores the message id returned by `resend.emails.send(...)` when
--    the notification's email was dispatched. The webhook handler
--    (`/api/webhooks/resend`) uses this column to find the originating
--    Notification row when a delivery event arrives. Indexed because
--    the lookup is `findFirst where resend_message_id = $1`.
--
-- 2. email_delivery_status (text, nullable)
--    Latest Resend event status. Stringly-typed (not an enum) so a
--    future `email.delayed` / `email.scheduled` type doesn't require
--    a follow-up migration. App-level constants live in
--    `src/lib/email/delivery.ts` (`EMAIL_DELIVERY_STATUSES` array).
--    NULL means either "no email leg" (in-app only) or "no event yet"
--    (sent but no webhook fired).

ALTER TABLE "notifications"
  ADD COLUMN "resend_message_id" TEXT,
  ADD COLUMN "email_delivery_status" TEXT;

CREATE INDEX "notifications_resend_message_id_idx"
  ON "notifications" ("resend_message_id");

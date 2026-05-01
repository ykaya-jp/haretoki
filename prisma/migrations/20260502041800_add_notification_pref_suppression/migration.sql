-- P2.D: Email suppression metadata on notification_preferences.
--
-- Additive only: 2 nullable text columns + 1 composite index. Same
-- safety profile as previous round migrations (W20-3, round-1, round-2,
-- round-7, AiCostSnapshot). No DROP / ALTER / NOT NULL backfill.
--
-- 1. email_suppressed_reason (TEXT, nullable)
--    Reason the email leg was disabled. Stringly-typed so a future
--    Resend event class doesn't require a follow-up migration. App-
--    level constants in `src/lib/email/suppression.ts` define the
--    legal values (hard_bounce / soft_bounce / complained / manual).
--    NULL = email_enabled was never auto-suppressed (the default state).
--
-- 2. email_suppressed_at (TIMESTAMP, nullable)
--    Set whenever the reason column is set, so the daily retry cron
--    (`/api/cron/email-suppression-retry`) can compare against
--    `now - 7 days` to decide whether a soft-bounce user is eligible
--    for re-enable.
--
-- 3. (email_suppressed_reason, email_suppressed_at) composite index
--    Supports the cron's selective scan without a full table sweep.
--    Composite leads with the categorical reason because the WHERE
--    clause filters on it first (`reason = 'soft_bounce'`), then
--    range-scans on the timestamp.

ALTER TABLE "notification_preferences"
  ADD COLUMN "email_suppressed_reason" TEXT,
  ADD COLUMN "email_suppressed_at" TIMESTAMP(3);

CREATE INDEX "notification_preferences_email_suppressed_reason_email_suppr_idx"
  ON "notification_preferences" ("email_suppressed_reason", "email_suppressed_at");

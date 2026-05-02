-- Track B-3: per-timing visit-reminder toggles on NotificationPreference.
--
-- Additive only: 3 boolean columns with NOT NULL DEFAULT true. Same safety
-- profile as the previous additive migrations (round 1/2/7, AiCostSnapshot,
-- notification suppression, AuditLog, PushSubscription, VisitReminderSent).
--
-- Defaults are `true` so the B-2 cron behaviour is preserved for every
-- existing row after backfill — users opt OUT of a timing rather than
-- having to opt IN. This matches the spec text in B-3 §"既存ユーザー"
-- and avoids a silent regression where the cron would suddenly stop
-- firing for everyone the moment this migration ships.

ALTER TABLE "notification_preferences"
  ADD COLUMN "reminders_day_before" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminders_morning_of" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminders_way_home"   BOOLEAN NOT NULL DEFAULT true;

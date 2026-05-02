-- Track C-2: optional wedding date on Decision.
--
-- Additive only: 1 nullable column. Same safety profile as the previous
-- additive migrations (PushSubscription, VisitReminderSent, reminder
-- timing toggles, FamilyInvitation).
--
-- Stored without timezone; the application layer treats the value as
-- "JST midnight on this calendar date" — see src/lib/wedding-countdown.ts
-- for the date arithmetic that keeps the countdown stable across UTC
-- day boundaries.

ALTER TABLE "decisions" ADD COLUMN "wedding_date" TIMESTAMP(3);

-- F2 (W15 audit): visit calendar export / iCalendar SEQUENCE support.
--
-- `sequence`             — RFC 5545 §3.8.7.4 non-negative integer. Incremented
--                          on every visit re-schedule so external calendars
--                          overwrite the prior event via the same UID.
-- `calendar_exported_at` — timestamp of the most recent successful .ics
--                          download. NULL = never exported. Used (a) for
--                          success-metric logs and (b) to filter out
--                          externally-managed visits from the push-reminder
--                          cron (avoid double notifications).

ALTER TABLE "visits"
  ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "calendar_exported_at" TIMESTAMP(3);

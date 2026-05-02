-- Track B-2: per-(user, visit, phase, scheduled-day) dedupe gate for the
-- visit-reminder cron dispatcher.
--
-- Additive only: new table + 1 unique index + 2 supporting indexes + 2
-- FK constraints (CASCADE on User and Visit delete). Same safety profile
-- as the previous additive migrations (round 1/2/7, AiCostSnapshot,
-- notification suppression, AuditLog, PushSubscription).
--
-- The unique constraint enforces "1 send per (user × visit × phase ×
-- scheduled-day)" atomically — concurrent cron invocations both racing
-- to insert the same row trip P2002 and the loser silently skips. This
-- is what defends against the duplicate-send case the designer flagged.
--
-- `scheduled_date_key` (text, JST YYYY-MM-DD) is part of the unique key
-- so a re-scheduled visit produces a different key and the new send
-- isn't suppressed by the prior dedupe row.

CREATE TABLE "visit_reminder_sent" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             UUID NOT NULL,
  "visit_id"            UUID NOT NULL,
  "phase"               TEXT NOT NULL,
  "scheduled_date_key"  TEXT NOT NULL,
  "sent_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visit_reminder_sent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visit_reminder_sent_user_visit_phase_date_key"
  ON "visit_reminder_sent" ("user_id", "visit_id", "phase", "scheduled_date_key");

CREATE INDEX "visit_reminder_sent_sent_at_idx"
  ON "visit_reminder_sent" ("sent_at");

CREATE INDEX "visit_reminder_sent_visit_id_idx"
  ON "visit_reminder_sent" ("visit_id");

ALTER TABLE "visit_reminder_sent"
  ADD CONSTRAINT "visit_reminder_sent_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visit_reminder_sent"
  ADD CONSTRAINT "visit_reminder_sent_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

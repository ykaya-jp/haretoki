-- Phase 3 Level 3 wave 2: couple-activity push throttle + per-event toggles.
--
-- Two additive changes in one migration (one PR, one feature):
--
-- 1. push_send_logs table — per-(recipient, kind, scope, hour bucket)
--    throttle gate. The composite unique index is what gives the
--    realtime push dispatcher race-safe 1-per-hour cool-down via
--    P2002-on-create (no count-then-create race), same shape as
--    visit_reminder_sent in P2.B-2.
--
-- 2. notification_preferences gets 4 boolean opt-out columns, all
--    NOT NULL DEFAULT true. Existing rows inherit `true` so the
--    wave-2 dispatcher behaves identically before and after a user
--    opens settings, matching the B-3 reminder-toggle pattern.
--
-- Same safety profile as the previous additive migrations
-- (PushSubscription, VisitReminderSent, reminder timing toggles,
-- FamilyInvitation, Decision.weddingDate).

-- 1. push_send_logs ---------------------------------------------------

CREATE TABLE "push_send_logs" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_user_id"  UUID NOT NULL,
  "kind"               TEXT NOT NULL,
  "scope_id"           TEXT NOT NULL,
  "hour_bucket"        INTEGER NOT NULL,
  "sent_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_send_logs_recipient_kind_scope_hour_key"
  ON "push_send_logs" ("recipient_user_id", "kind", "scope_id", "hour_bucket");

CREATE INDEX "push_send_logs_sent_at_idx"
  ON "push_send_logs" ("sent_at");

ALTER TABLE "push_send_logs"
  ADD CONSTRAINT "push_send_logs_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. notification_preferences per-event toggles -----------------------

ALTER TABLE "notification_preferences"
  ADD COLUMN "notify_partner_rating"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_partner_note"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_decision_saved"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_wedding_date_set"  BOOLEAN NOT NULL DEFAULT true;

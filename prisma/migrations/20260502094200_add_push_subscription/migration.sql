-- Track B-1: per-device Web Push subscription table.
--
-- Additive only: new table + 1 unique constraint + 1 index. Same
-- safety profile as the previous additive migrations (round 1/2/7,
-- AiCostSnapshot, notification suppression, AuditLog).
--
-- The legacy `notification_preferences.push_subscription` (jsonb)
-- column is intentionally NOT dropped — leaving it lets the
-- migration stay safe to apply to a live DB and lets the next round
-- run a separate destructive migration after a quiet period.
--
-- Endpoint UNIQUE: the same browser re-subscribing (e.g. after the
-- user toggles permission off and back on) lands on the same
-- endpoint URL; we upsert by it so duplicate rows can't accumulate.
-- One user CAN have many endpoints (one per device) — no UNIQUE on
-- user_id.

CREATE TABLE "push_subscriptions" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key"
  ON "push_subscriptions" ("endpoint");

CREATE INDEX "push_subscriptions_user_id_idx"
  ON "push_subscriptions" ("user_id");

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

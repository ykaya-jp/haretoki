-- P2.D: AuditLog table — immutable record of sensitive operations.
--
-- Additive only: new table + 3 composite indexes. No DROP / ALTER /
-- NOT NULL backfill against existing tables. Same safety profile as
-- previous round migrations (W20-3, round 1/2/7, AiCostSnapshot,
-- notification suppression).
--
-- Append-only by convention: Server / cron callers go through
-- `recordAudit()` in `src/server/audit.ts`. No update path is
-- exposed; the only delete path is GDPR right-to-erasure (which
-- itself records an audit_log row about the erasure first).
--
-- Indexes:
--   1. (action, created_at DESC) — for "show me last N user_delete
--      events" / "what cron failures happened in the last 7 days"
--      filtered scans.
--   2. (actor_id, created_at DESC) — for "show me what user X did"
--      (incident response, support).
--   3. (target_type, target_id) — for "what happened to user / project
--      Y" point lookups (incident response).

CREATE TABLE "audit_logs" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "action"      TEXT NOT NULL,
  "actor_id"    TEXT NOT NULL,
  "actor_role"  TEXT,
  "target_type" TEXT,
  "target_id"   TEXT,
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "detail"      JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_action_created_at_idx"
  ON "audit_logs" ("action", "created_at" DESC);

CREATE INDEX "audit_logs_actor_id_created_at_idx"
  ON "audit_logs" ("actor_id", "created_at" DESC);

CREATE INDEX "audit_logs_target_type_target_id_idx"
  ON "audit_logs" ("target_type", "target_id");

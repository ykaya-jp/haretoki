-- P2.D: Daily Anthropic spend snapshot table.
--
-- Additive only: new table + 1 unique constraint + 1 desc index. No
-- DROP / ALTER / NOT NULL backfill against existing tables. Same risk
-- profile as the round-1 / round-2 / round-7 perf migrations and the
-- W20-3 soft-delete migration.
--
-- Populated by `/api/cron/ai-cost-summary` (vercel.json crons[]) on a
-- daily upsert keyed by snapshot_date. Read by the admin /admin/cost
-- page which renders the last 30 rows as a dashboard. Older rows can
-- be pruned by a future Phase 3 cron — not done here because the
-- volume is trivial (1 row / day = 365 rows / year).

CREATE TABLE "ai_cost_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "snapshot_date" DATE NOT NULL,
  "daily_used_usd" DECIMAL(10, 4) NOT NULL,
  "daily_budget_usd" DECIMAL(10, 4) NOT NULL,
  "monthly_used_usd" DECIMAL(10, 4) NOT NULL,
  "monthly_budget_usd" DECIMAL(10, 4) NOT NULL,
  "daily_by_bucket" JSONB NOT NULL,
  "should_alert" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_cost_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_cost_snapshots_snapshot_date_key"
  ON "ai_cost_snapshots" ("snapshot_date");

CREATE INDEX "ai_cost_snapshots_snapshot_date_idx"
  ON "ai_cost_snapshots" ("snapshot_date" DESC);

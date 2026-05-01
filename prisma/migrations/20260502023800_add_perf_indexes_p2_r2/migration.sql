-- Phase 2.D round 2: three more composite indexes for hot read paths.
--
-- Same safety profile as the round 1 migration
-- (`20260502003700_add_perf_indexes_p2_b`) and W20-3
-- (`20260501000000_add_soft_delete_columns`) — additive only, CREATE
-- INDEX statements on existing columns, no DROP / ALTER / NOT NULL
-- backfill. Index builds are non-CONCURRENTLY because the affected
-- tables are couple-scoped (rows per project measured in tens, not
-- millions); the brief ACCESS EXCLUSIVE on each is well under the
-- migrate-deploy budget.
--
-- 1. estimates(project_id, created_at DESC)
--    Four call sites do `findFirst where projectId orderBy createdAt
--    desc` to surface the project's latest-by-time estimate (coach.ts
--    loadUserContext, ritual.ts buildRitualContext,
--    coach/stream/route.ts, journey.ts firstEstimate). The existing
--    single-column project_id index forced a sort step on every read;
--    this composite serves the head row from an index-only scan.
--
-- 2. visits(status, scheduled_at)
--    The two visit-reminders crons (`-day-before` + `-morning-of`)
--    scan for upcoming visits with `where status='scheduled' AND
--    scheduled_at range` — no venue_id filter. Without this composite
--    the planner falls back to a sequential table scan once enough
--    completed/cancelled rows accumulate. Equality on status first
--    (highly selective — most historical rows are `completed` or
--    `cancelled`), range on scheduled_at second.
--
-- 3. visits(venue_id, status)
--    home.ts upcoming-visit count and journey.ts completed-visit count
--    both run `count where venue.project_id AND status='X'`. Without
--    this composite the join's inner side does a per-row status check;
--    with it the inner side completes index-only. Complements (not
--    replaces) the existing (venue_id, deleted_at) composite — both
--    cover different query shapes against the same table.

CREATE INDEX "estimates_project_id_created_at_idx"
  ON "estimates" ("project_id", "created_at" DESC);

CREATE INDEX "visits_status_scheduled_at_idx"
  ON "visits" ("status", "scheduled_at");

CREATE INDEX "visits_venue_id_status_idx"
  ON "visits" ("venue_id", "status");

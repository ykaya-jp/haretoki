-- Phase 2.B-10: Composite indexes for hot read paths.
--
-- All four are CREATE INDEX statements on existing columns — additive
-- only, no DROP / ALTER / NOT NULL backfill. Same safety profile as
-- W20-3's `20260501000000_add_soft_delete_columns`. Index builds are
-- non-CONCURRENTLY because the affected tables are couple-scoped (rows
-- per project measured in tens, not millions); the brief ACCESS
-- EXCLUSIVE on each is well under the migrate-deploy budget.
--
-- 1. venues(project_id, created_at)
--    home (`earliestVenue`) and journey (firstFavorite / firstVisit /
--    firstEstimate) probe the project's earliest / latest venue with
--    `orderBy: { createdAt: asc|desc }`. The single-column project_id
--    index forces Postgres to read every project row and sort; this
--    composite returns the head tuple from an index-only scan.
--
-- 2. ai_analyses(project_id, created_at DESC)
--    `getAIInsights` throttle gate (`insights.ts`) reads the project's
--    most recent analysis with `orderBy: { createdAt: desc }, take: 1`
--    on every Home + Coach render. The existing (project_id, type)
--    index is unselective for the orderBy and forces a sort step; this
--    composite resolves the throttle in one tuple.
--
-- 3. decision_todos(project_id, completed_at, order_index)
--    `getTopTodos` (home hero "次の一歩") filters
--    `where: { projectId, completedAt: null }` then
--    `orderBy: { orderIndex: asc } take: 3`. The two existing
--    composites each cover one half (filter / sort) but neither
--    eliminates the post-fetch sort. The triple lets Postgres serve
--    the home query as an index-only scan.
--
-- 4. coach_messages(session_id, created_at)
--    Every coach turn does two reads on the active session — the last
--    20 messages (`sendCoachMessage`) and a probe for the latest
--    message to dedupe user-message persistence
--    (`persistUserMessageIdempotent`). Both shapes are
--    `where session_id orderBy created_at`; the single-column
--    session_id index forces a per-fetch sort once a session collects
--    a few dozen messages. Composite makes both index-ordered.

CREATE INDEX "venues_project_id_created_at_idx"
  ON "venues" ("project_id", "created_at");

CREATE INDEX "ai_analyses_project_id_created_at_idx"
  ON "ai_analyses" ("project_id", "created_at" DESC);

CREATE INDEX "decision_todos_project_id_completed_at_order_index_idx"
  ON "decision_todos" ("project_id", "completed_at", "order_index");

CREATE INDEX "coach_messages_session_id_created_at_idx"
  ON "coach_messages" ("session_id", "created_at");

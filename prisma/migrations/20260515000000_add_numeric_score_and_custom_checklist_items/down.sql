-- Rollback for 20260515000000_add_numeric_score_and_custom_checklist_items.
--
-- This file is NOT executed by `prisma migrate deploy`. It is a paper trail
-- so an operator can hand-execute the reverse changes if a deploy needs to
-- be rolled back. Run with `psql $DATABASE_URL -f down.sql` (after taking a
-- snapshot first — Supabase Pro PITR is cheaper insurance, but for
-- belt-and-suspenders the explicit script is here).
--
-- Data preservation: dropping `numeric_score` loses any user-entered scores
-- but does NOT touch `status`, `memo`, `numberValue`, or `photoUrls`.
-- Dropping `custom_checklist_items` cascades to its FK from
-- `project_checklists` (none yet at this layer, since this PR only adds
-- the table). Existing checklist behaviour through `CHECKLIST_PRESETS`
-- continues unchanged.

DROP TABLE IF EXISTS "custom_checklist_items";

ALTER TABLE "venue_checklist_answers"
  DROP CONSTRAINT IF EXISTS "venue_checklist_answers_numeric_score_grid_check";

ALTER TABLE "venue_checklist_answers"
  DROP COLUMN IF EXISTS "numeric_score";

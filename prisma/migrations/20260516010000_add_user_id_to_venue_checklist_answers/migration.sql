-- Migration: add per-user authorship to venue_checklist_answers
--
-- Prior schema enforced @@unique([projectChecklistId, venueId]) which meant
-- spouses overwrote each other's checklist scores on the same venue. This
-- migration adds user_id so each member of a project can keep their own
-- 0.5–5.0 numericScore (and status/memo/photos) per checklist question.
--
-- Backfill strategy: historical rows are attributed to the project owner
-- (ProjectMember.role = 'owner'). If the project has no owner (data
-- integrity edge case) we fall back to the earliest accepted member so the
-- NOT NULL constraint can still be enforced.

-- Step 1: add nullable user_id column for backfill window
ALTER TABLE "venue_checklist_answers" ADD COLUMN "user_id" UUID;

-- Step 2: backfill — owner first, then earliest member by invited_at
UPDATE "venue_checklist_answers" vca
SET "user_id" = m.user_id
FROM "project_checklists" pc
JOIN LATERAL (
  SELECT pm.user_id
  FROM "project_members" pm
  WHERE pm.project_id = pc.project_id
  ORDER BY (pm.role = 'owner'::"ProjectRole") DESC,
           pm.invited_at ASC
  LIMIT 1
) m ON TRUE
WHERE vca.project_checklist_id = pc.id
  AND vca.user_id IS NULL;

-- Step 3: enforce NOT NULL (will fail loudly if any row remained NULL,
-- which would indicate orphaned project_checklist rows that need manual
-- cleanup before this migration can apply)
ALTER TABLE "venue_checklist_answers" ALTER COLUMN "user_id" SET NOT NULL;

-- Step 4: foreign key to users(id)
ALTER TABLE "venue_checklist_answers"
  ADD CONSTRAINT "venue_checklist_answers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: swap unique constraint from (projectChecklistId, venueId)
--         to (projectChecklistId, venueId, userId)
ALTER TABLE "venue_checklist_answers"
  DROP CONSTRAINT IF EXISTS "venue_checklist_answers_project_checklist_id_venue_id_key";

ALTER TABLE "venue_checklist_answers"
  ADD CONSTRAINT "venue_checklist_answers_project_checklist_id_venue_id_user_id_key"
  UNIQUE ("project_checklist_id", "venue_id", "user_id");

-- Step 6: composite index for read paths that filter by user
CREATE INDEX "venue_checklist_answers_project_checklist_id_user_id_idx"
  ON "venue_checklist_answers"("project_checklist_id", "user_id");

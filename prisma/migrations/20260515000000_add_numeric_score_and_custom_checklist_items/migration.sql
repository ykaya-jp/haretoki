-- Migration: add numeric_score to venue_checklist_answers + new custom_checklist_items table
--
-- Why this migration (= v3 plan C3 + H4 + critic blocker #1):
--   * `numeric_score` lets a user grade each checklist question 0.5–5.0; the
--     parent dimension's composite score becomes the mean of the rated child
--     items, replacing the current model where the parent dimension is set
--     directly via VisitRating (which is independent of checklist content).
--   * `custom_checklist_items` lets a couple add their own questions
--     ("親族控室の畳数 は？") on top of the static `CHECKLIST_PRESETS` library.
--
-- Both changes are **additive**: no columns dropped, no constraints loosened.
-- Existing rows continue to work — `numeric_score` is nullable and defaults
-- to NULL for every existing row, and `custom_checklist_items` is a brand-new
-- table. Rollback (= revert this migration) is therefore data-preserving
-- (see ./down.sql).
--
-- The 0.5-step CHECK constraint on numeric_score is enforced in DB rather
-- than just zod because the same column is written from several call sites
-- (server actions, migration scripts, future bulk import). A single DB-level
-- invariant beats N application-level invariants.

-- 1) venue_checklist_answers.numeric_score
ALTER TABLE "venue_checklist_answers"
  ADD COLUMN "numeric_score" DECIMAL(2, 1);

ALTER TABLE "venue_checklist_answers"
  ADD CONSTRAINT "venue_checklist_answers_numeric_score_grid_check"
  CHECK (
    "numeric_score" IS NULL
    OR (
      "numeric_score" >= 0.5
      AND "numeric_score" <= 5.0
      AND (("numeric_score" * 10)::int) % 5 = 0
    )
  );

-- 2) custom_checklist_items
CREATE TABLE "custom_checklist_items" (
  "id"          TEXT          NOT NULL,
  "project_id"  UUID          NOT NULL,
  "category"    TEXT          NOT NULL,
  "subcategory" TEXT,
  "question"    TEXT          NOT NULL,
  "sort_order"  INTEGER       NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3)  NOT NULL,
  "deleted_at"  TIMESTAMP(3),

  CONSTRAINT "custom_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_checklist_items_project_id_category_deleted_at_idx"
  ON "custom_checklist_items"("project_id", "category", "deleted_at");

ALTER TABLE "custom_checklist_items"
  ADD CONSTRAINT "custom_checklist_items_project_id_fkey"
  FOREIGN KEY ("project_id")
  REFERENCES "projects"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

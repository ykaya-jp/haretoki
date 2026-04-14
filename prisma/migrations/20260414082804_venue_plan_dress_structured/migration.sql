-- AlterTable
ALTER TABLE "venue_plans" ADD COLUMN     "dress_allowance_note" TEXT,
ADD COLUMN     "dress_bride_count" INTEGER,
ADD COLUMN     "dress_budget_cap_yen" INTEGER,
ADD COLUMN     "dress_groom_count" INTEGER;

-- Backfill: preserve any existing free-text dress_allowance into the new note column.
UPDATE "venue_plans"
SET "dress_allowance_note" = "dress_allowance"
WHERE "dress_allowance" IS NOT NULL
  AND "dress_allowance_note" IS NULL;

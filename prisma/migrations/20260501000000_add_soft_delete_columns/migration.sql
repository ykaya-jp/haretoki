-- W20-3: Soft delete columns for venue / visit / memo / 評価.
--
-- All five tables get a nullable `deleted_at` so live rows continue to read
-- with `deletedAt IS NULL` filters, and the couple's "手放す" action sets
-- the timestamp instead of dropping the row. The companion composite
-- indexes keep filtered reads index-only on the hottest paths
-- (project-scoped venue lists, visit history per venue, note / rating
-- streams per visit).
--
-- Additive + nullable in every table — safe to apply to a live DB with
-- existing rows; existing data is treated as "not deleted" since NULL is
-- the default.

ALTER TABLE "venues"               ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "visits"               ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "visit_checklist_items" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "visit_notes"          ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "visit_ratings"        ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "venues_project_id_deleted_at_idx"        ON "venues"        ("project_id", "deleted_at");
CREATE INDEX "visits_venue_id_deleted_at_idx"          ON "visits"        ("venue_id", "deleted_at");
CREATE INDEX "visit_notes_visit_id_deleted_at_idx"     ON "visit_notes"   ("visit_id", "deleted_at");
CREATE INDEX "visit_ratings_visit_id_deleted_at_idx"   ON "visit_ratings" ("visit_id", "deleted_at");

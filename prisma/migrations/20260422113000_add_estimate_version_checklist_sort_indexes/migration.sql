-- Add composite indexes to accelerate hot read paths.
--
-- 1. estimates(venue_id, version DESC)
--    Multiple call sites (matrix, venue detail, comparison, coach) select
--    the latest estimate for a venue via
--      `ORDER BY version DESC LIMIT 1`
--    The existing single-column venue_id index requires a post-sort; this
--    composite lets Postgres return the tuple directly from the index.
--
-- 2. visit_checklist_items(visit_id, sort_order)
--    visit-questions.ts and checklist-comparison.ts render the checklist in
--    sort_order. For visits with 20-30 items this is cheap either way, but
--    the composite makes the query index-ordered and survives future growth
--    of auto-generated AI checklists.

CREATE INDEX "estimates_venue_id_version_idx"
  ON "estimates" ("venue_id", "version" DESC);

CREATE INDEX "visit_checklist_items_visit_id_sort_order_idx"
  ON "visit_checklist_items" ("visit_id", "sort_order");

-- Add userId FK to VisitNote for type-safe creator tracking
-- Replaces the legacy "by:<uuid>" tag pattern

ALTER TABLE "visit_notes" ADD COLUMN "user_id" UUID;

-- Backfill: extract user_id from tags array where a tag matches 'by:<uuid>'
-- Falls back to null for rows without a valid by-tag
UPDATE "visit_notes"
SET "user_id" = (
  SELECT (regexp_match(t, '^by:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'))[1]::uuid
  FROM unnest(tags) AS t
  WHERE t ~ '^by:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) AS t
  WHERE t ~ '^by:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Add FK constraint (nullable, onDelete SetNull)
ALTER TABLE "visit_notes"
  ADD CONSTRAINT "visit_notes_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for userId lookups
CREATE INDEX "visit_notes_user_id_idx" ON "visit_notes"("user_id");

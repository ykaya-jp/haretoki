-- VenueMemo — free-text memo scoped to a Venue (not a Visit).
--
-- Sibling concept to VisitNote: VisitNote is bound to a specific visit
-- row (= 見学に紐づく現地メモ), VenueMemo is bound to the venue itself
-- (= 見学とは別に式場について残しておきたいメモ). Soft-delete to allow
-- undo via the same restoreVenue surface that resurrects soft-deleted
-- venues.
--
-- onDelete: Cascade fires only on physical DELETE; since Venue uses
-- soft-delete, the deleteVenue transaction (src/server/actions/venues.ts)
-- now also stamps deletedAt on related VenueMemo rows.
--
-- Rollback (manual, dev only):
--   DROP TABLE "venue_memos";

CREATE TABLE "venue_memos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "venue_memos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "venue_memos_venue_id_deleted_at_idx" ON "venue_memos"("venue_id", "deleted_at");
CREATE INDEX "venue_memos_user_id_idx" ON "venue_memos"("user_id");

ALTER TABLE "venue_memos"
  ADD CONSTRAINT "venue_memos_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "venue_memos"
  ADD CONSTRAINT "venue_memos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

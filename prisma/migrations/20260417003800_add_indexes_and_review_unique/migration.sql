-- CreateIndex
CREATE INDEX "visit_notes_visit_id_idx" ON "visit_notes"("visit_id");

-- CreateIndex
CREATE INDEX "visit_note_media_visit_note_id_idx" ON "visit_note_media"("visit_note_id");

-- CreateIndex
CREATE INDEX "couple_agreements_created_by_idx" ON "couple_agreements"("created_by");

-- CreateUniqueIndex (remove duplicates first if any exist)
DELETE FROM "reviews" a
  USING "reviews" b
  WHERE a.id > b.id
    AND a.venue_id = b.venue_id
    AND a.source = b.source
    AND a.source_url = b.source_url;

CREATE UNIQUE INDEX "reviews_venue_id_source_source_url_key" ON "reviews"("venue_id", "source", "source_url");

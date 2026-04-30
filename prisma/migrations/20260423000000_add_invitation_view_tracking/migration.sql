-- F4: Guest invite view tracking.
--
-- `lastViewedAt` / `viewCount` lets the owner (mypage/invite) see "相棒さんが
-- そっと見てくれました" without requiring the partner to create a full
-- account. The guest route writes these fields at most once per guest
-- session (cookie `screenCount` gate).
--
-- Both columns are additive and nullable / defaulted, so the migration is
-- safe to run against a live DB with existing rows.

ALTER TABLE "project_invitations"
  ADD COLUMN "last_viewed_at" TIMESTAMP(3),
  ADD COLUMN "view_count"     INTEGER NOT NULL DEFAULT 0;

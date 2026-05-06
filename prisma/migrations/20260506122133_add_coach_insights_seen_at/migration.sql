-- ProjectMember.coachInsightsSeenAt — bottom-nav コーチ badge reset stamp.
--
-- The badge counts AI analyses (comparison / review_summary / visit_prep)
-- created since this timestamp. Bumped by markCoachInsightsSeen on every
-- /coach page visit so the badge drops to 0 on visit and grows again as
-- new insights land. NULL = never visited /coach → badge falls back to
-- "all-time" count, treating every existing analysis as new.
--
-- Additive only, no backfill needed: existing rows get NULL which the
-- read path already handles.

ALTER TABLE "project_members"
  ADD COLUMN "coach_insights_seen_at" TIMESTAMP(3);

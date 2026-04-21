-- W12-1: per-ProjectMember dimension weights (1-5 scale, 3=neutral default).
-- NULL means "unset" → application layer falls back to equal weights (all 3),
-- preserving the pre-W12-1 candidate/comparison ranking for existing rows.

ALTER TABLE "project_members" ADD COLUMN "weights" JSONB;

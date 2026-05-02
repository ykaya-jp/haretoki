-- AlterTable
-- Round 22 (2026-05-02): persist per-action tier hit rate on the daily
-- AI cost snapshot. Today only the estimate-pdf path populates this;
-- shape is { "estimate-pdf": { calls, cacheHits, cacheWrites, hitRate } }.
-- nullable so historical rows (pre-round-22) read as null and the
-- dashboard renders an "(no data)" cell for those days instead of 0%.
ALTER TABLE "ai_cost_snapshots" ADD COLUMN "tier_stats" JSONB;

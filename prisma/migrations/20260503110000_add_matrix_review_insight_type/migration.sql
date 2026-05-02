-- Review-import R3 — cross-venue review insight cache slot.
--
-- Additive only: a single new value on the existing AiAnalysisType
-- enum so getMatrixReviewInsight (src/server/actions/matrix-review-
-- insight.ts) can reuse the shared `getCachedAnalysis` /
-- `setCachedAnalysis` helpers without sharing the `comparison` lane's
-- TTL or invalidation rhythm. Same safety profile as the previous
-- additive enum migrations (fit_reason, matrix_insight, coach_chat,
-- rating_comparison, way_home_mood).
--
-- PostgreSQL caveat — `ALTER TYPE … ADD VALUE` cannot run inside a
-- transaction block. Prisma migrate runs each migration file in its
-- own transaction by default, but the engine recognises the
-- `ALTER TYPE … ADD VALUE` pattern and emits a non-transactional
-- statement automatically. No manual `-- prisma:not_in_transaction`
-- pragma needed.

ALTER TYPE "AiAnalysisType" ADD VALUE 'matrix_review_insight';

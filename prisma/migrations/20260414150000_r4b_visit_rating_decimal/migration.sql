-- V-5: VisitRating.score needs 0.5 precision for half-star ratings.
-- Cast Int column to Decimal(2,1). Existing integer values (0-5) are safely
-- preserved; new inserts can now carry 0.5 increments.
ALTER TABLE "visit_ratings"
  ALTER COLUMN "score" TYPE DECIMAL(2,1) USING "score"::DECIMAL(2,1);

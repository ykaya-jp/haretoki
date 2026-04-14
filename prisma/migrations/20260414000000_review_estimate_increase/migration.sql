-- AlterTable: reviews — AI/manually extracted estimate-increase payload
ALTER TABLE "reviews" ADD COLUMN "estimate_increase" JSONB;

-- AlterTable: venues — aggregated review-based estimate-increase stats
ALTER TABLE "venues" ADD COLUMN "review_estimate_delta_yen" INTEGER;
ALTER TABLE "venues" ADD COLUMN "review_estimate_delta_pct" DECIMAL(5,2);
ALTER TABLE "venues" ADD COLUMN "review_estimate_sample_count" INTEGER;

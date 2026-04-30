-- F1 venue-name-search: per-project monthly quota counter for paid
-- third-party APIs (Google Places Autocomplete in MVP). Upserted by
-- `src/lib/venue-search/quota.ts` so a soft cap can gate Tier 2 without
-- blocking Tier 1 / Tier 3.
-- CreateTable
CREATE TABLE "api_usage_counter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "places_autocomplete_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_usage_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_counter_project_id_year_month_key" ON "api_usage_counter"("project_id", "year_month");

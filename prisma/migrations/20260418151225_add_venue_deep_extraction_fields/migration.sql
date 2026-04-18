-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "accepts_second_party" BOOLEAN,
ADD COLUMN     "barrier_free" BOOLEAN,
ADD COLUMN     "ceremony_fee_exact" INTEGER,
ADD COLUMN     "chef_credentials" VARCHAR(500),
ADD COLUMN     "closed_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cuisine_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "external_rating_value" DOUBLE PRECISION,
ADD COLUMN     "external_review_count" INTEGER,
ADD COLUMN     "has_accommodation" BOOLEAN,
ADD COLUMN     "has_parking" BOOLEAN,
ADD COLUMN     "has_shuttle" BOOLEAN,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "normalized_name" VARCHAR(200),
ADD COLUMN     "operating_hours" VARCHAR(100),
ADD COLUMN     "parking_capacity" INTEGER,
ADD COLUMN     "phone_number" VARCHAR(32),
ADD COLUMN     "postal_code" VARCHAR(16),
ADD COLUMN     "production_fee_max" INTEGER,
ADD COLUMN     "production_fee_min" INTEGER,
ADD COLUMN     "service_fee_rate" DECIMAL(4,3),
ADD COLUMN     "street_address" TEXT;

-- CreateIndex
CREATE INDEX "venues_project_id_normalized_name_idx" ON "venues"("project_id", "normalized_name");

-- CreateIndex
CREATE INDEX "venues_latitude_longitude_idx" ON "venues"("latitude", "longitude");

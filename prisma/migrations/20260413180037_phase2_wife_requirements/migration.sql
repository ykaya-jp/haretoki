/*
  Warnings:

  - You are about to drop the column `checked` on the `visit_checklist_items` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DressBringIn" AS ENUM ('allowed', 'not_allowed', 'negotiable');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('unchecked', 'yes', 'no');

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "category_summary" JSONB,
ADD COLUMN     "is_negative" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "cost_max" INTEGER,
ADD COLUMN     "cost_min" INTEGER,
ADD COLUMN     "dress_bring_in" "DressBringIn",
ADD COLUMN     "dress_bring_in_fee" INTEGER,
ADD COLUMN     "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "visit_checklist_items" DROP COLUMN "checked",
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "status" "ChecklistItemStatus" NOT NULL DEFAULT 'unchecked';

-- CreateTable
CREATE TABLE "venue_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_price" INTEGER,
    "guest_count_min" INTEGER,
    "guest_count_max" INTEGER,
    "included_items" JSONB NOT NULL DEFAULT '[]',
    "excluded_items" JSONB NOT NULL DEFAULT '[]',
    "bring_in_items" JSONB NOT NULL DEFAULT '[]',
    "dress_allowance" TEXT,
    "campaigns" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_plans_venue_id_idx" ON "venue_plans"("venue_id");

-- AddForeignKey
ALTER TABLE "venue_plans" ADD CONSTRAINT "venue_plans_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

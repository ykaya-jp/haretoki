-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('owner', 'partner');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('researching', 'visit_scheduled', 'visited', 'shortlisted', 'selected', 'rejected');

-- CreateEnum
CREATE TYPE "ScoreDimension" AS ENUM ('atmosphere', 'hospitality', 'cuisine', 'cost', 'access', 'reviews', 'dress', 'photo_video', 'flowers', 'staff_continuity', 'capacity', 'cancellation');

-- CreateEnum
CREATE TYPE "ScoreSource" AS ENUM ('zexy', 'wedding_park', 'hanayume', 'mynavi', 'minna_no_wedding', 'user_rating', 'ai_analysis');

-- CreateEnum
CREATE TYPE "EstimateSourceType" AS ENUM ('pdf_upload', 'manual', 'ai_extracted');

-- CreateEnum
CREATE TYPE "EstimateItemCategory" AS ENUM ('attire', 'cuisine', 'photo_video', 'flowers', 'performance', 'av_equipment', 'venue_fee', 'other');

-- CreateEnum
CREATE TYPE "EstimateItemTier" AS ENUM ('minimum', 'standard', 'premium', 'unknown');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "AiAnalysisType" AS ENUM ('review_summary', 'estimate_prediction', 'comparison', 'visit_prep');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "conditions" JSONB,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "access_info" TEXT,
    "capacity_min" INTEGER,
    "capacity_max" INTEGER,
    "ceremony_styles" TEXT[],
    "source_urls" TEXT[],
    "status" "VenueStatus" NOT NULL DEFAULT 'researching',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "dimension" "ScoreDimension" NOT NULL,
    "score" DECIMAL(2,1) NOT NULL,
    "source" "ScoreSource" NOT NULL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "total" INTEGER NOT NULL,
    "predicted_final" INTEGER,
    "source_type" "EstimateSourceType" NOT NULL,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimate_id" UUID NOT NULL,
    "category" "EstimateItemCategory" NOT NULL,
    "item_name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "tier" "EstimateItemTier" NOT NULL DEFAULT 'unknown',
    "predicted_upgrade" INTEGER,
    "upgrade_probability" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'scheduled',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_checklist_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" UUID NOT NULL,
    "item" TEXT NOT NULL,
    "category" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "location_lat" DECIMAL(9,6),
    "location_lng" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_note_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_note_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "media_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_note_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dimension" "ScoreDimension" NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID,
    "project_id" UUID NOT NULL,
    "type" "AiAnalysisType" NOT NULL,
    "input_hash" TEXT,
    "output" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "selected_venue_id" UUID NOT NULL,
    "rationale" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "venues_project_id_idx" ON "venues"("project_id");

-- CreateIndex
CREATE INDEX "venue_scores_venue_id_idx" ON "venue_scores"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_scores_venue_id_dimension_source_key" ON "venue_scores"("venue_id", "dimension", "source");

-- CreateIndex
CREATE INDEX "estimates_venue_id_idx" ON "estimates"("venue_id");

-- CreateIndex
CREATE INDEX "estimates_project_id_idx" ON "estimates"("project_id");

-- CreateIndex
CREATE INDEX "visits_venue_id_idx" ON "visits"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_ratings_visit_id_user_id_dimension_key" ON "visit_ratings"("visit_id", "user_id", "dimension");

-- CreateIndex
CREATE INDEX "ai_analyses_project_id_type_idx" ON "ai_analyses"("project_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_project_id_key" ON "decisions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_selected_venue_id_key" ON "decisions"("selected_venue_id");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_scores" ADD CONSTRAINT "venue_scores_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checklist_items" ADD CONSTRAINT "visit_checklist_items_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_notes" ADD CONSTRAINT "visit_notes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_note_media" ADD CONSTRAINT "visit_note_media_visit_note_id_fkey" FOREIGN KEY ("visit_note_id") REFERENCES "visit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_selected_venue_id_fkey" FOREIGN KEY ("selected_venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

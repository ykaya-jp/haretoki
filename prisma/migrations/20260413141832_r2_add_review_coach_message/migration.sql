-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('like', 'maybe', 'pass');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('zexy', 'wedding_park', 'hanayume', 'mynavi', 'minna_no_wedding');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- AlterEnum
ALTER TYPE "AiAnalysisType" ADD VALUE 'coach_chat';

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "partner_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "visitor_token" TEXT NOT NULL,
    "reaction" "ReactionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_favorites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "source_url" TEXT NOT NULL,
    "rating" DECIMAL(2,1),
    "ai_summary" TEXT,
    "sentiment" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_reactions_project_id_idx" ON "partner_reactions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_reactions_venue_id_visitor_token_key" ON "partner_reactions"("venue_id", "visitor_token");

-- CreateIndex
CREATE INDEX "venue_favorites_user_id_idx" ON "venue_favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_favorites_venue_id_user_id_key" ON "venue_favorites"("venue_id", "user_id");

-- CreateIndex
CREATE INDEX "reviews_venue_id_idx" ON "reviews"("venue_id");

-- CreateIndex
CREATE INDEX "coach_messages_project_id_created_at_idx" ON "coach_messages"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "venues_project_id_status_idx" ON "venues"("project_id", "status");

-- AddForeignKey
ALTER TABLE "partner_reactions" ADD CONSTRAINT "partner_reactions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_reactions" ADD CONSTRAINT "partner_reactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_favorites" ADD CONSTRAINT "venue_favorites_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_favorites" ADD CONSTRAINT "venue_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

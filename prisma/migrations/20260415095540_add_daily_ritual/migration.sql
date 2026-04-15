-- CreateTable
CREATE TABLE "daily_rituals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "weather" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "mood" TEXT,
    "cta_label" TEXT,
    "cta_href" TEXT,
    "seen_at" TIMESTAMP(3),
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_rituals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_rituals_project_id_date_idx" ON "daily_rituals"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_rituals_project_id_date_key" ON "daily_rituals"("project_id", "date");

-- AddForeignKey
ALTER TABLE "daily_rituals" ADD CONSTRAINT "daily_rituals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

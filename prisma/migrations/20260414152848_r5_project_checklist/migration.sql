-- CreateTable
CREATE TABLE "project_checklists" (
    "id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_checklist_answers" (
    "id" TEXT NOT NULL,
    "project_checklist_id" TEXT NOT NULL,
    "venue_id" UUID NOT NULL,
    "status" TEXT,
    "memo" TEXT,
    "number_value" DECIMAL(12,2),
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_checklist_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_checklists_project_id_idx" ON "project_checklists"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_checklists_project_id_item_id_key" ON "project_checklists"("project_id", "item_id");

-- CreateIndex
CREATE INDEX "venue_checklist_answers_project_checklist_id_idx" ON "venue_checklist_answers"("project_checklist_id");

-- CreateIndex
CREATE INDEX "venue_checklist_answers_venue_id_idx" ON "venue_checklist_answers"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_checklist_answers_project_checklist_id_venue_id_key" ON "venue_checklist_answers"("project_checklist_id", "venue_id");

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_checklist_answers" ADD CONSTRAINT "venue_checklist_answers_project_checklist_id_fkey" FOREIGN KEY ("project_checklist_id") REFERENCES "project_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_checklist_answers" ADD CONSTRAINT "venue_checklist_answers_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

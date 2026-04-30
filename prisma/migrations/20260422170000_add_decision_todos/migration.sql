-- F3: 決定後に発生する実務タスクを project×template 単位で保持する。
-- Decision と 1:N にはせず project に直接吊るす（venue 切替時の reset を
-- cancelDecision→makeDecision の連続で扱うため、history を持たせない判断）。

-- AlterTable: cancelDecision 時の直前 venueId を控える marker。
ALTER TABLE "projects" ADD COLUMN "last_cancelled_venue_id" UUID;

-- CreateEnum
CREATE TYPE "TodoSource" AS ENUM ('system', 'custom');

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('high', 'normal', 'low');

-- CreateTable
CREATE TABLE "decision_todos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "template_key" TEXT NOT NULL,
    "source" "TodoSource" NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TodoPriority" NOT NULL DEFAULT 'normal',
    "due_offset_days" INTEGER,
    "order_index" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_todos_project_id_template_key_key" ON "decision_todos"("project_id", "template_key");

-- CreateIndex
CREATE INDEX "decision_todos_project_id_completed_at_idx" ON "decision_todos"("project_id", "completed_at");

-- CreateIndex
CREATE INDEX "decision_todos_project_id_order_index_idx" ON "decision_todos"("project_id", "order_index");

-- AddForeignKey
ALTER TABLE "decision_todos" ADD CONSTRAINT "decision_todos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_todos" ADD CONSTRAINT "decision_todos_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

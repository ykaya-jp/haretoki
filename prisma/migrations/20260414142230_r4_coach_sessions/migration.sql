-- AlterTable
ALTER TABLE "coach_messages" ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "coach_sessions" (
    "id" TEXT NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_sessions_project_id_updated_at_idx" ON "coach_sessions"("project_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "coach_messages_session_id_idx" ON "coach_messages"("session_id");

-- AddForeignKey
ALTER TABLE "coach_sessions" ADD CONSTRAINT "coach_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "coach_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create one legacy session per project that has existing messages,
-- then link all orphaned messages to that session.
INSERT INTO "coach_sessions" ("id", "project_id", "title", "created_at", "updated_at")
SELECT
  concat('legacy-', "project_id"::text),
  "project_id",
  'これまでの会話',
  MIN("created_at"),
  MAX("created_at")
FROM "coach_messages"
GROUP BY "project_id";

UPDATE "coach_messages"
SET "session_id" = concat('legacy-', "project_id"::text)
WHERE "session_id" IS NULL;

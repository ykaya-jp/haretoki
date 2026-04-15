-- CreateTable
CREATE TABLE "project_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "consumed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_invitations_token_key" ON "project_invitations"("token");

-- CreateIndex
CREATE INDEX "project_invitations_project_id_idx" ON "project_invitations"("project_id");

-- CreateIndex
CREATE INDEX "project_invitations_expires_at_idx" ON "project_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_consumed_by_fkey" FOREIGN KEY ("consumed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

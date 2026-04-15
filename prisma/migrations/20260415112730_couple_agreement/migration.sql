-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('discussing', 'decided', 'revisit');

-- CreateTable
CREATE TABLE "couple_agreements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'discussing',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "couple_agreements_project_id_idx" ON "couple_agreements"("project_id");

-- AddForeignKey
ALTER TABLE "couple_agreements" ADD CONSTRAINT "couple_agreements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_agreements" ADD CONSTRAINT "couple_agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

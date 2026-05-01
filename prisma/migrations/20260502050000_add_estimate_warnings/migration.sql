-- AlterTable
-- Round 14 (2026-05-02) — persist server-side sanity-check warnings so the
-- venue-detail Estimate card can render the "要確認" badge after save (not
-- only during the upload-edit modal). Additive + default empty array keeps
-- existing rows working.
ALTER TABLE "estimates" ADD COLUMN "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

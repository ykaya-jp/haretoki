-- AlterEnum
ALTER TYPE "AiAnalysisType" ADD VALUE 'rating_comparison';

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "memo" TEXT,
ADD COLUMN     "reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "title" TEXT;

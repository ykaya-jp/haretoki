-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "vibe_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

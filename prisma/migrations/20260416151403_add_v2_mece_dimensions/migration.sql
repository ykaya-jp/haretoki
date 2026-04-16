-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScoreDimension" ADD VALUE 'ceremony_space';
ALTER TYPE "ScoreDimension" ADD VALUE 'banquet_space';
ALTER TYPE "ScoreDimension" ADD VALUE 'attire_items';
ALTER TYPE "ScoreDimension" ADD VALUE 'cost_contract';
ALTER TYPE "ScoreDimension" ADD VALUE 'logistics';
ALTER TYPE "ScoreDimension" ADD VALUE 'overall';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "embedding" vector(1536) NOT NULL DEFAULT '{}'::vector;

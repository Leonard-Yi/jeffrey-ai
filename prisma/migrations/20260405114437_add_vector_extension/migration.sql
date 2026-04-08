-- AlterTable
ALTER TABLE "Person" ADD COLUMN "embedding" JSONB NOT NULL DEFAULT '[]'::jsonb;

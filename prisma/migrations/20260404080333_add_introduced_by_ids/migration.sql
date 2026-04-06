-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "introducedByIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

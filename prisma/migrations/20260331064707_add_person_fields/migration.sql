-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "baseCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "favoritePlaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "vibeTags" SET DEFAULT ARRAY[]::TEXT[];

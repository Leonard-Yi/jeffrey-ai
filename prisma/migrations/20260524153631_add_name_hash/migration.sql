-- DropIndex
DROP INDEX "Person_name_idx";

-- DropIndex
DROP INDEX "PseudonymMap_userId_idx";

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "nameHash" TEXT;

-- CreateIndex
CREATE INDEX "Person_nameHash_userId_idx" ON "Person"("nameHash", "userId");

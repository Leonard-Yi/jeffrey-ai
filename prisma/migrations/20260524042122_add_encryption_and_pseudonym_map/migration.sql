-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "encryptionVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "encryptionVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "keyRotationInProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keySalt" TEXT;

-- CreateTable
CREATE TABLE "PseudonymMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedEntity" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "pseudonym" TEXT NOT NULL,
    "entityHash" TEXT NOT NULL,
    "disambigFactor" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PseudonymMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PseudonymMap_userId_idx" ON "PseudonymMap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PseudonymMap_userId_entityHash_key" ON "PseudonymMap"("userId", "entityHash");

-- AddForeignKey
ALTER TABLE "PseudonymMap" ADD CONSTRAINT "PseudonymMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `userId` to the `InteractionPerson` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PersonTag` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InteractionPerson" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PersonTag" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "InteractionPerson_userId_idx" ON "InteractionPerson"("userId");

-- CreateIndex
CREATE INDEX "PersonTag_userId_idx" ON "PersonTag"("userId");

-- AddForeignKey
ALTER TABLE "InteractionPerson" ADD CONSTRAINT "InteractionPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTag" ADD CONSTRAINT "PersonTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

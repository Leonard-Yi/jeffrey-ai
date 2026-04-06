-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "introducedById" TEXT;

-- CreateIndex
CREATE INDEX "Person_introducedById_idx" ON "Person"("introducedById");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_introducedById_fkey" FOREIGN KEY ("introducedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

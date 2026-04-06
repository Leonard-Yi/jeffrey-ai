-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "careers" JSONB NOT NULL DEFAULT '[]',
    "interests" JSONB NOT NULL DEFAULT '[]',
    "vibeTags" TEXT[],
    "relationshipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastContactDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "contextType" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "coreMemories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionPerson" (
    "personId" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,

    CONSTRAINT "InteractionPerson_pkey" PRIMARY KEY ("personId","interactionId")
);

-- CreateTable
CREATE TABLE "PersonTag" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "PersonTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "PersonTag_name_idx" ON "PersonTag"("name");

-- CreateIndex
CREATE INDEX "PersonTag_category_name_idx" ON "PersonTag"("category", "name");

-- AddForeignKey
ALTER TABLE "InteractionPerson" ADD CONSTRAINT "InteractionPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionPerson" ADD CONSTRAINT "InteractionPerson_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTag" ADD CONSTRAINT "PersonTag_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

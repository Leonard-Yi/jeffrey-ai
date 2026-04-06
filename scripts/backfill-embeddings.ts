/**
 * Backfill embedding for all existing persons using DashScope API.
 * Run once after adding the embedding column.
 *
 * Usage: npx tsx --env-file=.env scripts/backfill-embeddings.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildPersonSearchText, generateEmbedding } from "../src/lib/embedding";

type WeightedTag = { name: string; weight: number };

async function backfill() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("[Jeffrey.AI] Starting embedding backfill...");

  // Find all persons with empty embedding (JSONB array length = 0)
  const personsToUpdate = await prisma.$queryRaw<
    Array<{ id: string; name: string; careers: unknown; interests: unknown; vibeTags: string[] }>
  >`
    SELECT id, name, careers, interests, "vibeTags"
    FROM "Person"
    WHERE jsonb_array_length("embedding") = 0
  `;

  if (personsToUpdate.length === 0) {
    console.log("[Jeffrey.AI] All persons already have embeddings");
    await prisma.$disconnect();
    return;
  }

  console.log(`[Jeffrey.AI] Found ${personsToUpdate.length} persons without embeddings`);

  let success = 0;
  let failed = 0;

  for (const person of personsToUpdate) {
    try {
      const careers = (person.careers ?? []) as WeightedTag[];
      const interests = (person.interests ?? []) as WeightedTag[];
      const vibeTags = (person.vibeTags ?? []) as string[];

      const searchText = buildPersonSearchText({
        name: person.name,
        careers,
        interests,
        vibeTags,
      });

      const embedding = await generateEmbedding(searchText);

      await prisma.person.update({
        where: { id: person.id },
        data: { searchText, embedding },
      });

      console.log(`[Jeffrey.AI] Embedded: ${person.name} (${embedding.length}D)`);
      success++;
    } catch (err) {
      console.error(`[Jeffrey.AI] Failed to embed ${person.name}:`, err);
      failed++;
    }
  }

  console.log(`[Jeffrey.AI] Backfill complete: ${success} succeeded, ${failed} failed`);
  await prisma.$disconnect();
}

backfill().catch(console.error);

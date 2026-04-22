import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateEmbedding, buildPersonSearchText, type WeightedTag } from "@/lib/embedding";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { enqueueEmbeddingRefresh } from "@/lib/embeddingQueue";

const K_DEFAULT = 10;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function parseEmbedding(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as number[]; } catch { return []; }
  }
  return [];
}

function refreshStaleEmbeddingIfNeeded(
  person: { id: string; name: string; careers: unknown; interests: unknown; vibeTags: string[]; searchText: string }
) {
  const expectedSearchText = buildPersonSearchText({
    name: person.name,
    careers: (person.careers ?? []) as WeightedTag[],
    interests: (person.interests ?? []) as WeightedTag[],
    vibeTags: person.vibeTags ?? [],
  });

  if (expectedSearchText !== person.searchText) {
    console.warn(`[Jeffrey.AI] Stale embedding detected for "${person.name}"`);
    enqueueEmbeddingRefresh(person.id, person.name, async () => {
      const newEmbedding = await generateEmbedding(expectedSearchText);
      await prisma.person.update({
        where: { id: person.id },
        data: { searchText: expectedSearchText, embedding: newEmbedding },
      });
      console.log(`[Jeffrey.AI] Refreshed embedding for "${person.name}" (${newEmbedding.length}D)`);
    });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const q = ((body.q as string) || "").trim();
    const k = Math.min(Math.max(parseInt(body.k as string, 10) || K_DEFAULT, 1), 50);

    if (!q) {
      return Response.json({ results: [] });
    }

    console.log(`[Jeffrey.AI] Hybrid search: "${q}", k=${k}`);

    // 1. Try to generate query embedding (failure → fuzzy-only mode)
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await generateEmbedding(q);
    } catch (embError) {
      console.warn(`[Jeffrey.AI] Embedding generation failed, falling back to fuzzy search:`, embError);
    }

    // 2. Single query: ALL non-deleted persons, including embedding + searchText
    const allPersons = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        careers: unknown;
        interests: unknown;
        vibeTags: string[];
        relationshipScore: number;
        lastContactDate: Date;
        embedding: unknown;
        searchText: string;
      }>
    >(Prisma.sql`SELECT id, name, careers, interests, "vibeTags", "relationshipScore", "lastContactDate", "embedding", "searchText"
      FROM "Person"
      WHERE "userId" = ${session.user.id}::uuid
        AND "deletedAt" IS NULL`);

    // 3. Compute semantic scores for persons that have an embedding
    const semanticMap = new Map<string, number>();
    if (queryEmbedding.length > 0) {
      for (const p of allPersons) {
        const emb = parseEmbedding(p.embedding);
        if (emb.length > 0) {
          semanticMap.set(p.id, cosineSimilarity(queryEmbedding, emb));
          // Detect and background-refresh stale embeddings
          refreshStaleEmbeddingIfNeeded({ ...p, vibeTags: p.vibeTags ?? [] });
        }
      }
    }

    // 4. Fuzzy match: name / careers / interests / vibeTags substring
    const q_lower = q.toLowerCase();
    const fuzzySet = new Set<string>();
    for (const p of allPersons) {
      const nameMatch = p.name.toLowerCase().includes(q_lower);
      const careerMatch = ((p.careers as WeightedTag[]) ?? []).some(
        (c) => (c.name ?? "").toLowerCase().includes(q_lower)
      );
      const interestMatch = ((p.interests as WeightedTag[]) ?? []).some(
        (i) => (i.name ?? "").toLowerCase().includes(q_lower)
      );
      const vibeMatch = (p.vibeTags ?? []).some((t) => t.toLowerCase().includes(q_lower));
      if (nameMatch || careerMatch || interestMatch || vibeMatch) {
        fuzzySet.add(p.id);
      }
    }

    // 5. Score every person: semantic wins; fuzzy fills gaps
    const scored = allPersons
      .map((p) => {
        const semScore = semanticMap.get(p.id);
        const fuzzyHit = fuzzySet.has(p.id);
        if (semScore !== undefined) {
          return { id: p.id, name: p.name, careers: p.careers, interests: p.interests, vibeTags: p.vibeTags ?? [], relationshipScore: p.relationshipScore, lastContactDate: p.lastContactDate, similarity: semScore };
        }
        if (fuzzyHit) {
          return { id: p.id, name: p.name, careers: p.careers, interests: p.interests, vibeTags: p.vibeTags ?? [], relationshipScore: p.relationshipScore, lastContactDate: p.lastContactDate, similarity: 0.5 };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    console.log(
      `[Jeffrey.AI] Search "${q}" → semantic:${semanticMap.size} fuzzy:${fuzzySet.size} → top:`,
      scored.map((r) => `${r.name}(${r.similarity.toFixed(2)})`).join(", ")
    );

    return Response.json({ results: scored });
  } catch (error) {
    console.error("[Jeffrey.AI] Search error:", error);
    return Response.json(
      { error: "Search failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const k = parseInt(searchParams.get("k") ?? String(K_DEFAULT), 10);

  return POST(
    new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, k }),
    })
  );
}

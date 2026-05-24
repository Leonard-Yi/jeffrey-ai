import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateEmbedding, buildPersonSearchText, type WeightedTag } from "@/lib/embedding";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { enqueueEmbeddingRefresh } from "@/lib/embeddingQueue";
import { encryptJson } from "@/lib/crypto";

const SearchRequestSchema = z.object({
  q: z.string().optional().default(""),
  k: z.number().int().min(1).max(50).optional().default(10),
});

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
  person: { id: string; name: string; careers: unknown; interests: unknown; vibeTags: string[]; searchText: string },
  encKey: Buffer,
) {
  const expectedSearchText = buildPersonSearchText({
    name: person.name,
    careers: (person.careers ?? []) as WeightedTag[],
    interests: (person.interests ?? []) as WeightedTag[],
    vibeTags: person.vibeTags ?? [],
  });

  if (expectedSearchText !== person.searchText) {
    console.warn(`[Jeffrey.AI] Stale embedding detected for person id="${person.id}"`);
    enqueueEmbeddingRefresh(person.id, person.name, async () => {
      const newEmbedding = await generateEmbedding(expectedSearchText);
      // Write encrypted embedding through raw prisma (background task, no store available)
      await prisma.person.update({
        where: { id: person.id },
        data: { searchText: expectedSearchText, embedding: encryptJson(newEmbedding, encKey) },
      });
      console.log(`[Jeffrey.AI] Refreshed embedding for person id="${person.id}" (${newEmbedding.length}D)`);
    });
  }
}

/** Safe cast: ensure we always get an array, even if cryptoStore returned raw text. */
function safeTagArray(raw: unknown): Array<{ name: string }> {
  if (Array.isArray(raw)) return raw.filter((t): t is { name: string } => t && typeof t.name === 'string');
  return [];
}

function safeStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  return [];
}

export async function POST(request: Request) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const body = await request.json();
    const parsed = SearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }
    const q = parsed.data.q.trim();
    const k = parsed.data.k;

    if (!q) {
      return Response.json({ results: [] });
    }

    console.log(`[Jeffrey.AI] Hybrid search: k=${k}`);

    // 1. Try to generate query embedding (failure → fuzzy-only mode)
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await generateEmbedding(q);
    } catch (embError) {
      console.warn(`[Jeffrey.AI] Embedding generation failed, falling back to fuzzy search:`, embError);
    }

    // 2. Fetch all non-deleted persons with decrypted fields
    const allPersons = await store.person.findMany({
      where: {
        userId: keys.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        careers: true,
        interests: true,
        vibeTags: true,
        relationshipScore: true,
        lastContactDate: true,
        embedding: true,
        searchText: true,
      },
    });

    // 3. Compute semantic scores for persons that have an embedding
    const semanticMap = new Map<string, number>();
    if (queryEmbedding.length > 0) {
      for (const p of allPersons) {
        const emb = parseEmbedding(p.embedding);
        if (emb.length > 0) {
          semanticMap.set(p.id, cosineSimilarity(queryEmbedding, emb));
          // Detect and background-refresh stale embeddings
          refreshStaleEmbeddingIfNeeded({ ...p, vibeTags: (p.vibeTags ?? []) as string[] }, keys.encKey);
        }
      }
    }

    // 4. Fuzzy match: name / careers / interests / vibeTags substring
    const q_lower = q.toLowerCase();
    const fuzzySet = new Set<string>();
    const fuzzyScores = new Map<string, number>();
    for (const p of allPersons) {
      let bestScore = 0;
      if (p.name.toLowerCase().includes(q_lower)) bestScore = Math.max(bestScore, 0.8);
      const careers = safeTagArray(p.careers);
      const interests = safeTagArray(p.interests);
      const vibeTags = safeStringArray(p.vibeTags);
      if (careers.some(c => (c.name ?? "").toLowerCase().includes(q_lower))) bestScore = Math.max(bestScore, 0.7);
      if (interests.some(i => (i.name ?? "").toLowerCase().includes(q_lower))) bestScore = Math.max(bestScore, 0.6);
      if (vibeTags.some(t => t.toLowerCase().includes(q_lower))) bestScore = Math.max(bestScore, 0.5);
      if (bestScore > 0) {
        fuzzySet.add(p.id);
        fuzzyScores.set(p.id, bestScore);
      }
    }

    // 5. Score every person: semantic wins; fuzzy fills gaps
    const scored = allPersons
      .map((p) => {
        const semScore = semanticMap.get(p.id);
        const fuzzyHit = fuzzySet.has(p.id);
        if (semScore !== undefined) {
          return { id: p.id, name: p.name, careers: p.careers, interests: p.interests, vibeTags: (p.vibeTags ?? []) as string[], relationshipScore: p.relationshipScore, lastContactDate: p.lastContactDate, similarity: semScore };
        }
        if (fuzzyHit) {
          return { id: p.id, name: p.name, careers: p.careers, interests: p.interests, vibeTags: safeStringArray(p.vibeTags), relationshipScore: p.relationshipScore, lastContactDate: p.lastContactDate, similarity: fuzzyScores.get(p.id) ?? 0.5 };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    console.log(
      `[Jeffrey.AI] Search → semantic:${semanticMap.size} fuzzy:${fuzzySet.size} → top: ${scored.length} results`
    );

    return Response.json({ results: scored });
  } catch (error) {
    console.error("[Jeffrey.AI] Search error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const k = parseInt(searchParams.get("k") ?? "10", 10);

  return POST(
    new Request("http://localhost/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, k }),
    })
  );
}

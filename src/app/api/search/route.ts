import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/embedding";
import { auth } from "@/lib/auth";
import { sql } from "@prisma/client";

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

    console.log(`[Jeffrey.AI] Semantic search: "${q}", k=${k}`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(q);

    // Fetch all persons with non-empty embeddings AND at least one career or interest
    // This filters out placeholder contacts with no real profile data (e.g. "矿泉水")
    const persons = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        careers: unknown;
        interests: unknown;
        vibeTags: string[];
        relationshipScore: number;
        lastContactDate: Date;
        embedding: number[];
      }>
    >(sql`SELECT id, name, careers, interests, "vibeTags", "relationshipScore", "lastContactDate", "embedding"
      FROM "Person"
      WHERE "userId" = ${session.user.id}::uuid
        AND jsonb_array_length("embedding") > 0
        AND (jsonb_array_length("careers") > 0 OR jsonb_array_length("interests") > 0)`);

    if (persons.length === 0) {
      return Response.json({ results: [] });
    }

    // Compute cosine similarity for each person
    const scored = persons
      .map((p) => {
        const embRaw = p.embedding;
        let emb: number[];
        if (Array.isArray(embRaw)) {
          emb = embRaw as number[];
        } else if (typeof embRaw === "string") {
          try {
            emb = JSON.parse(embRaw) as number[];
          } catch {
            emb = [];
          }
        } else {
          emb = [];
        }
        if (emb.length === 0) return null;
        return {
          id: p.id,
          name: p.name,
          careers: p.careers,
          interests: p.interests,
          vibeTags: p.vibeTags ?? [],
          relationshipScore: p.relationshipScore,
          lastContactDate: p.lastContactDate,
          similarity: cosineSimilarity(queryEmbedding, emb),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    console.log(`[Jeffrey.AI] Search "${q}" → top:`, scored.map((r) => `${r.name}(${r.similarity.toFixed(3)})`).join(", "));

    return Response.json({ results: scored });
  } catch (error) {
    console.error("[Jeffrey.AI] Semantic search error:", error);
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

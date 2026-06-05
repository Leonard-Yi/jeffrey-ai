import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/embedding";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { detectNames } from "@/lib/nameDetector";

const ResolveRequestSchema = z.object({
  text: z.string(),
});

/**
 * Extracts person names from Chinese text using NameDetector.
 * No regex guessing, no jieba nr — uses the same engine as pseudonymizer.
 */
function extractNames(text: string): string[] {
  try {
    const entities = detectNames(text);
    return [...new Set(entities.map(e => e.text))];
  } catch {
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function POST(request: NextRequest) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  // Check if key rotation is in progress (blocks writes)
  const resolvingUser = await prisma.user.findUnique({
    where: { id: keys.userId },
    select: { keyRotationInProgress: true }
  });
  if (resolvingUser?.keyRotationInProgress) {
    return NextResponse.json(
      { error: "密钥更新中，请稍后再试" },
      { status: 423 }
    );
  }

  try {
    console.log('[DEBUG] Resolve API called');
    const body = await request.json();
    const parsed = ResolveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }
    const { text } = parsed.data;
    console.log('[DEBUG] Received text length:', text?.length);

    if (!text?.trim()) {
      return NextResponse.json({ resolutions: [] });
    }

    const extracted = extractNames(text);
    console.log('[DEBUG] Extracted names count:', extracted.length);

    const mentionedNames = extractNames(text);

    if (mentionedNames.length === 0) {
      return NextResponse.json({ resolutions: [] });
    }
    const persons = await store.person.findMany({
      where: {
        userId: keys.userId,
        deletedAt: null,
        mergedIntoId: null,
        embedding: { not: null },
      },
      select: {
        id: true,
        name: true,
        searchText: true,
        embedding: true,
        careers: true,
        interests: true,
      },
    });

    if (persons.length === 0) {
      return NextResponse.json({ resolutions: mentionedNames.map((name) => ({ mentionedName: name, candidates: [] })) });
    }

    // For each mentioned name, compute similarity with all existing persons
    const resolutions = await Promise.all(
      mentionedNames.map(async (mentionedName) => {
        const candidates: Array<{
          id: string;
          name: string;
          similarity: number;
          matchType: "exact" | "embedding";
          careers: unknown[];
        }> = [];

        // 1. Exact match (case-insensitive, nickname-aware)
        const exactMatch = persons.find(
          (p) =>
            p.name === mentionedName ||
            (p as { aliases?: string[] }).aliases?.includes(mentionedName)
        );
        if (exactMatch) {
          candidates.push({
            id: exactMatch.id,
            name: exactMatch.name,
            similarity: 1.0,
            matchType: "exact",
            careers: exactMatch.careers as unknown[],
          });
        }

        // 2. Embedding similarity (only if no exact match, or for additional candidates)
        try {
          const nameEmbedding = await generateEmbedding(mentionedName);

          // Compute similarity with all persons
          const similarities = persons
            .filter((p) => {
              // Skip if already added as exact match
              if (exactMatch && p.id === exactMatch.id) return false;
              // Skip if name is too different in length (likely not same person)
              if (Math.abs(p.name.length - mentionedName.length) > 2) return false;
              return true;
            })
            .map((p) => {
              const emb = p.embedding as number[];
              if (!emb || emb.length === 0) return { person: p, similarity: 0 };
              const sim = cosineSimilarity(nameEmbedding, emb);
              return { person: p, similarity: sim };
            })
            .filter((s) => s.similarity > 0.5) // Threshold: 50%
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3); // Top 3 candidates

          for (const { person, similarity } of similarities) {
            candidates.push({
              id: person.id,
              name: person.name,
              similarity,
              matchType: "embedding",
              careers: person.careers as unknown[],
            });
          }
        } catch (embErr) {
          console.error("[Jeffrey.AI] Embedding similarity failed:", embErr);
        }

        // Only return if there are candidates
        return {
          mentionedName,
          candidates: candidates.sort((a, b) => b.similarity - a.similarity),
        };
      })
    );

    // Only include names that have candidates
    const filteredResolutions = resolutions
      .filter((r) => r.candidates.length > 0)
      .map((r) => ({
        mentionedName: r.mentionedName,
        candidates: r.candidates,
      }));

    return NextResponse.json({ resolutions: filteredResolutions });
  } catch (err) {
    console.error("[Jeffrey.AI] Resolve failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

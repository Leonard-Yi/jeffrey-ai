import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/embedding";

/**
 * Extracts potential person names from Chinese text.
 * Uses trigger patterns like "和X" to find names.
 */
function extractNames(text: string): string[] {
  // Extract 2-char Chinese names after common triggers
  const triggerPattern = /(?:和|与|同|跟|和 |、)([\u4e00-\u9fa5]{2})/g;
  const matches: string[] = [];

  const triggerMatches = text.matchAll(triggerPattern);
  for (const m of triggerMatches) {
    if (m[1]) matches.push(m[1]);
  }

  // Also try to find 2-char Chinese substrings that look like names (no trigger word)
  // This is a fallback - only use names that are common person name patterns
  const namePattern = /([\u4e00-\u9fa5]{2})/g;
  const seen = new Set(matches);
  for (const m of text.matchAll(namePattern)) {
    const name = m[1];
    // Skip common words that aren't names
    const skipWords = ['今天', '昨天', '明天', '前年', '去年', '明年', '什么', '怎么', '哪个', '哪里', '为什么', '大约', '可能', '如果', '然后', '因为', '所以', '但是', '而且', '或者'];
    if (name && !skipWords.includes(name) && !seen.has(name)) {
      seen.add(name);
      matches.push(name);
    }
  }

  return [...new Set(matches)];
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
  try {
    console.log('[DEBUG] Resolve API called');
    const { text } = await request.json() as { text: string };
    console.log('[DEBUG] Received text:', text);

    if (!text?.trim()) {
      return NextResponse.json({ resolutions: [] });
    }

    const extracted = extractNames(text);
    console.log('[DEBUG] Extracted names:', extracted);

    const mentionedNames = extractNames(text);

    if (mentionedNames.length === 0) {
      return NextResponse.json({ resolutions: [] });
    }
    const persons = await prisma.person.findMany({
      where: {
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

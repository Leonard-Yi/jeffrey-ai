import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/embedding";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";

const ResolveRequestSchema = z.object({
  text: z.string(),
});

/**
 * Chinese surnames for name validation.
 */
const CHINESE_SURNAMES = new Set([
  "王","李","张","刘","陈","杨","黄","赵","周","吴",
  "徐","孙","马","胡","朱","郭","何","罗","高","林",
  "郑","梁","谢","宋","唐","许","邓","韩","冯","曹",
  "彭","曾","肖","田","董","潘","袁","蔡","蒋","余",
  "于","杜","叶","程","魏","苏","吕","丁","任","卢",
  "姚","沈","钟","姜","崔","谭","陆","汪","范","金",
  "石","廖","贾","夏","韦","付","方","白","邹","孟",
  "熊","秦","邱","江","尹","薛","闫","段","雷","侯",
  "龙","史","陶","黎","贺","顾","毛","郝","龚","邵",
  "万","钱","严","覃","武","戴","莫","孔","向","汤",
]);

const KNOWN_NON_PERSON = new Set([
  "星巴克", "麦当劳", "肯德基",
]);

/**
 * Extracts person names from Chinese text using jieba NER.
 * Merges adjacent nr tokens (up to 3 chars) and validates against surname list.
 */
function extractNames(text: string): string[] {
  try {
    const { Jieba } = require("@node-rs/jieba");
    const { dict } = require("@node-rs/jieba/dict");
    const jieba = new Jieba();
    jieba.loadDict(dict);

    const tagged = jieba.tag(text) as Array<{ word: string; tag: string }>;

    // Merge adjacent nr tokens (same logic as pseudonymizer)
    const names: string[] = [];
    let i = 0;
    while (i < tagged.length) {
      const item = tagged[i];
      if (item.tag === "nr" && !KNOWN_NON_PERSON.has(item.word)) {
        let merged = item.word;
        let mergeCount = 1;
        while (
          i + mergeCount < tagged.length &&
          tagged[i + mergeCount].tag === "nr" &&
          !KNOWN_NON_PERSON.has(tagged[i + mergeCount].word) &&
          (merged.length + tagged[i + mergeCount].word.length) <= 3
        ) {
          merged += tagged[i + mergeCount].word;
          mergeCount++;
        }
        // Validate: must be 2+ chars OR start with known surname
        if (merged.length >= 2 && CHINESE_SURNAMES.has(merged.charAt(0))) {
          names.push(merged);
        }
        i += mergeCount;
      } else {
        i++;
      }
    }
    return [...new Set(names)];
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

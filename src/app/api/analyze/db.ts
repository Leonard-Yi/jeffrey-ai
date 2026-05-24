// 用于 Next.js API 的数据库存储函数
// 使用共享的 Prisma 单例

import { buildPersonSearchText, generateEmbedding, type WeightedTag } from "@/lib/embedding";
import { mergeTags } from "@/lib/dbUtils";
import type { CryptoStore } from "@/lib/cryptoStore";

interface ExtractionData {
  persons: Array<{
    name?: string;
    careers?: WeightedTag[];
    interests?: WeightedTag[];
    vibeTags?: string[];
  }>;
  date?: string;  // 可选，为空时使用当前日期
  location?: string;
  contextType?: string;
  sentiment?: string;
  actionItems: Array<{
    description: string;
    ownedBy: "me" | "them" | "both";
    resolved: boolean;
  }>;
  coreMemories: string[];
}

/** Calculate relationship score boost based on interaction depth. */
function calculateScoreBoost(data: {
  sentiment?: string;
  coreMemories?: string[];
  actionItems?: Array<{ description: string }>;
  contextType?: string;
}): number {
  let boost = 1; // Base: every recorded interaction counts
  if (data.sentiment) boost += 1;
  if ((data.coreMemories?.length ?? 0) > 0) boost += 2;
  if ((data.actionItems?.length ?? 0) > 0) boost += 2;
  if (data.contextType) boost += 1;
  return boost; // Range: 1–7
}

async function upsertPerson(
  extracted: { name?: string; careers?: WeightedTag[]; interests?: WeightedTag[]; vibeTags?: string[] },
  interactionDate: Date,
  userId: string,
  store: CryptoStore
): Promise<string> {
  const name = extracted.name || "未知";
  const existing = await store.person.findFirst({
    where: { name, userId },
  });
  console.log("[Jeffrey.AI] Existing person lookup:", { userId, found: !!existing });

  if (existing) {
    const mergedCareers = mergeTags(existing.careers as WeightedTag[], extracted.careers || []);
    const mergedInterests = mergeTags(existing.interests as WeightedTag[], extracted.interests || []);
    const mergedVibes = Array.from(new Set([...existing.vibeTags, ...(extracted.vibeTags || [])]));

    // Score boost applied AFTER interaction creation (see saveExtractionToDb)
    await store.person.update({
      where: { id: existing.id },
      data: {
        careers: mergedCareers,
        interests: mergedInterests,
        vibeTags: mergedVibes,
        lastContactDate: interactionDate,
      },
    });

    // Update searchText and embedding for semantic matching
    const searchText = buildPersonSearchText({
      name: existing.name,
      careers: mergedCareers as WeightedTag[],
      interests: mergedInterests as WeightedTag[],
      vibeTags: mergedVibes,
    });
    let embedding: number[] = [];
    try {
      embedding = await generateEmbedding(searchText);
    } catch (embErr) {
      console.error("[Jeffrey.AI] Failed to generate embedding:", embErr);
    }
    await store.person.update({
      where: { id: existing.id },
      data: { searchText, embedding },
    });

    return existing.id;
  }

  const searchText = buildPersonSearchText({
    name,
    careers: extracted.careers || [],
    interests: extracted.interests || [],
    vibeTags: extracted.vibeTags || [],
  });
  let embedding: number[] = [];
  try {
    embedding = await generateEmbedding(searchText);
  } catch (embErr) {
    console.error("[Jeffrey.AI] Failed to generate embedding:", embErr);
  }

  console.log("[Jeffrey.AI] Creating person:", { userId, embeddingLength: embedding.length });
  const person = await store.person.create({
    data: {
      name,
      userId,
      careers: extracted.careers || [],
      interests: extracted.interests || [],
      vibeTags: extracted.vibeTags || [],
      relationshipScore: 10,
      lastContactDate: interactionDate,
      searchText,
      embedding,
    },
  });
  console.log("[Jeffrey.AI] Person created:", person.id);

  return person.id;
}

export async function saveExtractionToDb(data: ExtractionData, createInteraction = false, userId?: string, store?: CryptoStore): Promise<{
  interactionId: string;
  personIds: string[];
}> {
  console.log("[Jeffrey.AI] saveExtractionToDb called:", {
    createInteraction,
    hasContextType: !!data.contextType,
    hasSentiment: !!data.sentiment,
    hasDate: !!data.date,
    date: data.date,
    actionItemsCount: data.actionItems?.length,
    personsCount: data.persons?.length,
  });

  // 如果没有提供日期，使用当前日期作为默认值
  let interactionDate: Date;
  if (data.date) {
    interactionDate = new Date(data.date);
    if (isNaN(interactionDate.getTime())) {
      console.warn("[Jeffrey.AI] Invalid date provided, using current date");
      interactionDate = new Date();
    }
  } else {
    interactionDate = new Date();
    console.log("[Jeffrey.AI] No date provided, using current date:", interactionDate.toISOString());
  }

  // 始终先更新人物信息（即使没有完整的互动数据）
  const personIds = await Promise.all(
    data.persons.map((p) =>
      upsertPerson(
        {
          name: p.name,
          careers: p.careers || [],
          interests: p.interests || [],
          vibeTags: p.vibeTags || [],
        },
        interactionDate,
        userId!,
        store!
      )
    )
  );

  // 如果没有有效的互动数据（contextType 和 sentiment 都为空），只更新人物不创建互动
  // 除非 createInteraction=true（如追问回复后的 pending→complete 场景）
  if (!data.contextType && !data.sentiment && !createInteraction) {
    console.log("[Jeffrey.AI] No interaction data, only updating persons");
    return { interactionId: "", personIds };
  }

  console.log("[Jeffrey.AI] Creating interaction with:", {
    date: interactionDate.toISOString(),
    contextType: data.contextType,
    sentiment: data.sentiment,
    actionItemsCount: data.actionItems?.length,
    coreMemoriesCount: data.coreMemories?.length,
    personCount: personIds.length,
  });

  console.log("[Jeffrey.AI] About to create interaction for userId:", userId);
  const interaction = await store.interaction.create({
    data: {
      userId: userId!,
      date: interactionDate,
      location: data.location || "",
      contextType: data.contextType || "",
      sentiment: data.sentiment || "",
      actionItems: data.actionItems,
      coreMemories: data.coreMemories,
      persons: {
        create: personIds.map((personId) => ({ personId, userId: userId! })),
      },
    },
  });

  // Apply relationship score boost based on interaction quality
  const boost = calculateScoreBoost({
    sentiment: data.sentiment,
    coreMemories: data.coreMemories,
    actionItems: data.actionItems,
    contextType: data.contextType,
  });
  for (const personId of personIds) {
    const person = await store.person.findUnique({ where: { id: personId }, select: { relationshipScore: true } });
    if (person) {
      const newScore = Math.min(100, person.relationshipScore + boost);
      await store.person.update({ where: { id: personId }, data: { relationshipScore: newScore } });
    }
  }
  console.log("[Jeffrey.AI] Applied score boost:", boost, "→", personIds.length, "persons");

  return { interactionId: interaction.id, personIds };
}

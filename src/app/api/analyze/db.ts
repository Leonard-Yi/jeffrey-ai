// 用于 Next.js API 的数据库存储函数
// 使用共享的 Prisma 单例

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildPersonSearchText, generateEmbedding, type WeightedTag } from "@/lib/embedding";
import { mergeTags } from "@/lib/dbUtils";

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

async function upsertPerson(
  extracted: { name?: string; careers?: WeightedTag[]; interests?: WeightedTag[]; vibeTags?: string[] },
  interactionDate: Date,
  userId: string
): Promise<string> {
  const name = extracted.name || "未知";
  const existing = await prisma.person.findFirst({
    where: { name, userId },
  });

  if (existing) {
    const mergedCareers = mergeTags(existing.careers as WeightedTag[], extracted.careers || []);
    const mergedInterests = mergeTags(existing.interests as WeightedTag[], extracted.interests || []);
    const mergedVibes = Array.from(new Set([...existing.vibeTags, ...(extracted.vibeTags || [])]));
    const newScore = Math.min(100, existing.relationshipScore + 2);

    await prisma.person.update({
      where: { id: existing.id },
      data: {
        careers: mergedCareers,
        interests: mergedInterests,
        vibeTags: mergedVibes,
        relationshipScore: newScore,
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
    await prisma.person.update({
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

  const person = await prisma.person.create({
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

  return person.id;
}

export async function saveExtractionToDb(data: ExtractionData, createInteraction = false, userId?: string): Promise<{
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
        userId!
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
    location: data.location,
    contextType: data.contextType,
    sentiment: data.sentiment,
    actionItems: data.actionItems,
    coreMemories: data.coreMemories,
    personIds,
  });

  const interaction = await prisma.interaction.create({
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

  return { interactionId: interaction.id, personIds };
}

// 用于 Next.js API 的数据库存储函数
// 使用共享的 Prisma 单例

import { buildPersonSearchText, generateEmbedding, type WeightedTag } from "@/lib/embedding";
import { mergeTags } from "@/lib/dbUtils";
import { computeNameHash, encrypt, encryptJson, encryptStringArray } from "@/lib/crypto";
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

/**
 * One-time backfill: encrypt all plaintext fields and compute nameHash
 * for legacy records created before field-level encryption was added.
 * Safe to call repeatedly — only touches records with nameHash = null.
 * Idempotent: skips fields already starting with "v1:".
 */
export async function backfillLegacyEncryption(
  userId: string,
  store: CryptoStore,
  encKey: Buffer,
  pseudoKey: Buffer,
): Promise<number> {
  const rawPersons = await store.raw.person.findMany({
    where: { userId, nameHash: null },
    select: {
      id: true, name: true, aliases: true, careers: true, interests: true,
      vibeTags: true, baseCities: true, favoritePlaces: true,
      searchText: true, icebreakerData: true,
    },
  });

  const personUpdates: Promise<unknown>[] = [];
  for (const p of rawPersons) {
    const data: Record<string, unknown> = {};

    if (!p.name.startsWith("v1:")) {
      data.nameHash = computeNameHash(p.name, pseudoKey);
      data.name = encrypt(p.name, encKey);
    }
    for (const f of ["searchText"] as const) {
      const v = p[f];
      if (typeof v === "string" && v && !v.startsWith("v1:")) {
        data[f] = encrypt(v, encKey);
      }
    }
    for (const f of ["careers", "interests", "icebreakerData"] as const) {
      const v = p[f];
      if (v != null && typeof v === "object") {
        data[f] = encryptJson(v, encKey);
      }
    }
    for (const f of ["vibeTags", "aliases", "baseCities", "favoritePlaces"] as const) {
      const v = p[f];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && !v[0].startsWith("v1:")) {
        data[f] = encryptStringArray(v as string[], encKey);
      }
    }

    if (Object.keys(data).length > 0) {
      personUpdates.push(store.raw.person.update({ where: { id: p.id }, data }));
    }
  }
  await Promise.all(personUpdates);
  const count = personUpdates.length;

  // Interactions: quick check — if first record is already encrypted, skip all
  const sampleInteraction = await store.raw.interaction.findFirst({
    where: { userId },
    select: { coreMemories: true },
    orderBy: { createdAt: "asc" },
  });
  if (!sampleInteraction || (Array.isArray(sampleInteraction.coreMemories) && sampleInteraction.coreMemories.length > 0 && typeof sampleInteraction.coreMemories[0] === "string" && sampleInteraction.coreMemories[0].startsWith("v1:"))) {
    return count; // already backfilled — nothing to do for interactions
  }

  const rawInteractions = await store.raw.interaction.findMany({
    where: { userId },
    select: {
      id: true, location: true, contextType: true, sentiment: true,
      actionItems: true, coreMemories: true,
    },
  });

  const interactionUpdates: Promise<unknown>[] = [];
  for (const ix of rawInteractions) {
    const data: Record<string, unknown> = {};

    for (const f of ["location", "contextType", "sentiment"] as const) {
      const v = ix[f];
      if (typeof v === "string" && v && !v.startsWith("v1:")) {
        data[f] = encrypt(v, encKey);
      }
    }
    if (ix.actionItems != null && typeof ix.actionItems === "object") {
      data.actionItems = encryptJson(ix.actionItems, encKey);
    }
    if (Array.isArray(ix.coreMemories) && ix.coreMemories.length > 0 && typeof ix.coreMemories[0] === "string" && !ix.coreMemories[0].startsWith("v1:")) {
      data.coreMemories = encryptStringArray(ix.coreMemories as string[], encKey);
    }

    if (Object.keys(data).length > 0) {
      interactionUpdates.push(store.raw.interaction.update({ where: { id: ix.id }, data }));
    }
  }
  await Promise.all(interactionUpdates);

  return count;
}

async function upsertPerson(
  extracted: { name?: string; careers?: WeightedTag[]; interests?: WeightedTag[]; vibeTags?: string[] },
  interactionDate: Date,
  userId: string,
  store: CryptoStore,
  pseudoKey: Buffer,
  encKey: Buffer,
): Promise<string> {
  const name = extracted.name || "未知";
  const nameHash = computeNameHash(name, pseudoKey);

  // Primary lookup: nameHash (deterministic, works with encrypted name storage)
  let existing = await store.person.findFirst({
    where: { nameHash, userId },
  });

  // Fallback: plaintext name lookup for legacy records created before nameHash
  if (!existing) {
    const rawPerson = await store.raw.person.findFirst({
      where: { name, userId },
    });
    if (rawPerson) {
      // Backfill: encrypt name + compute nameHash so next lookup uses the fast path
      await store.raw.person.update({
        where: { id: rawPerson.id },
        data: { name: encrypt(name, encKey), nameHash },
      });
      existing = await store.person.findUnique({ where: { id: rawPerson.id } });
    }
  }

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
      nameHash,
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

export async function saveExtractionToDb(
  data: ExtractionData,
  createInteraction = false,
  userId?: string,
  store?: CryptoStore,
  pseudoKey?: Buffer,
  encKey?: Buffer,
): Promise<{
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
        store!,
        pseudoKey!,
        encKey!,
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

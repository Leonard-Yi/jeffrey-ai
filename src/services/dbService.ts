import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mergeTags } from "@/lib/dbUtils";
import type { WeightedTag } from "@/schemas/core";
import type { ExtractionPayload, ExtractedPerson } from "./llmExtractor";

// ─────────────────────────────────────────────
// Person upsert
// ─────────────────────────────────────────────

async function upsertPerson(
  extracted: ExtractedPerson,
  interactionDate: Date,
  userId: string
): Promise<string> {
  const existing = await prisma.person.findFirst({
    where: { name: extracted.name, userId },
    include: { tags: true },
  });

  if (existing) {
    // Merge weighted tags
    const mergedCareers = mergeTags(
      existing.careers as WeightedTag[],
      extracted.careers
    );
    const mergedInterests = mergeTags(
      existing.interests as WeightedTag[],
      extracted.interests
    );

    // Merge vibeTags: union, deduplicated
    const mergedVibes = Array.from(
      new Set([...existing.vibeTags, ...extracted.vibeTags])
    );

    // Nudge relationshipScore up slightly on each new interaction (cap at 100)
    const newScore = Math.min(100, existing.relationshipScore + 2);

    await prisma.$transaction([
      prisma.person.update({
        where: { id: existing.id },
        data: {
          careers: mergedCareers as Prisma.InputJsonValue,
          interests: mergedInterests as Prisma.InputJsonValue,
          vibeTags: mergedVibes,
          relationshipScore: newScore,
          lastContactDate: interactionDate,
        },
      }),
      // Rebuild flat tag index for this person
      prisma.personTag.deleteMany({ where: { personId: existing.id, userId } }),
      prisma.personTag.createMany({
        data: buildTagRows(existing.id, mergedCareers, mergedInterests, mergedVibes, userId),
      }),
    ]);

    return existing.id;
  }

  // New person
  const person = await prisma.person.create({
    data: {
      userId,
      name: extracted.name,
      careers: extracted.careers as Prisma.InputJsonValue,
      interests: extracted.interests as Prisma.InputJsonValue,
      vibeTags: extracted.vibeTags,
      relationshipScore: 10, // baseline for a newly recorded contact
      lastContactDate: interactionDate,
    },
  });

  await prisma.personTag.createMany({
    data: buildTagRows(
      person.id,
      extracted.careers,
      extracted.interests,
      extracted.vibeTags,
      userId
    ),
  });

  return person.id;
}

function buildTagRows(
  personId: string,
  careers: WeightedTag[],
  interests: WeightedTag[],
  vibes: string[],
  userId: string
): Prisma.PersonTagCreateManyInput[] {
  return [
    ...careers.map((t) => ({ personId, userId, category: "career", name: t.name, weight: t.weight })),
    ...interests.map((t) => ({ personId, userId, category: "interest", name: t.name, weight: t.weight })),
    ...vibes.map((v) => ({ personId, userId, category: "vibe", name: v, weight: 1.0 })),
  ];
}

// ─────────────────────────────────────────────
// Save a complete extraction payload
// ─────────────────────────────────────────────

export async function saveExtraction(payload: ExtractionPayload, userId: string): Promise<{
  interactionId: string;
  personIds: string[];
}> {
  if (payload.status === "pending") {
    throw new Error(
      "Cannot save an incomplete extraction. Resolve the follow-up first."
    );
  }

  const interactionDate = new Date(payload.date);

  // Upsert all persons in parallel, then create the interaction
  const personIds = await Promise.all(
    payload.persons.map((p) => upsertPerson(p, interactionDate, userId))
  );

  const interaction = await prisma.interaction.create({
    data: {
      userId,
      date: interactionDate,
      location: payload.location,
      contextType: payload.contextType,
      sentiment: payload.sentiment,
      actionItems: payload.actionItems as Prisma.InputJsonValue,
      coreMemories: payload.coreMemories,
      persons: {
        create: personIds.map((personId) => ({ personId, userId })),
      },
    },
  });

  return { interactionId: interaction.id, personIds };
}
                                                                                        
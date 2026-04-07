import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPersonSearchText, generateEmbedding } from "@/lib/embedding";
import { mergeTags } from "@/lib/dbUtils";
import type { WeightedTag } from "@/lib/embedding";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { survivorId, victimIds } = body as {
      survivorId: string;
      victimIds: string[];
    };

    if (!survivorId || !victimIds?.length) {
      return NextResponse.json(
        { error: "survivorId and victimIds[] are required" },
        { status: 400 }
      );
    }

    if (victimIds.includes(survivorId)) {
      return NextResponse.json(
        { error: "survivorId cannot be in victimIds" },
        { status: 400 }
      );
    }

    // Fetch all persons involved
    const allIds = [survivorId, ...victimIds];
    const persons = await prisma.person.findMany({
      where: { id: { in: allIds } },
    });

    if (persons.length !== allIds.length) {
      return NextResponse.json(
        { error: "One or more persons not found" },
        { status: 404 }
      );
    }

    const survivor = persons.find((p) => p.id === survivorId)!;
    const victims = persons.filter((p) => victimIds.includes(p.id));

    // Fetch victims' interactions and tags
    const victimInteractionData = await prisma.interactionPerson.findMany({
      where: { personId: { in: victimIds } },
    });
    const victimTags = await prisma.personTag.findMany({
      where: { personId: { in: victimIds } },
    });
    const survivorTags = await prisma.personTag.findMany({
      where: { personId: survivorId },
    });

    // === MERGE IN TRANSACTION ===
    const merged = await prisma.$transaction(async (tx) => {
      // 1. Merge aliases: victims' names + their existing aliases → survivor's aliases
      const allAliases = new Set<string>(survivor.aliases as string[]);
      for (const victim of victims) {
        allAliases.add(victim.name);
        for (const alias of (victim.aliases as string[])) {
          allAliases.add(alias);
        }
      }

      // 2. Merge careers and interests using mergeTags
      const mergedCareers = mergeTags(
        survivor.careers as WeightedTag[],
        victims.flatMap((v) => (v.careers as WeightedTag[]) || [])
      );
      const mergedInterests = mergeTags(
        survivor.interests as WeightedTag[],
        victims.flatMap((v) => (v.interests as WeightedTag[]) || [])
      );

      // 3. Merge array fields (union)
      const mergedVibeTags = Array.from(
        new Set([...(survivor.vibeTags || []), ...victims.flatMap((v) => v.vibeTags || [])])
      );
      const mergedBaseCities = Array.from(
        new Set([...(survivor.baseCities || []), ...victims.flatMap((v) => v.baseCities || [])])
      );
      const mergedFavoritePlaces = Array.from(
        new Set([...(survivor.favoritePlaces || []), ...victims.flatMap((v) => v.favoritePlaces || [])])
      );
      const mergedIntroducedByIds = Array.from(
        new Set([...(survivor.introducedByIds || []), ...victims.flatMap((v) => v.introducedByIds || [])])
      );

      // 4. Merge relationshipScore (max) and lastContactDate (most recent)
      const mergedScore = Math.max(
        survivor.relationshipScore,
        ...victims.map((v) => v.relationshipScore)
      );
      const mergedLastContact = new Date(
        Math.max(
          survivor.lastContactDate.getTime(),
          ...victims.map((v) => v.lastContactDate.getTime())
        )
      );

      // 5. Soft-delete all victims: set deletedAt and mergedIntoId
      await tx.person.updateMany({
        where: { id: { in: victimIds } },
        data: {
          deletedAt: new Date(),
          mergedIntoId: survivorId,
        },
      });

      // 6. Reassign InteractionPerson records from victims to survivor
      // First, find which interactions the survivor already has
      const survivorInteractionIds = new Set(
        (
          await tx.interactionPerson.findMany({
            where: { personId: survivorId },
            select: { interactionId: true },
          })
        ).map((r) => r.interactionId)
      );

      // Filter victims' interactions that aren't already linked to survivor
      const toMigrate = victimInteractionData.filter(
        (v) => !survivorInteractionIds.has(v.interactionId)
      );

      if (toMigrate.length > 0) {
        // Delete victim's records (they will be recreated under survivor)
        await tx.interactionPerson.deleteMany({
          where: {
            personId: { in: victimIds },
            interactionId: { in: toMigrate.map((v) => v.interactionId) },
          },
        });
        // Recreate under survivor
        await tx.interactionPerson.createMany({
          data: toMigrate.map((v) => ({
            personId: survivorId,
            interactionId: v.interactionId,
          })),
          skipDuplicates: true,
        });
      }

      // 7. Migrate PersonTag records
      // Delete existing survivor tags, then recreate merged
      await tx.personTag.deleteMany({ where: { personId: survivorId } });

      // Build merged tags map: start with survivor tags, then merge victim tags (recency bias)
      const tagMap = new Map<string, { category: string; name: string; weight: number }>();

      // Add survivor's existing tags first
      for (const tag of survivorTags) {
        tagMap.set(`${tag.category}:${tag.name}`, {
          category: tag.category,
          name: tag.name,
          weight: tag.weight,
        });
      }

      // Merge victim tags with recency bias
      for (const tag of victimTags) {
        const key = `${tag.category}:${tag.name}`;
        const existing = tagMap.get(key);
        if (existing) {
          existing.weight = existing.weight * (1 - 0.3) + tag.weight * 0.3;
        } else {
          tagMap.set(key, {
            category: tag.category,
            name: tag.name,
            weight: tag.weight,
          });
        }
      }

      // Create new merged tags
      const mergedTagRecords = Array.from(tagMap.values()).map((t) => ({
        personId: survivorId,
        category: t.category,
        name: t.name,
        weight: t.weight,
      }));

      if (mergedTagRecords.length > 0) {
        await tx.personTag.createMany({ data: mergedTagRecords });
      }

      // 8. Update survivor with merged data
      const updated = await tx.person.update({
        where: { id: survivorId },
        data: {
          aliases: Array.from(allAliases),
          careers: mergedCareers,
          interests: mergedInterests,
          vibeTags: mergedVibeTags,
          baseCities: mergedBaseCities,
          favoritePlaces: mergedFavoritePlaces,
          introducedByIds: mergedIntroducedByIds,
          relationshipScore: mergedScore,
          lastContactDate: mergedLastContact,
        },
      });

      return {
        updated,
        migratedInteractions: toMigrate.length,
        migratedTags: victimTags.length,
      };
    });

    // 9. Regenerate searchText and embedding for survivor (outside transaction)
    const searchText = buildPersonSearchText({
      name: merged.updated.name,
      careers: merged.updated.careers as WeightedTag[],
      interests: merged.updated.interests as WeightedTag[],
      vibeTags: merged.updated.vibeTags,
    });

    let embedding: number[] = [];
    try {
      embedding = await generateEmbedding(searchText);
    } catch (embErr) {
      console.error("[Jeffrey.AI] Failed to generate embedding during merge:", embErr);
    }

    const finalPerson = await prisma.person.update({
      where: { id: survivorId },
      data: { searchText, embedding },
    });

    return NextResponse.json({
      success: true,
      mergedPerson: finalPerson,
      migratedInteractions: merged.migratedInteractions,
      migratedTags: merged.migratedTags,
    });
  } catch (err) {
    console.error("[Jeffrey.AI] Merge failed:", err);
    return NextResponse.json(
      { error: "Merge failed", detail: String(err) },
      { status: 500 }
    );
  }
}

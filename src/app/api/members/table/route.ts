import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERSON_COLUMNS, renderRelativeDate } from "@/lib/schemaReader";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";

const SAFE_SORT_FIELDS = ["name", "relationshipScore", "lastContactDate"] as const;

type SafeSortField = typeof SAFE_SORT_FIELDS[number];

export async function GET(request: NextRequest) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") || "lastContactDate";
    const order = (searchParams.get("order") || "desc") as "asc" | "desc";
    const filterCareer = searchParams.get("filterCareer") || "";
    const filterCity = searchParams.get("filterCity") || "";
    const filterInterest = searchParams.get("filterInterest") || "";

    // Validate sort field - only allow safe fields to prevent SQL injection
    const safeSort = SAFE_SORT_FIELDS.includes(sort as SafeSortField)
      ? (sort as SafeSortField)
      : "lastContactDate";

    // Fetch all non-deleted, non-merged persons for this user
    // No DB-level encrypted-field filtering — filter in JS after decrypt
    const persons = await store.person.findMany({
      where: {
        userId: keys.userId,
        deletedAt: null,
        mergedIntoId: null,
      },
      orderBy: { [safeSort]: order },
      include: {
        introducedBy: {
          select: { id: true, name: true },
        },
        interactions: {
          include: {
            interaction: {
              select: { actionItems: true, coreMemories: true },
            },
          },
        },
      },
    });

    const rows = persons.map((person) => {
      // Count unresolved action items across all interactions
      const unresolvedCount = ((person.interactions as any[]) || []).reduce((count, ip) => {
        const items = (ip.interaction?.actionItems ?? []) as Array<{ description?: string; resolved?: boolean }>;
        return count + (items?.filter((item) => item.resolved === false).length || 0);
      }, 0);

      // Data comes back decrypted from cryptoStore — use directly
      const careers = (person.careers ?? []) as Array<{ name: string; weight: number }>;
      const interests = (person.interests ?? []) as Array<{ name: string; weight: number }>;

      if (filterCareer && !careers.some(c => c.name.includes(filterCareer))) return null;
      if (filterInterest && !interests.some(i => i.name.includes(filterInterest))) return null;
      if (filterCity && !(person.baseCities as string[] || []).includes(filterCity)) return null;

      return {
        id: person.id,
        name: person.name,
        careers: careers.map(c => `${c.name}(${Math.round(c.weight * 100)}%)`).join(", ") || "—",
        interests: interests.map(i => `${i.name}(${Math.round(i.weight * 100)}%)`).join(", ") || "—",
        vibeTags: ((person.vibeTags ?? []) as string[]).join(", ") || "—",
        baseCities: ((person.baseCities ?? []) as string[]).join(", ") || "—",
        favoritePlaces: ((person.favoritePlaces ?? []) as string[]).join(", ") || "—",
        relationshipScore: Math.round(person.relationshipScore),
        lastContactDate: renderRelativeDate(person.lastContactDate),
        introducedBy: (person.introducedBy as any)?.name || "—",
        actionItems: unresolvedCount,
        coreMemories: (() => {
          const interactionMems = ((person.interactions as any[]) || []).flatMap((ip: any) =>
            (ip.interaction?.coreMemories ?? []) as string[]
          );
          const unique = [...new Set(interactionMems)].slice(-20);
          return unique.length > 0 ? unique.join(" / ") : "—";
        })(),
      };
    }).filter((row): row is NonNullable<typeof rows[number]> => row !== null);

    return Response.json({
      columns: PERSON_COLUMNS,
      rows,
    });
  } catch (error) {
    console.error("Error in table API:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

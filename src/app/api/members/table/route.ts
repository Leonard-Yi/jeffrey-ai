import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { PERSON_COLUMNS, renderArray, renderRelativeDate } from "@/lib/schemaReader";
import { auth } from "@/lib/auth";

const SAFE_SORT_FIELDS = ["name", "relationshipScore", "lastContactDate"] as const;

type SafeSortField = typeof SAFE_SORT_FIELDS[number];

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Build where conditions — JSONB partial match done in JS after fetch
    // Exclude soft-deleted / merged persons
    const where: Parameters<typeof prisma.person.findMany>[0]["where"] = {
      userId: session.user.id,
      deletedAt: null,
      mergedIntoId: null,
    };

    if (filterCity) {
      // PostgreSQL text array contains
      where.baseCities = { has: filterCity };
    }

    const persons = await prisma.person.findMany({
      where,
      orderBy: { [safeSort]: order },
      include: {
        introducedBy: {
          select: { id: true, name: true },
        },
        interactions: {
          include: {
            interaction: {
              select: { actionItems: true },
            },
          },
        },
      },
    });

    const rows = persons.map((person) => {
      // Count unresolved action items across all interactions
      const unresolvedCount = person.interactions.reduce((count, ip) => {
        const items = ip.interaction.actionItems as Array<{ description?: string; resolved?: boolean }>;
        return count + (items?.filter((item) => item.resolved === false).length || 0);
      }, 0);

      // JSONB partial-name filtering in JS (Prisma JSONB array_contains requires exact match)
      const careers = (person.careers ?? []) as Array<{ name: string; weight: number }>;
      const interests = (person.interests ?? []) as Array<{ name: string; weight: number }>;

      if (filterCareer && !careers.some(c => c.name.includes(filterCareer))) return null;
      if (filterInterest && !interests.some(i => i.name.includes(filterInterest))) return null;

      return {
        id: person.id,
        name: person.name,
        careers: renderArray(careers),
        interests: renderArray(interests),
        vibeTags: (person.vibeTags ?? []).join(", "),
        baseCities: (person.baseCities ?? []).join(", "),
        favoritePlaces: (person.favoritePlaces ?? []).join(", "),
        relationshipScore: Math.round(person.relationshipScore),
        lastContactDate: renderRelativeDate(person.lastContactDate),
        introducedBy: person.introducedBy?.name || "—",
        actionItems: unresolvedCount,
      };
    }).filter((row): row is NonNullable<typeof rows[number]> => row !== null);

    return Response.json({
      columns: PERSON_COLUMNS,
      rows,
    });
  } catch (error) {
    console.error("Error in table API:", error);
    return Response.json(
      { error: "Failed to fetch table data: " + String((error as Error).message) },
      { status: 500 }
    );
  }
}
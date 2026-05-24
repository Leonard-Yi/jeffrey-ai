import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";

export async function GET(request: NextRequest) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "lastContactDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Fetch all non-deleted, non-merged persons for this user
    // Filter/search in memory since encrypted fields can't be queried at DB level
    const allPersons = await store.person.findMany({
      where: {
        userId: keys.userId,
        deletedAt: null,
        mergedIntoId: null,
      },
      orderBy: { [sortBy]: sortOrder },
      include: {
        introducedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Apply search filter in memory
    let filtered = allPersons;
    if (search) {
      const q = search.toLowerCase();
      filtered = allPersons.filter((person) => {
        const nameMatch = person.name.toLowerCase().includes(q);
        const vibeMatch = (person.vibeTags as string[] || []).some((t) =>
          t.toLowerCase().includes(q)
        );
        return nameMatch || vibeMatch;
      });
    }

    // Paginate in memory
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pagedPersons = filtered.slice(start, start + pageSize);

    // Format data
    const members = pagedPersons.map((person) => {
      const careers = (person.careers ?? []) as { name: string; weight: number }[];
      const interests = (person.interests ?? []) as { name: string; weight: number }[];

      return {
        id: person.id,
        name: person.name,
        careers: careers.map((c) => `${c.name}(${(c.weight * 100).toFixed(0)}%)`).join(", "),
        interests: interests.map((i) => `${i.name}(${(i.weight * 100).toFixed(0)}%)`).join(", "),
        vibeTags: (person.vibeTags as string[] || []).join(", "),
        baseCities: (person.baseCities as string[] || []).join(", "),
        favoritePlaces: (person.favoritePlaces as string[] || []).join(", "),
        relationshipScore: Math.round(person.relationshipScore),
        lastContactDate: person.lastContactDate.toISOString().split("T")[0],
        introducedBy: (person.introducedBy as any)?.name || "-",
      };
    });

    return Response.json({
      members,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error in members API:", error);
    return Response.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

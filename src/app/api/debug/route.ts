import { NextRequest, NextResponse } from "next/server";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const keys = await getEncryptionKeys();
    if (!keys) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const store = createCryptoStore(prisma, keys.encKey);

    const interactions = await store.interaction.findMany({
      take: 10,
      orderBy: { date: "desc" },
      include: {
        persons: {
          include: {
            person: true,
          },
        },
      },
    });

    const persons = await store.person.findMany({
      orderBy: { lastContactDate: "desc" },
    });

    return NextResponse.json({
      summary: {
        totalPersons: persons.length,
        totalInteractions: interactions.length,
      },
      recentInteractions: interactions.map((i) => ({
        id: i.id,
        date: i.date,
        contextType: i.contextType,
        sentiment: i.sentiment,
        persons: i.persons.map((ip: { person: { name: string } }) => ip.person.name),
        actionItemsCount: (i.actionItems as any[]).length,
        coreMemoriesCount: i.coreMemories.length,
      })),
      persons: persons.map((p) => ({
        id: p.id,
        name: p.name,
        careers: p.careers,
        interests: p.interests,
        vibeTags: p.vibeTags,
        relationshipScore: p.relationshipScore,
        lastContactDate: p.lastContactDate,
      })),
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

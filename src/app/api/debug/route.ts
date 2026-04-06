import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // 获取最近 10 条互动记录
    const interactions = await prisma.interaction.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        persons: {
          include: {
            person: true
          }
        }
      }
    });

    // 获取所有人物
    const persons = await prisma.person.findMany({
      orderBy: { lastContactDate: 'desc' }
    });

    // 格式化输出
    return Response.json({
      summary: {
        totalPersons: persons.length,
        totalInteractions: interactions.length
      },
      recentInteractions: interactions.map(i => ({
        id: i.id,
        date: i.date,
        contextType: i.contextType,
        sentiment: i.sentiment,
        persons: i.persons.map(ip => ip.person.name),
        actionItemsCount: (i.actionItems as any[]).length,
        coreMemoriesCount: i.coreMemories.length
      })),
      persons: persons.map(p => ({
        id: p.id,
        name: p.name,
        careers: p.careers,
        interests: p.interests,
        vibeTags: p.vibeTags,
        relationshipScore: p.relationshipScore,
        lastContactDate: p.lastContactDate
      }))
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
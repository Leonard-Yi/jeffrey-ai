import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "1天前";
  return `${diffDays}天前`;
}

function getDaysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function GET(_request: NextRequest) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const thirtyDaysAgo = subDays(new Date(), 30);

    // 1. 关系维护提醒：超过30天未联系的联系人
    // Fetch all persons and filter by lastContactDate in JS
    // (lastContactDate is not encrypted, but other fields in the person record are)
    const allPersons = await store.person.findMany({
      where: {
        userId: keys.userId,
        deletedAt: null,
        mergedIntoId: null,
      },
      orderBy: { lastContactDate: "asc" },
      select: {
        id: true,
        name: true,
        lastContactDate: true,
        relationshipScore: true,
        careers: true,
      },
    });

    const staleContacts = allPersons
      .filter((p) => new Date(p.lastContactDate) < thirtyDaysAgo)
      .slice(0, 10);

    // 2. 待办承诺提醒：ownedBy='me' 且 resolved=false 的事项
    // Fetch all interactions and filter in JS
    const allInteractions = await store.interaction.findMany({
      where: {
        userId: keys.userId,
      },
      include: {
        persons: {
          include: {
            person: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // 过滤出 ownedBy='me' 且 resolved=false 的事项
    type ActionItem = { description: string; ownedBy: string; resolved: boolean };
    const pendingDebts: Array<{
      id: string;
      personId: string;
      personName: string;
      description: string;
      interactionDate: string;
      daysSinceCreated: number;
    }> = [];

    for (const ip of allInteractions) {
      const items = (ip.actionItems ?? []) as ActionItem[];
      // 过滤出有效的 actionItems（非空数组）
      if (!items || !Array.isArray(items) || items.length === 0) continue;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.ownedBy === "me" && !item.resolved) {
          // 找到这个 interaction 中第一个人（通常是"我"）
          const firstPerson = (ip as any).persons?.[0]?.person;
          if (firstPerson) {
            pendingDebts.push({
              id: `${ip.id}-${i}`,
              personId: firstPerson.id,
              personName: firstPerson.name,
              description: item.description,
              interactionDate: formatRelativeTime(new Date(ip.date)),
              daysSinceCreated: getDaysSince(new Date(ip.date)),
            });
          }
        }
      }
    }

    // 按 daysSinceCreated 倒序
    pendingDebts.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);

    // 格式化 staleContacts
    const staleContactsFormatted = staleContacts.map((person) => {
      const careers = ((person.careers ?? []) as Array<{ name: string }>) || [];
      return {
        id: person.id,
        name: person.name,
        lastContactDate: formatRelativeTime(new Date(person.lastContactDate)),
        daysSinceContact: getDaysSince(new Date(person.lastContactDate)),
        careers: careers.map((c) => c.name).join("、") || "未知",
        relationshipScore: person.relationshipScore,
        reason:
          getDaysSince(new Date(person.lastContactDate)) > 60
            ? "很久没联系了"
            : "关系评分较低",
      };
    });

    return Response.json({
      staleContacts: staleContactsFormatted,
      pendingDebts: pendingDebts.slice(0, 10),
    });
  } catch (error) {
    console.error("Error in GET /api/suggestions/reminders:", error);
    return Response.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

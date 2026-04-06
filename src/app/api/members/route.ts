import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "lastContactDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // 构建查询条件
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { vibeTags: { has: search } },
          ],
        }
      : {};

    // 获取总数
    const total = await prisma.person.count({ where });

    // 获取分页数据
    const persons = await prisma.person.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        introducedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // 格式化数据
    const members = persons.map((person) => {
      const careers = person.careers as { name: string; weight: number }[];
      const interests = person.interests as { name: string; weight: number }[];

      return {
        id: person.id,
        name: person.name,
        careers: careers.map((c) => `${c.name}(${(c.weight * 100).toFixed(0)}%)`).join(", "),
        interests: interests.map((i) => `${i.name}(${(i.weight * 100).toFixed(0)}%)`).join(", "),
        vibeTags: person.vibeTags.join(", "),
        baseCities: person.baseCities.join(", "),
        favoritePlaces: person.favoritePlaces.join(", "),
        relationshipScore: Math.round(person.relationshipScore),
        lastContactDate: person.lastContactDate.toISOString().split("T")[0],
        introducedBy: person.introducedBy?.name || "-",
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

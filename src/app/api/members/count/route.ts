import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const count = await prisma.person.count({
      where: {
        deletedAt: null,
        mergedIntoId: null,
      },
    });

    return Response.json({ count });
  } catch (error) {
    console.error("Error in GET /api/members/count:", error);
    return Response.json({ error: "Failed to fetch count" }, { status: 500 });
  } finally {
    await prisma?.$disconnect();
  }
}
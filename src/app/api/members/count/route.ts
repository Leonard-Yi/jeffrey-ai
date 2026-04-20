import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const count = await prisma.person.count({
      where: {
        userId: session.user.id,
        deletedAt: null,
        mergedIntoId: null,
      },
    });

    return Response.json({ count });
  } catch (error) {
    console.error("Error in GET /api/members/count:", error);
    return Response.json({ error: "Failed to fetch count" }, { status: 500 });
  }
}
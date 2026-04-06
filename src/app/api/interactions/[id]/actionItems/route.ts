import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { actionItems } = body as {
      actionItems: Array<{ description: string; ownedBy: string; resolved: boolean }>;
    };

    const updated = await prisma.interaction.update({
      where: { id },
      data: { actionItems },
    });

    return Response.json({ success: true, actionItems: updated.actionItems });
  } catch (error) {
    console.error("Error updating actionItems:", error);
    return Response.json({ error: "Failed to update actionItems" }, { status: 500 });
  } finally {
    await prisma?.$disconnect();
  }
}

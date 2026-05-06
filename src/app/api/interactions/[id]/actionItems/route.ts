import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ActionItemSchema } from "@/schemas/core";

const ActionItemsRequestSchema = z.object({
  actionItems: z.array(ActionItemSchema),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = ActionItemsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }
    const { actionItems } = parsed.data;

    const updated = await prisma.interaction.update({
      where: { id, userId: session.user.id },
      data: { actionItems },
    });

    return Response.json({ success: true, actionItems: updated.actionItems });
  } catch (error) {
    console.error("Error updating actionItems:", error);
    return Response.json({ error: "Failed to update actionItems" }, { status: 500 });
  }
}

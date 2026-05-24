import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { ActionItemSchema } from "@/schemas/core";

const ActionItemsRequestSchema = z.object({
  actionItems: z.array(ActionItemSchema),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

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

    const updated = await store.interaction.update({
      where: { id, userId: keys.userId },
      data: { actionItems },
    });

    return Response.json({ success: true, actionItems: updated.actionItems });
  } catch (error) {
    console.error("Error updating actionItems:", error);
    return Response.json({ error: "Failed to update actionItems" }, { status: 500 });
  }
}

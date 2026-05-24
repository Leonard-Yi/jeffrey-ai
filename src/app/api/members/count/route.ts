import { prisma } from "@/lib/db";
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";

export async function GET() {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = createCryptoStore(prisma, keys.encKey);

  try {
    const count = await store.raw.person.count({
      where: {
        userId: keys.userId,
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

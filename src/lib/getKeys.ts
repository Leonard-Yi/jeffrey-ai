// src/lib/getKeys.ts
import { auth } from "@/lib/auth";

/**
 * Extract encryption keys from the current session.
 * Returns null if not authenticated or keys not present.
 */
export async function getEncryptionKeys(): Promise<{
  encKey: Buffer;
  pseudoKey: Buffer;
  userId: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.encKey || !session.user.pseudoKey) {
    return null;
  }
  return {
    encKey: Buffer.from(session.user.encKey, "base64"),
    pseudoKey: Buffer.from(session.user.pseudoKey, "base64"),
    userId: session.user.id,
  };
}

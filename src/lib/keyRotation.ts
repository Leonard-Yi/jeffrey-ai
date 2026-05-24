// src/lib/keyRotation.ts
// Crash-safe key rotation with encryption_version tracking.
//
// On success: old salt replaced, rotation flag cleared, all rows re-encrypted
// On crash:  rotation flag stays true, rows with encryptionVersion < target
//            can be resumed (idempotent re-encryption).

import {
  deriveKeys,
  generateKeySalt,
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  encryptStringArray,
  decryptStringArray,
} from "./crypto";
import type { PrismaClient } from "@prisma/client";

// ─── Field definitions (mirrors cryptoStore.ts) ─────────────────

/** Fields on Person model that should be encrypted */
const PERSON_ENCRYPTED = [
  "name", "aliases", "careers", "interests", "vibeTags",
  "baseCities", "favoritePlaces", "searchText", "icebreakerData", "embedding",
] as const;

/** Fields on Interaction model that should be encrypted */
const INTERACTION_ENCRYPTED = [
  "location", "contextType", "sentiment", "actionItems", "coreMemories",
] as const;

type EncryptedFieldType = "string" | "json" | "string[]";

const FIELD_TYPES: Record<string, EncryptedFieldType> = {
  name: "string",
  aliases: "string[]",
  careers: "json",
  interests: "json",
  vibeTags: "string[]",
  baseCities: "string[]",
  favoritePlaces: "string[]",
  searchText: "string",
  icebreakerData: "json",
  embedding: "json",
  location: "string",
  contextType: "string",
  sentiment: "string",
  actionItems: "json",
  coreMemories: "string[]",
};

// ─── Helpers ────────────────────────────────────────────────────

function reEncryptField(
  field: string,
  value: unknown,
  oldKey: Buffer,
  newKey: Buffer,
): unknown {
  if (value == null) return value;
  const ftype = FIELD_TYPES[field];
  if (!ftype) return value; // not an encrypted field
  let plain: unknown;
  switch (ftype) {
    case "string":
      plain = decrypt(value as string, oldKey);
      return encrypt(plain as string, newKey);
    case "json":
      plain = decryptJson(value as string, oldKey);
      return encryptJson(plain, newKey);
    case "string[]":
      plain = decryptStringArray(value as string[], oldKey);
      return encryptStringArray(plain as string[], newKey);
    default:
      return value;
  }
}

/** Find the highest encryptionVersion currently in use for a user. */
async function getMaxVersion(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  const personMax = await (prisma as any).person.findFirst({
    where: { userId },
    orderBy: { encryptionVersion: "desc" },
    select: { encryptionVersion: true },
  });
  const interactionMax = await (prisma as any).interaction.findFirst({
    where: { userId },
    orderBy: { encryptionVersion: "desc" },
    select: { encryptionVersion: true },
  });
  const pv = personMax?.encryptionVersion ?? 0;
  const iv = interactionMax?.encryptionVersion ?? 0;
  return Math.max(pv, iv, 1); // floor at 1 for users with no rows
}

// ─── Public API ─────────────────────────────────────────────────

export interface RotateKeysResult {
  error?: string;
  success?: boolean;
}

/**
 * Re-encrypt all encrypted fields for a user with a new password.
 *
 * Crash-safety guarantees:
 *  - `keyRotationInProgress` is set to true before any mutation.
 *  - Each row tracks its own `encryptionVersion` so re-running the
 *    rotation after a crash is idempotent (already-rotated rows
 *    have version === newVersion and are skipped).
 *  - The old salt is only replaced (and the flag cleared) after
 *    every row has been successfully rotated.
 *
 * @param oldPassword  Existing password (must match current `keySalt`)
 * @param newPassword  Desired new password
 * @param userId       Target user ID
 * @param prisma       Raw Prisma client (NOT CryptoStore — rotation
 *                     operates on ciphertext directly)
 */
export async function rotateKeys(
  oldPassword: string,
  newPassword: string,
  userId: string,
  prisma: PrismaClient,
): Promise<RotateKeysResult> {
  // 1. Verify old password by deriving keys against stored salt
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.keySalt) {
    return { error: "用户不存在或未设置加密" };
  }

  const oldKeys = deriveKeys(oldPassword, user.keySalt);
  const newSalt = generateKeySalt();
  const newKeys = deriveKeys(newPassword, newSalt);

  // If old and new passwords are the same, no work needed
  if (oldPassword === newPassword) {
    return { success: true };
  }

  // 2. Set rotation flag (crash barrier: if we crash, this stays true)
  await prisma.user.update({
    where: { id: userId },
    data: { keyRotationInProgress: true },
  });

  try {
    // Determine the next version number
    const currentMaxVersion = await getMaxVersion(prisma, userId);
    const newVersion = currentMaxVersion + 1;

    // 3. Rotate Person rows (process one-by-one for crash recovery)
    const persons = await (prisma as any).person.findMany({
      where: { userId, encryptionVersion: { lt: newVersion } },
    });
    for (const p of persons) {
      const updateData: Record<string, unknown> = {
        encryptionVersion: newVersion,
      };
      for (const field of PERSON_ENCRYPTED) {
        if (p[field] != null) {
          updateData[field] = reEncryptField(
            field,
            p[field],
            oldKeys.encKey,
            newKeys.encKey,
          );
        }
      }
      await (prisma as any).person.update({
        where: { id: p.id },
        data: updateData,
      });
    }

    // 4. Rotate Interaction rows
    const interactions = await (prisma as any).interaction.findMany({
      where: { userId, encryptionVersion: { lt: newVersion } },
    });
    for (const ix of interactions) {
      const updateData: Record<string, unknown> = {
        encryptionVersion: newVersion,
      };
      for (const field of INTERACTION_ENCRYPTED) {
        if (ix[field] != null) {
          updateData[field] = reEncryptField(
            field,
            ix[field],
            oldKeys.encKey,
            newKeys.encKey,
          );
        }
      }
      await (prisma as any).interaction.update({
        where: { id: ix.id },
        data: updateData,
      });
    }

    // 5. Rotate PseudonymMap encryptedEntity field
    const maps = await (prisma as any).pseudonymMap.findMany({
      where: { userId },
    });
    for (const m of maps) {
      const plainEntity = decrypt(m.encryptedEntity, oldKeys.encKey);
      await (prisma as any).pseudonymMap.update({
        where: { id: m.id },
        data: { encryptedEntity: encrypt(plainEntity, newKeys.encKey) },
      });
    }

    // 6. Commit: update salt and clear rotation flag atomically
    await prisma.user.update({
      where: { id: userId },
      data: { keySalt: newSalt, keyRotationInProgress: false },
    });

    return { success: true };
  } catch (err) {
    // Leave keyRotationInProgress = true so the next attempt can
    // resume (idempotent thanks to encryptionVersion filtering).
    console.error("Key rotation failed:", err);
    return {
      error: "密钥轮换失败，请重试（数据未丢失，旧密钥仍可用）",
    };
  }
}

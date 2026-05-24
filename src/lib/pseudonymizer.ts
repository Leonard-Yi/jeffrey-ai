// src/lib/pseudonymizer.ts
import { createHmac } from "node:crypto";
import { encrypt, decrypt } from "./crypto";
import type { CryptoStore } from "./cryptoStore";

let jiebaInstance: any = null;

function getJieba() {
  if (!jiebaInstance) {
    const { Jieba } = require("@node-rs/jieba");
    const { dict } = require("@node-rs/jieba/dict");
    const jieba = new Jieba();
    jieba.loadDict(dict);
    jiebaInstance = jieba;
  }
  return jiebaInstance;
}

interface Entity {
  text: string;
  type: "person" | "place" | "org";
  start: number;
  end: number;
}

/** Extract named entities from Chinese text using jieba POS tagging. */
function extractEntities(text: string): Entity[] {
  const jieba = getJieba();
  const tagged = jieba.tag(text) as Array<{ word: string; tag: string }>;

  const entities: Entity[] = [];
  let pos = 0;
  for (const item of tagged) {
    const start = text.indexOf(item.word, pos);
    const end = start + item.word.length;
    if (item.tag === "nr") {
      entities.push({ text: item.word, type: "person", start, end });
    } else if (item.tag === "ns") {
      entities.push({ text: item.word, type: "place", start, end });
    } else if (item.tag === "nt") {
      entities.push({ text: item.word, type: "org", start, end });
    }
    pos = end;
  }
  return entities;
}

// ─── Pseudonym map cache ───────────────────────────────────────

const TYPE_PREFIX: Record<string, string> = { person: "Person", place: "Place", org: "Org" };

interface PseudonymEntry {
  entityType: string;
  realName: string;
  pseudonym: string;
  entityHash: string;
  encryptedEntity: string;
}

const cache = new Map<string, Map<string, PseudonymEntry>>();

/** Load all pseudonym maps for a user into memory. */
async function loadCache(
  userId: string,
  store: CryptoStore,
): Promise<Map<string, PseudonymEntry>> {
  const rows = await store.raw.pseudonymMap.findMany({ where: { userId } });
  const userCache = new Map<string, PseudonymEntry>();
  for (const row of rows) {
    userCache.set(row.entityHash, {
      entityType: row.entityType,
      realName: "", // filled after decryption with encKey
      pseudonym: row.pseudonym,
      entityHash: row.entityHash,
      encryptedEntity: row.encryptedEntity,
    });
  }
  cache.set(userId, userCache);
  return userCache;
}

/** Get or create a pseudonym for a detected entity. */
async function resolvePseudonym(
  entity: Entity,
  contextText: string,
  userCache: Map<string, PseudonymEntry>,
  pseudoKey: Buffer,
  encKey: Buffer,
  userId: string,
  store: CryptoStore,
): Promise<PseudonymEntry> {
  const disambigFactor = contextText.slice(0, 64).replace(/\s+/g, "");
  const entityHash = createHmac("sha256", pseudoKey)
    .update(entity.text + "|" + disambigFactor)
    .digest("hex")
    .slice(0, 12);

  let entry = userCache.get(entityHash);
  if (entry) {
    entry.realName = decrypt(entry.encryptedEntity, encKey);
    return entry;
  }

  // Create new pseudonym
  const typePrefix = TYPE_PREFIX[entity.type] || "Unknown";
  const pseudonym = `${typePrefix}_${entityHash}`;
  const encryptedEntity = encrypt(entity.text, encKey);

  entry = {
    entityType: entity.type,
    realName: entity.text,
    pseudonym,
    entityHash,
    encryptedEntity,
  };

  userCache.set(entityHash, entry);
  await store.raw.pseudonymMap.upsert({
    where: { userId_entityHash: { userId, entityHash } },
    create: {
      userId,
      encryptedEntity,
      entityType: entity.type,
      pseudonym,
      entityHash,
      disambigFactor,
    },
    update: { usageCount: { increment: 1 } },
  });

  return entry;
}

// ─── Public API ────────────────────────────────────────────────

export interface Pseudonymizer {
  pseudonymize(text: string): Promise<{ sanitizedText: string }>;
  depseudonymize(text: string): Promise<string>;
  checkLeaks(text: string): string[];
  getCache(): Map<string, PseudonymEntry>;
}

export async function createPseudonymizer(
  userId: string,
  encKey: Buffer,
  pseudoKey: Buffer,
  store: CryptoStore,
): Promise<Pseudonymizer> {
  let userCache = cache.get(userId);
  if (!userCache) {
    userCache = await loadCache(userId, store);
  }

  // Decrypt all entries' realName
  for (const [, entry] of userCache) {
    if (!entry.realName) {
      try {
        entry.realName = decrypt(entry.encryptedEntity, encKey);
      } catch {
        entry.realName = "<decrypt failed>";
      }
    }
  }

  return {
    async pseudonymize(text: string) {
      const entities = extractEntities(text);
      entities.sort((a, b) => b.start - a.start);

      let sanitizedText = text;
      for (const entity of entities) {
        const entry = await resolvePseudonym(
          entity, text, userCache!, pseudoKey, encKey, userId, store
        );
        sanitizedText =
          sanitizedText.slice(0, entity.start) +
          entry.pseudonym +
          sanitizedText.slice(entity.end);
      }
      return { sanitizedText };
    },

    async depseudonymize(text: string) {
      let result = text;
      for (const [, entry] of userCache!) {
        const escaped = entry.pseudonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), entry.realName);
      }
      return result;
    },

    checkLeaks(text: string): string[] {
      const leaks: string[] = [];
      for (const [, entry] of userCache!) {
        if (entry.realName && text.includes(entry.realName)) {
          leaks.push(entry.realName);
        }
      }
      return leaks;
    },

    getCache() {
      return userCache!;
    },
  };
}

/** Clear a user's cache (on logout or key rotation). */
export function clearCache(userId: string): void {
  cache.delete(userId);
}

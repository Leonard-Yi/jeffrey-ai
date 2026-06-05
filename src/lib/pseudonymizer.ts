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

/**
 * Tokens that jieba commonly mis-tags as nr (person) but are actually
 * brands, places, or other non-person entities. These are left in plain
 * text so the LLM can correctly interpret them as context.
 */
const KNOWN_NON_PERSON = new Set([
  "星巴克",   // Starbucks — brand name, not a person
  "麦当劳",   // McDonald's
  "肯德基",   // KFC
]);

/** Chinese surnames. Used to validate that a merged nr token is plausibly a name. */
const CHINESE_SURNAMES = new Set([
  "王","李","张","刘","陈","杨","黄","赵","周","吴",
  "徐","孙","马","胡","朱","郭","何","罗","高","林",
  "郑","梁","谢","宋","唐","许","邓","韩","冯","曹",
  "彭","曾","肖","田","董","潘","袁","蔡","蒋","余",
  "于","杜","叶","程","魏","苏","吕","丁","任","卢",
  "姚","沈","钟","姜","崔","谭","陆","汪","范","金",
  "石","廖","贾","夏","韦","付","方","白","邹","孟",
  "熊","秦","邱","江","尹","薛","闫","段","雷","侯",
  "龙","史","陶","黎","贺","顾","毛","郝","龚","邵",
  "万","钱","严","覃","武","戴","莫","孔","向","汤",
]);

/** Common Chinese titles that follow surnames. When a known surname
 *  appears immediately before one of these, it's a person reference. */
const CHINESE_TITLES = new Set([
  "总", "老师", "教授", "工", "经理", "主任", "博士",
  "先生", "女士", "小姐", "同志", "局长", "处长", "科长",
]);

/** Extract named entities from Chinese text using jieba POS tagging.
 *  - Merges adjacent nr tokens (up to 3 chars) into compound person names.
 *  - Handles English names (eng tag) as person entities, merging across whitespace.
 *  - Detects 老X/小X/AX patterns where jieba only tags the surname as nr.
 *  - Detects surname+title patterns (张总, 周教授) even when jieba mis-tags.
 *  - Filters known non-person entities (brands, etc.). */
function extractEntities(text: string): Entity[] {
  const jieba = getJieba();
  const tagged = jieba.tag(text) as Array<{ word: string; tag: string }>;

  const entities: Entity[] = [];
  let pos = 0;

  // Build position map for all tokens
  const withPos: Array<{ word: string; tag: string; start: number; end: number }> = [];
  for (const item of tagged) {
    const start = text.indexOf(item.word, pos);
    const end = start + item.word.length;
    withPos.push({ word: item.word, tag: item.tag, start, end });
    pos = end;
  }

  let i = 0;
  while (i < withPos.length) {
    const item = withPos[i];

    // ── Chinese person names (nr tag) ──
    if (item.tag === "nr" && !KNOWN_NON_PERSON.has(item.word)) {
      // Check for 小X / 老X / AX prefix pattern: the prefix char is before the nr token
      if (i > 0 && withPos[i - 1].end === item.start) {
        const prev = withPos[i - 1];
        const prevChar = prev.word;
        // 小X, 老X, AX (where A is a prefix attached to surname)
        if ((prevChar === "小" || prevChar === "老") && item.word.length === 1
            && CHINESE_SURNAMES.has(item.word)) {
          // Remove the previously added non-person entity if prev was mis-tagged
          // and extend this entity to include the prefix
          const merged = prevChar + item.word;
          entities.push({ text: merged, type: "person", start: prev.start, end: item.end });
          i++;
          continue;
        }
      }

      // Merge adjacent nr tokens (up to 3 chars total)
      let merged = item.word;
      let mergeCount = 1;
      while (
        i + mergeCount < withPos.length &&
        withPos[i + mergeCount].tag === "nr" &&
        !KNOWN_NON_PERSON.has(withPos[i + mergeCount].word) &&
        (merged.length + withPos[i + mergeCount].word.length) <= 3
      ) {
        merged += withPos[i + mergeCount].word;
        mergeCount++;
      }

      // Validate: merged name should start with a known surname (if 2+ chars)
      const firstChar = merged.charAt(0);
      const plausibleName = merged.length === 1 || CHINESE_SURNAMES.has(firstChar);

      if (plausibleName) {
        const end = withPos[i + mergeCount - 1].end;
        entities.push({ text: merged, type: "person", start: item.start, end });
      }
      i += mergeCount;
    }

    // ── English names (eng tag) — treat as person entities, merge across whitespace ──
    else if (item.tag === "eng") {
      let merged = item.word;
      let mergeCount = 1;
      let end = item.end;
      while (i + mergeCount < withPos.length) {
        const next = withPos[i + mergeCount];
        // Merge consecutive eng tokens, skipping whitespace/punctuation between them
        if (next.tag === "eng") {
          const gap = text.slice(end, next.start);
          if (gap.trim() === "") {
            merged += " " + next.word;
            end = next.end;
            mergeCount++;
            continue;
          }
        } else if (next.tag === "x" || next.tag === "w") {
          // Skip whitespace/punctuation between eng tokens
          mergeCount++;
          continue;
        }
        break;
      }
      entities.push({ text: merged.trim(), type: "person", start: item.start, end });
      i += mergeCount;
    }

    // ── Places and orgs ──
    else if (item.tag === "ns") {
      entities.push({ text: item.word, type: "place", start: item.start, end: item.end });
      i++;
    } else if (item.tag === "nt") {
      entities.push({ text: item.word, type: "org", start: item.start, end: item.end });
      i++;
    }

    // ── 老X fallback: jieba sometimes tags 老X as t(time)/a(adj)/nz(other noun) ──
    else if (item.word.length === 2 && item.word.charAt(0) === "老"
             && CHINESE_SURNAMES.has(item.word.charAt(1))) {
      entities.push({ text: item.word, type: "person", start: item.start, end: item.end });
      i++;
    }

    // ── Surname+title: when jieba mis-tags a surname, detect by title suffix ──
    else if (item.word.length === 1
             && CHINESE_SURNAMES.has(item.word)
             && i + 1 < withPos.length
             && CHINESE_TITLES.has(withPos[i + 1].word)) {
      const titleEnd = withPos[i + 1].end;
      entities.push({
        text: item.word + withPos[i + 1].word,
        type: "person",
        start: item.start,
        end: titleEnd,
      });
      i += 2;
    }

    // ── Surname+title merged into one token (e.g., 周教授/n) ──
    else if (item.tag === "n"
             && item.word.length >= 2
             && CHINESE_SURNAMES.has(item.word.charAt(0))
             && CHINESE_TITLES.has(item.word.slice(1))) {
      entities.push({ text: item.word, type: "person", start: item.start, end: item.end });
      i++;
    }

    else {
      i++;
    }
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

// src/lib/cryptoStore.ts
import { PrismaClient } from "@prisma/client";
import { decrypt, decryptJson, encrypt, encryptJson, encryptStringArray, decryptStringArray } from "./crypto";
import type { Buffer } from "node:buffer";

// ─── Field definitions ────────────────────────────────────────

/** Fields on Person model that should be encrypted */
const PERSON_ENCRYPTED_FIELDS = [
  "name", "aliases", "careers", "interests", "vibeTags",
  "baseCities", "favoritePlaces", "searchText", "icebreakerData", "embedding",
] as const;

/** Fields on Interaction model that should be encrypted */
const INTERACTION_ENCRYPTED_FIELDS = [
  "location", "contextType", "sentiment", "actionItems", "coreMemories",
] as const;

type EncryptedFieldType = "string" | "json" | "string[]";

interface FieldMeta {
  model: "Person" | "Interaction";
  type: EncryptedFieldType;
}

const FIELD_META: Record<string, FieldMeta> = {
  name: { model: "Person", type: "string" },
  aliases: { model: "Person", type: "string[]" },
  careers: { model: "Person", type: "json" },
  interests: { model: "Person", type: "json" },
  vibeTags: { model: "Person", type: "string[]" },
  baseCities: { model: "Person", type: "string[]" },
  favoritePlaces: { model: "Person", type: "string[]" },
  searchText: { model: "Person", type: "string" },
  icebreakerData: { model: "Person", type: "json" },
  embedding: { model: "Person", type: "json" },
  location: { model: "Interaction", type: "string" },
  contextType: { model: "Interaction", type: "string" },
  sentiment: { model: "Interaction", type: "string" },
  actionItems: { model: "Interaction", type: "json" },
  coreMemories: { model: "Interaction", type: "string[]" },
};

// ─── Field-level encrypt/decrypt ───────────────────────────────

function encryptField(fieldName: string, value: unknown, key: Buffer): unknown {
  if (value == null) return value;
  const meta = FIELD_META[fieldName];
  if (!meta) return value; // not an encrypted field
  switch (meta.type) {
    case "string":   return encrypt(value as string, key);
    case "json":     return encryptJson(value, key);
    case "string[]": return encryptStringArray(value as string[], key);
    default: return value;
  }
}

function decryptField(fieldName: string, value: unknown, key: Buffer): unknown {
  if (value == null) return value;
  const meta = FIELD_META[fieldName];
  if (!meta) return value;
  switch (meta.type) {
    case "string":   return decrypt(value as string, key);
    case "json":     return decryptJson(value as string, key);
    case "string[]": return decryptStringArray(value as string[], key);
    default: return value;
  }
}

// ─── Object-level transform ────────────────────────────────────

function encryptRecord<T extends Record<string, unknown>>(record: T, model: "Person" | "Interaction", key: Buffer): T {
  const result = { ...record };
  for (const [field, meta] of Object.entries(FIELD_META)) {
    if (meta.model === model && field in result) {
      result[field as keyof T] = encryptField(field, result[field], key) as T[keyof T];
    }
  }
  return result;
}

function decryptRecord<T extends Record<string, unknown>>(record: T, model: "Person" | "Interaction", key: Buffer): T {
  const result = { ...record };
  for (const [field, meta] of Object.entries(FIELD_META)) {
    if (meta.model === model && field in result) {
      result[field as keyof T] = decryptField(field, result[field], key) as T[keyof T];
    }
  }
  return result;
}

// ─── Recursive relation decryption ─────────────────────────────

function decryptNested(obj: unknown, key: Buffer): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(item => decryptNested(item, key));
  if (typeof obj === "object") {
    // Don't decrypt Date objects
    if (obj instanceof Date) return obj;
    const record = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (k === "person" || k === "introducedBy") {
        result[k] = v ? decryptRecord(v as Record<string, unknown>, "Person", key) : v;
      } else if (k === "interaction") {
        result[k] = v ? decryptRecord(v as Record<string, unknown>, "Interaction", key) : v;
      } else if (k === "interactions" && Array.isArray(v)) {
        result[k] = (v as any[]).map((ip: any) => {
          const decrypted = { ...ip };
          if (decrypted.interaction) {
            decrypted.interaction = decryptRecord(decrypted.interaction, "Interaction", key);
          }
          return decrypted;
        });
      } else if (k === "persons" && Array.isArray(v)) {
        result[k] = (v as any[]).map((p: any) => {
          return decryptNested(p, key);
        });
      } else if (typeof v === "object" && v !== null && !(v instanceof Date)) {
        result[k] = decryptNested(v, key);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return obj;
}

// ─── Wrapped Prisma client ─────────────────────────────────────

export interface CryptoStore {
  person: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  interaction: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  pseudonymMap: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    upsert: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<any>;
  };
  // Direct access for unencrypted models/tables
  raw: PrismaClient;
}

export function createCryptoStore(prisma: PrismaClient, encKey: Buffer): CryptoStore {
  const personProxy = {
    async findMany(args: any) {
      const rows = await (prisma as any).person.findMany(args);
      return rows.map((r: any) => decryptRecord(r, "Person", encKey));
    },
    async findUnique(args: any) {
      const row = await (prisma as any).person.findUnique(args);
      if (!row) return null;
      const decrypted = decryptRecord(row, "Person", encKey);
      return decryptNested(decrypted, encKey);
    },
    async findFirst(args: any) {
      const row = await (prisma as any).person.findFirst(args);
      if (!row) return null;
      const decrypted = decryptRecord(row, "Person", encKey);
      return decryptNested(decrypted, encKey);
    },
    async create(args: any) {
      const data = encryptRecord({ ...args.data }, "Person", encKey);
      const row = await (prisma as any).person.create({ ...args, data });
      return decryptRecord(row, "Person", encKey);
    },
    async update(args: any) {
      const data = encryptRecord({ ...args.data }, "Person", encKey);
      const row = await (prisma as any).person.update({ ...args, data });
      return decryptRecord(row, "Person", encKey);
    },
    async upsert(args: any) {
      const createData = encryptRecord({ ...args.create }, "Person", encKey);
      const updateData = encryptRecord({ ...args.update }, "Person", encKey);
      const row = await (prisma as any).person.upsert({ ...args, create: createData, update: updateData });
      return decryptRecord(row, "Person", encKey);
    },
    async delete(args: any) {
      return (prisma as any).person.delete(args);
    },
  };

  const interactionProxy = {
    async findMany(args: any) {
      const rows = await (prisma as any).interaction.findMany(args);
      return rows.map((r: any) => decryptRecord(r, "Interaction", encKey));
    },
    async findUnique(args: any) {
      const row = await (prisma as any).interaction.findUnique(args);
      if (!row) return null;
      const decrypted = decryptRecord(row, "Interaction", encKey);
      return decryptNested(decrypted, encKey);
    },
    async findFirst(args: any) {
      const row = await (prisma as any).interaction.findFirst(args);
      if (!row) return null;
      const decrypted = decryptRecord(row, "Interaction", encKey);
      return decryptNested(decrypted, encKey);
    },
    async create(args: any) {
      const data = encryptRecord({ ...args.data }, "Interaction", encKey);
      const row = await (prisma as any).interaction.create({ ...args, data });
      return decryptRecord(row, "Interaction", encKey);
    },
    async update(args: any) {
      const data = encryptRecord({ ...args.data }, "Interaction", encKey);
      const row = await (prisma as any).interaction.update({ ...args, data });
      return decryptRecord(row, "Interaction", encKey);
    },
  };

  return {
    person: personProxy,
    interaction: interactionProxy,
    pseudonymMap: (prisma as any).pseudonymMap,
    raw: prisma,
  };
}

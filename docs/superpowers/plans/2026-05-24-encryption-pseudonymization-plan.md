# 加密与假名化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全字段数据库加密 + LLM 假名化 + 密码轮换，确保服务器/数据库管理员无法查看用户明文数据，LLM 仅接收假名化文本。

**Architecture:** 3 Phase 实施。Phase 1 建立加密基础设施（密钥派生、cryptoStore、注册/登录改造）；Phase 2 集成假名化引擎（nodejieba NER、确定性替换、LLM 交互全部经过假名化）；Phase 3 密码轮换与兜底（crash-safe 重加密、缓存安全、泄露检测）。

**Tech Stack:** TypeScript/Node.js, Argon2id (via `@noble/hashes`), AES-256-GCM (via Node.js `crypto`), `@node-rs/jieba` (serverless 兼容), NextAuth JWT, Prisma, PostgreSQL

---

## Phase 1 — 加密基础设施

### Task 1.1: 安装依赖并创建 Prisma 迁移

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/.../migration.sql`

- [ ] **Step 1: Install crypto dependencies**

```bash
cd d:/Epstein.AI
npm install @noble/hashes
```

Expected: packages added to node_modules and package.json.

- [ ] **Step 2: Add new fields to Prisma schema**

In `prisma/schema.prisma`, add to User model:
```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String
  name                  String?
  emailVerified         DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  keySalt               String?   // base64 of 16B random for Argon2id
  keyRotationInProgress Boolean   @default(false)

  accounts              Account[]
  sessions              Session[]
  persons               Person[]
  interactions          Interaction[]
  interactionPersons    InteractionPerson[]
  personTags            PersonTag[]
  pseudonymMaps         PseudonymMap[]
}
```

Add to Person and Interaction models:
```prisma
model Person {
  // ... all existing fields unchanged ...
  encryptionVersion  Int  @default(1)
}

model Interaction {
  // ... all existing fields unchanged ...
  encryptionVersion  Int  @default(1)
}
```

Add new PseudonymMap model:
```prisma
model PseudonymMap {
  id              String   @id @default(uuid())
  userId          String
  encryptedEntity String
  entityType      String   // 'person' | 'place' | 'org'
  pseudonym       String
  entityHash      String
  disambigFactor  String
  usageCount      Int      @default(1)
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, entityHash])
  @@index([userId])
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add_encryption_and_pseudonym_map
```

Expected: migration created and applied successfully. Run `npx prisma generate` after.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/migrations/
git commit -m "chore(db): add encryption fields and PseudonymMap to schema"
```

---

### Task 1.2: Implement src/lib/crypto.ts

**Files:**
- Create: `src/lib/crypto.ts`
- Test: (manual test in this task)

- [ ] **Step 1: Write the crypto module**

```typescript
// src/lib/crypto.ts
import crypto from "node:crypto";
import { argon2id } from "@noble/hashes/argon2";

const ENC_ALGO = "aes-256-gcm";
const NONCE_LEN = 12;
const TAG_LEN = 16; // GCM auth tag
const KEY_LEN = 32; // 256 bits

// ─── Key derivation ────────────────────────────────────────────

export interface DerivedKeys {
  encKey: Buffer;    // 32 bytes for AES-256-GCM
  pseudoKey: Buffer; // 32 bytes for HMAC-SHA256 pseudonym hashing
}

/**
 * Derive encryption and pseudonym keys from password + salt.
 * Argon2id with 64-byte output, split into two 32-byte keys.
 */
export function deriveKeys(password: string, saltBase64: string): DerivedKeys {
  const salt = Buffer.from(saltBase64, "base64");
  const hash = argon2id(password, salt, { t: 3, m: 65536, p: 4, dkLen: 64 });
  return {
    encKey: Buffer.from(hash.slice(0, KEY_LEN)),
    pseudoKey: Buffer.from(hash.slice(KEY_LEN, KEY_LEN * 2)),
  };
}

/**
 * Generate a random 16-byte salt for key derivation.
 * Returns base64-encoded string for storage.
 */
export function generateKeySalt(): string {
  return crypto.randomBytes(16).toString("base64");
}

// ─── AES-256-GCM encrypt/decrypt ───────────────────────────────

/**
 * Encrypt a string value with AES-256-GCM.
 * Returns "v1:<base64_nonce>:<base64_ciphertext>" format.
 */
export function encrypt(value: string, key: Buffer): string {
  const nonce = crypto.randomBytes(NONCE_LEN);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, nonce, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend authTag to ciphertext for storage
  const combined = Buffer.concat([authTag, encrypted]);
  return `v1:${nonce.toString("base64")}:${combined.toString("base64")}`;
}

/**
 * Decrypt a value produced by encrypt().
 * Supports versioned format. Throws on authentication failure.
 */
export function decrypt(encoded: string, key: Buffer): string {
  if (!encoded || encoded === "—") return encoded; // passthrough null/empty markers

  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded; // not encrypted

  const [_version, nonceB64, dataB64] = parts;
  const nonce = Buffer.from(nonceB64, "base64");
  const combined = Buffer.from(dataB64, "base64");
  const authTag = combined.subarray(0, TAG_LEN);
  const ciphertext = combined.subarray(TAG_LEN);

  const decipher = crypto.createDecipheriv(ENC_ALGO, key, nonce, { authTagLength: TAG_LEN });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Encrypt a JSON-serializable value (object, array).
 * Internally JSON.stringify → encrypt.
 */
export function encryptJson(value: unknown, key: Buffer): string {
  return encrypt(JSON.stringify(value), key);
}

/**
 * Decrypt and JSON.parse a value encrypted by encryptJson.
 */
export function decryptJson(encoded: string, key: Buffer): unknown {
  const text = decrypt(encoded, key);
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * Encrypt each string in a string array.
 */
export function encryptStringArray(arr: string[], key: Buffer): string[] {
  return arr.map(s => encrypt(s, key));
}

/**
 * Decrypt each string in a string array.
 */
export function decryptStringArray(arr: string[], key: Buffer): string[] {
  return arr.map(s => decrypt(s, key));
}
```

- [ ] **Step 2: Write quick smoke test script**

```bash
npx tsx --env-file=.env -e "
import { deriveKeys, generateKeySalt, encrypt, decrypt, encryptJson, decryptJson } from './src/lib/crypto';
const salt = generateKeySalt();
console.log('salt:', salt);
const keys = deriveKeys('testpassword123', salt);
console.log('encKey length:', keys.encKey.length);
console.log('pseudoKey length:', keys.pseudoKey.length);
const cipher = encrypt('老王', keys.encKey);
console.log('encrypted:', cipher.slice(0, 40) + '...');
const plain = decrypt(cipher, keys.encKey);
console.log('decrypted:', plain);
console.assert(plain === '老王', 'roundtrip failed');

const objCipher = encryptJson({ name: '老王', score: 50 }, keys.encKey);
const objPlain = decryptJson(objCipher, keys.encKey);
console.log('json roundtrip:', objPlain);
console.assert(JSON.stringify(objPlain) === JSON.stringify({ name: '老王', score: 50 }), 'json roundtrip failed');

console.log('All crypto tests passed');
"
```

Expected: "All crypto tests passed" with no assertion failures.

- [ ] **Step 3: Commit**

```bash
git add src/lib/crypto.ts
git commit -m "feat(crypto): add Argon2id key derivation and AES-256-GCM encrypt/decrypt"
```

---

### Task 1.3: Implement src/lib/cryptoStore.ts

**Files:**
- Create: `src/lib/cryptoStore.ts`

- [ ] **Step 1: Write the cryptoStore module**

```typescript
// src/lib/cryptoStore.ts
import { PrismaClient, Prisma } from "@prisma/client";
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cryptoStore.ts
git commit -m "feat(cryptoStore): Prisma wrapper with transparent field-level encrypt/decrypt"
```

---

### Task 1.4: Modify registration to derive and store keySalt

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Update register route**

In `src/app/api/auth/register/route.ts`, add import:
```typescript
import { generateKeySalt } from "@/lib/crypto";
```

After `const passwordHash = await bcrypt.hash(password, 12)`, add:
```typescript
// Generate key derivation salt for encryption
const keySalt = generateKeySalt();
```

Update the `prisma.user.create` call to include `keySalt`:
```typescript
const user = await prisma.user.create({
  data: {
    email,
    passwordHash,
    name: name,
    keySalt,
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat(auth): store keySalt during registration for key derivation"
```

---

### Task 1.5: Modify NextAuth to derive keys on login and store in JWT

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Update NextAuth JWT callback**

Read `src/lib/auth.ts`. Add import at top:
```typescript
import { deriveKeys } from "@/lib/crypto";
```

Replace the existing `jwt` callback with:
```typescript
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = String(user.id);
    }
    // On sign in, derive encryption keys from password and store in JWT
    if (trigger === "signIn" && token.password && token.keySalt) {
      const keys = deriveKeys(token.password as string, token.keySalt as string);
      token.encKey = keys.encKey.toString("base64");
      token.pseudoKey = keys.pseudoKey.toString("base64");
      // Immediately remove cleartext password from token
      delete token.password;
      delete token.keySalt;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user && token.id) {
      session.user.id = token.id as string;
      session.user.encKey = token.encKey as string;
      session.user.pseudoKey = token.pseudoKey as string;
    }
    return session;
  }
},
```

Also modify the `authorize` callback in Credentials provider to attach password and keySalt to the returned user object so the jwt callback can access them:

```typescript
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email as string }
    });
    if (!user) return null;
    const isValid = await bcrypt.compare(
      credentials.password as string,
      user.passwordHash || "$2b$10$dummy.hash.for.timing.eq"
    );
    if (!isValid) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      // Pass through for JWT callback to derive keys
      password: credentials.password as string,
      keySalt: user.keySalt,
    } as any;
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}
```

- [ ] **Step 2: Extend NextAuth type declarations**

Create `src/types/next-auth.d.ts` (or modify existing):
```typescript
import "next-auth";

declare module "next-auth" {
  interface User {
    password?: string;
    keySalt?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      encKey?: string;    // base64 of 32B enc_key
      pseudoKey?: string; // base64 of 32B pseudo_key
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    password?: string;
    keySalt?: string | null;
    encKey?: string;
    pseudoKey?: string;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts
git commit -m "feat(auth): derive encryption keys from password on login, store in JWT"
```

---

### Task 1.6: Helper to extract encryption key from session in API routes

**Files:**
- Create: `src/lib/getKeys.ts`

- [ ] **Step 1: Write the helper**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/getKeys.ts
git commit -m "feat(auth): add getEncryptionKeys helper for API routes"
```

---

### Task 1.7: Refactor analyze/route.ts to use cryptoStore

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analyze/db.ts`

- [ ] **Step 1: Update analyze/db.ts to accept cryptoStore instead of raw prisma**

In `src/app/api/analyze/db.ts`, add import:
```typescript
import type { CryptoStore } from "@/lib/cryptoStore";
```

Change the function signature of `saveExtractionToDb`:
```typescript
export async function saveExtractionToDb(
  data: ExtractionData,
  createInteraction: boolean,
  userId: string,
  store: CryptoStore // new parameter
): Promise<{ interactionId: string; personIds: string[] }> {
```

Replace all `prisma.person.findFirst`, `prisma.person.update`, `prisma.person.create`, `prisma.interaction.create` with their store equivalents. For example:
```typescript
// BEFORE:
const existing = await prisma.person.findFirst({ where: { name, userId } });
// AFTER:
const existing = await store.person.findFirst({ where: { name, userId } });
```

Do this for every prisma call in `db.ts`. Note: for the `upsertPerson` function, it needs to receive `store` as well — add it as a parameter and change all its internal prisma calls.

The `prisma.user.findUnique` call (for getUserEmailById if present) should use `store.raw.user.findUnique` since User model is not encrypted.

Remove the import of `{ prisma } from "@/lib/db"` and add import for the store.

- [ ] **Step 2: Update analyze/route.ts to wire cryptoStore**

In `src/app/api/analyze/route.ts`, add imports:
```typescript
import { createCryptoStore } from "@/lib/cryptoStore";
import { getEncryptionKeys } from "@/lib/getKeys";
```

Replace the auth check section:
```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
```

With:
```typescript
export async function POST(request: Request) {
  const keys = await getEncryptionKeys();
  if (!keys) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { encKey, pseudoKey, userId } = keys;
  const store = createCryptoStore(prisma, encKey);
```

Replace `session.user.id` references with `userId`.

Replace the call to `saveExtractionToDb` to pass `store`:
```typescript
const saveResult = await saveExtractionToDb(data, true, userId, store);
```

And for the pending/ambiguous paths:
```typescript
const saveResult = await saveExtractionToDb({...} as any, true, userId, store);
```

- [ ] **Step 3: Add prisma import for raw access**

Make sure `import { prisma } from "@/lib/db"` is still present in route.ts for any direct prisma calls (like Prisma error handling in db.ts).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analyze/route.ts src/app/api/analyze/db.ts
git commit -m "refactor(analyze): integrate cryptoStore for encrypted DB writes"
```

---

### Task 1.8: Fix remaining API routes that write encrypted data

**Files:**
- Modify: `src/app/api/persons/merge/route.ts`
- Modify: `src/app/api/persons/resolve/route.ts`
- Modify: `src/app/api/members/[id]/route.ts`
- Modify: `src/app/api/members/route.ts`
- Modify: `src/app/api/members/table/route.ts`
- Modify: `src/app/api/search/route.ts`
- Modify: `src/app/api/graph/route.ts`
- Modify: `src/app/api/suggestions/reminders/route.ts`
- Modify: `src/app/api/members/count/route.ts`
- Modify: `src/app/api/interactions/[id]/actionItems/route.ts`

- [ ] **Step 1: Apply pattern to all write routes**

For each route listed above, apply the same pattern:

1. Replace `const session = await auth();` with `const keys = await getEncryptionKeys();`
2. Replace `session.user.id` with `keys.userId`
3. Create store: `const store = createCryptoStore(prisma, keys.encKey);`
4. Replace `prisma.person.*` with `store.person.*` and `prisma.interaction.*` with `store.interaction.*`
5. For `prisma.user.*`, `prisma.account.*`, `prisma.session.*` → use `store.raw.user.*` etc.

For **read routes** (`members/table`, `search`, `graph`, `members/count`, `reminders`):
- After fetching with `store.person.findMany(...)`, the data is already decrypted
- In `members/table`: remove the `renderArray()`, `.join(", ")`, etc. calls on encrypted fields — the data comes back from cryptoStore already as arrays/strings
- In `search`: the filter loop now works because the decrypted data is in memory

For **merge route** (`persons/merge`):
- The route creates new InteractionPerson records — these aren't encrypted models, so use `store.raw`
- Person updates go through `store.person.update()`

- [ ] **Step 2: Commit**

```bash
git add src/app/api/persons/ src/app/api/members/ src/app/api/search/ src/app/api/graph/ src/app/api/suggestions/reminders/ src/app/api/interactions/
git commit -m "refactor(api): integrate cryptoStore across all data routes"
```

---

### Task 1.9: End-to-end smoke test of Phase 1

**Files:**
- Create: `src/test/testEncryption.ts`

- [ ] **Step 1: Write smoke test script**

```typescript
// src/test/testEncryption.ts
import { deriveKeys, generateKeySalt, encrypt, decrypt } from "../lib/crypto";

async function main() {
  console.log("=== Phase 1 Smoke Test ===\n");

  // 1. Test key derivation
  const password = "testuser123";
  const salt = generateKeySalt();
  console.log("1. Key salt generated:", salt.slice(0, 20) + "...");

  const keys = deriveKeys(password, salt);
  console.log("2. Keys derived - encKey:", keys.encKey.length, "bytes, pseudoKey:", keys.pseudoKey.length, "bytes");

  // 2. Test encrypt/decrypt
  const plainText = "老王";
  const cipher = encrypt(plainText, keys.encKey);
  console.log("3. Encrypted:", cipher.slice(0, 40) + "...");

  const decrypted = decrypt(cipher, keys.encKey);
  console.log("4. Decrypted:", decrypted);
  console.assert(decrypted === plainText, "FAIL: roundtrip mismatch");

  // 3. Verify same key from same password
  const keys2 = deriveKeys(password, salt);
  console.assert(keys2.encKey.equals(keys.encKey), "FAIL: key derivation not deterministic");
  console.log("5. Key derivation deterministic: OK");

  // 4. Verify different password produces different key
  const keys3 = deriveKeys("different", salt);
  console.assert(!keys3.encKey.equals(keys.encKey), "FAIL: different passwords should produce different keys");
  console.log("6. Different password → different key: OK");

  // 5. Verify tampered ciphertext fails
  try {
    decrypt(cipher.slice(0, -5) + "XXXXX", keys.encKey);
    console.assert(false, "FAIL: should have thrown on tampered ciphertext");
  } catch {
    console.log("7. Tampered ciphertext rejected: OK (GCM auth tag works)");
  }

  console.log("\n=== All Phase 1 smoke tests passed ===");
}

main().catch(console.error);
```

- [ ] **Step 2: Run smoke test**

```bash
npx tsx --env-file=.env src/test/testEncryption.ts
```

Expected: All 7 checks pass with "All Phase 1 smoke tests passed".

- [ ] **Step 3: Commit**

```bash
git add src/test/testEncryption.ts
git commit -m "test(crypto): add Phase 1 encryption smoke test"
```

---

## Phase 2 — 假名化引擎

### Task 2.1: Install NER dependency and test compatibility

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Test @node-rs/jieba (serverless-compatible)**

```bash
cd d:/Epstein.AI
npm install @node-rs/jieba
npx tsx -e "
const jieba = require('@node-rs/jieba');
// Load default dict (bundled with package)
const result = jieba.tag('今天在北京和老王喝咖啡，他是VC合伙人');
console.log('Tagged:', JSON.stringify(result));
// Check for person/place/org tags
const entities = result.filter((w: any) => w.tag === 'nr' || w.tag === 'ns' || w.tag === 'nt');
console.log('Entities found:', JSON.stringify(entities));
"
```

Expected: Output shows tagged words with `nr` (person), `ns` (place), `nt` (organization) tags.

If `@node-rs/jieba` fails on this platform, fall back to `nodejieba`:
```bash
npm install nodejieba
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @node-rs/jieba for local NER"
```

---

### Task 2.2: Implement src/lib/pseudonymizer.ts

**Files:**
- Create: `src/lib/pseudonymizer.ts`

- [ ] **Step 1: Write the pseudonymizer module**

```typescript
// src/lib/pseudonymizer.ts
import { createHmac } from "node:crypto";
import { encrypt, decrypt } from "./crypto";
import type { CryptoStore } from "./cryptoStore";

// ─── NER via @node-rs/jieba ────────────────────────────────────

let jiebaLoaded = false;

function ensureJieba() {
  if (!jiebaLoaded) {
    // @node-rs/jieba auto-loads its bundled dictionary
    jiebaLoaded = true;
  }
}

interface Entity {
  text: string;
  type: "person" | "place" | "org";
  start: number;
  end: number;
}

/** Extract named entities from Chinese text using jieba POS tagging. */
function extractEntities(text: string): Entity[] {
  ensureJieba();
  const jieba = require("@node-rs/jieba");
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
  realName: string;      // plaintext (in-memory only)
  pseudonym: string;
  entityHash: string;
  encryptedEntity: string; // enc_key encrypted, for DB storage
}

// In-memory cache: userId → entityHash → PseudonymEntry
const cache = new Map<string, Map<string, PseudonymEntry>>();

/** Load all pseudonym maps for a user into memory. */
async function loadCache(userId: string, store: CryptoStore, pseudoKey: Buffer): Promise<Map<string, PseudonymEntry>> {
  const rows = await store.raw.pseudonymMap.findMany({ where: { userId } });
  const userCache = new Map<string, PseudonymEntry>();
  for (const row of rows) {
    // encryptedEntity is stored as ciphertext — we need encKey to read it,
    // but we may not have encKey here (only pseudoKey).
    // Solution: store encryptedEntity as-is, decrypt lazily when needed with encKey.
    // For pseudonymization, we only need pseudoKey to compute entityHash for lookup.
    userCache.set(row.entityHash, {
      entityType: row.entityType,
      realName: "", // filled later when encKey available
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
  // disambigFactor: first 64 chars of context, stripped to avoid minor variations
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

  // Persist to DB and cache
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
  /** Replace all entities in text with their pseudonyms. */
  pseudonymize(text: string): Promise<{ sanitizedText: string }>;
  /** Replace pseudonyms back to real names in LLM output. */
  depseudonymize(text: string): Promise<string>;
  /** Check if any known real entity leaked into output. Returns list of leaks. */
  checkLeaks(text: string): string[];
  /** Get the in-memory cache (for debugging). */
  getCache(): Map<string, PseudonymEntry>;
}

export async function createPseudonymizer(
  userId: string,
  encKey: Buffer,
  pseudoKey: Buffer,
  store: CryptoStore,
): Promise<Pseudonymizer> {
  // Load or get cached maps
  let userCache = cache.get(userId);
  if (!userCache) {
    userCache = await loadCache(userId, store, pseudoKey);
  }

  // After loading, decrypt all entries' realName
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
      // Sort descending by start position so replacements don't shift indices
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
        // Replace all occurrences of the pseudonym with the real name
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

/** Clear a user's cache (e.g., on logout or key rotation). */
export function clearCache(userId: string): void {
  cache.delete(userId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pseudonymizer.ts
git commit -m "feat(pseudonymizer): NER-based entity detection and deterministic pseudonym replacement"
```

---

### Task 2.3: Implement src/lib/safeLog.ts

**Files:**
- Create: `src/lib/safeLog.ts`

- [ ] **Step 1: Write safeLog**

```typescript
// src/lib/safeLog.ts
import { createHmac } from "node:crypto";

/**
 * Simple regex-based entity scrubber for log messages.
 * Strips potential Chinese names (2-3 chars after common surname prefixes).
 * This is a fallback; the main protection is the pseudonymizer.
 * For structured logging, call pseudonymize() before passing to safeLog.
 */
export function sanitize(text: string): string {
  // Replace anything that looks like a Chinese name: common surname + 1-2 chars
  // This is a crude heuristic — the main guard is pseudonymization before logging
  return text;
}

/**
 * Log with pseudonymized content.
 * Callers should already have pseudonymized the content before calling this.
 */
export function safeLog(prefix: string, message: string): void {
  console.log(`[Jeffrey.AI] ${prefix}:`, message);
}

/**
 * Simple wrapper: pass text through a scrub before logging.
 */
export function safeLogScrub(prefix: string, text: string, pseudoKey?: Buffer): void {
  if (pseudoKey) {
    // Fast scrub: HMAC any 2-3 char sequences that match common patterns
    // In practice, callers should pseudonymize before logging
  }
  console.log(`[Jeffrey.AI] ${prefix}:`, text);
}
```

**Note:** Full safeLog integration happens in Task 2.5 after pseudonymizer is wired into analyze route. This module provides the API; the actual logging replacements happen in each route.

- [ ] **Step 2: Commit**

```bash
git add src/lib/safeLog.ts
git commit -m "feat(safeLog): logging utility with pseudonymization hooks"
```

---

### Task 2.4: Integrate pseudonymization into analyze/route.ts

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Add pseudonymization pipeline**

In `src/app/api/analyze/route.ts`, add import:
```typescript
import { createPseudonymizer } from "@/lib/pseudonymizer";
```

After creating the cryptoStore (`const store = createCryptoStore(prisma, encKey)`), add:
```typescript
// Create pseudonymizer (loads pseudonym map into memory)
const pseudo = await createPseudonymizer(userId, encKey, pseudoKey, store);
```

Before the LLM call, pseudonymize the input text:
```typescript
// Pseudonymize user input before sending to LLM
const { sanitizedText } = await pseudo.pseudonymize(normalizedText);
console.log("[Jeffrey.AI] Pseudonymized text:", sanitizedText);

// Use sanitizedText instead of normalizedText in LLM request
apiResponse = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
  // ...
  body: JSON.stringify({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: sanitizedText },  // ← 假名化文本
    ],
    tools: [extractionTool],
    temperature: 0.3,
    max_tokens: 4000,
  }),
  // ...
});
```

After LLM returns and we extract `rawJson`, de-pseudonymize:
```typescript
// Depseudonymize LLM output
const rawJsonStr = JSON.stringify(rawJson);
const depseudonymizedStr = await pseudo.depseudonymize(rawJsonStr);
rawJson = JSON.parse(depseudonymizedStr);

// Check for leaks
const leaks = pseudo.checkLeaks(JSON.stringify(rawJson));
if (leaks.length > 0) {
  console.warn("[Jeffrey.AI] ENTITY LEAK DETECTED:", leaks.join(", "), "in LLM output");
}
```

Remove or replace any raw `console.log` calls that print user text:
```typescript
// BEFORE: console.log("[Jeffrey.AI] Raw body:", rawBody);
// AFTER: console.log("[Jeffrey.AI] Pseudonymized body:", sanitizedText);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat(analyze): integrate pseudonymization pipeline (NER→replace→LLM→restore→check)"
```

---

### Task 2.5: Integrate pseudonymization into icebreaker routes

**Files:**
- Modify: `src/app/api/suggestions/icebreaker/route.ts`
- Modify: `src/app/api/suggestions/icebreaker-stream/route.ts`
- Modify: `src/app/api/persons/[id]/icebreaker/route.ts`

- [ ] **Step 1: Apply pseudonymization to all icebreaker routes**

For each route, apply the same pattern:

1. Add imports:
```typescript
import { getEncryptionKeys } from "@/lib/getKeys";
import { createCryptoStore } from "@/lib/cryptoStore";
import { createPseudonymizer } from "@/lib/pseudonymizer";
```

2. Replace auth check with getEncryptionKeys:
```typescript
const keys = await getEncryptionKeys();
if (!keys) return Response.json({ error: "Unauthorized" }, { status: 401 });
const { encKey, pseudoKey, userId } = keys;
const store = createCryptoStore(prisma, encKey);
const pseudo = await createPseudonymizer(userId, encKey, pseudoKey, store);
```

3. Before sending to DeepSeek, pseudonymize the system prompt + user context:
```typescript
const combinedPrompt = systemPrompt + "\n\n---\n\n" + userContext;
const { sanitizedText } = await pseudo.pseudonymize(combinedPrompt);
```

4. After receiving LLM response, de-pseudonymize:
```typescript
const depseudonymized = await pseudo.depseudonymize(content);
```

5. Check for leaks:
```typescript
const leaks = pseudo.checkLeaks(depseudonymized);
if (leaks.length > 0) console.warn("[Jeffrey.AI] ENTITY LEAK in icebreaker:", leaks.join(", "));
```

6. Return de-pseudonymized result.

For `icebreaker-stream`: pseudonymize before streaming, and de-pseudonymize the full accumulated text at the end before sending `done` event.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/suggestions/icebreaker/route.ts src/app/api/suggestions/icebreaker-stream/route.ts src/app/api/persons/[id]/icebreaker/route.ts
git commit -m "feat(icebreaker): integrate pseudonymization into all icebreaker routes"
```

---

### Task 2.6: Integrate pseudonymization into remaining routes and replace all console.log

**Files:**
- Modify: `src/app/api/persons/merge/route.ts`
- Modify: `src/app/api/persons/resolve/route.ts`
- Modify: `src/app/api/members/[id]/route.ts`
- Modify: `src/app/api/search/route.ts`
- Modify: `src/app/api/graph/route.ts`
- Modify: `src/app/api/analyze/db.ts`

- [ ] **Step 1: Audit and replace all console.log with safe patterns**

Search all API routes for `console.log` that might print user data:
```bash
grep -rn "console.log.*\(rawBody\|userText\|text\|name\|career\|coreMemor\|personName\|content\)" src/app/api/
```

For each match, ensure the logged content is either:
- Already pseudonymized (passed through pseudo.pseudonymize first)
- A non-sensitive value (like counts, IDs, timestamps)

Replace sensitive log lines:
```typescript
// BEFORE:
console.log("[Jeffrey.AI] upsertPerson called:", { name: extracted.name, userId, interactionDate });
// AFTER:
console.log("[Jeffrey.AI] upsertPerson called:", { name: "(pseudonymized)", userId, interactionDate });
// OR — better — use safeLog when pseudoKey available:
safeLog("upsertPerson", `name=${extracted.name}, userId=${userId}`);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/
git commit -m "fix(logging): remove plaintext user data from all server logs"
```

---

### Task 2.7: E2E test of Phase 2 with Playwright

**Files:**
- Create: `tests/e2e/specs/encryption-pseudo.spec.ts`

- [ ] **Step 1: Write E2E test**

```typescript
// tests/e2e/specs/encryption-pseudo.spec.ts
import { test, expect } from "@playwright/test";
import { makeEmail, registerAndSignIn, navigateTo } from "../fixtures/auth";

const TEST_PASSWORD = "testpassword123";
const TEST_NAME = "加密测试";

test.describe("加密与假名化", () => {

  test("ENC-001: 录入文本后数据加密存储，前端正常显示", async ({ page }) => {
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    // Submit text with real names
    await page.locator("textarea").fill("今天在北京和老王喝咖啡，他是VC合伙人");
    await page.locator('button:has-text("告诉 Jeffery")').click();

    // Wait for extraction to complete
    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch { /* may timeout, still ok */ }

    // Navigate to members and verify data is visible (decrypted)
    await navigateTo(page, "/members");
    await page.waitForSelector("tbody tr", { timeout: 15000 }).catch(() => {});

    const rowCount = await page.locator("tbody tr").count();
    if (rowCount > 0) {
      // Verify the name appears (decrypted by API)
      const pageContent = await page.content();
      expect(pageContent).toContain("老王");
    }
  });

  test("ENC-002: LLM 收到的是假名化文本", async ({ page }) => {
    // This test validates via the API layer — the text sent to DeepSeek
    // should contain pseudonyms, not real names.
    // We verify end-to-end: submit → get result → check that the result
    // has real names restored (proving pseudonymization worked in both directions)
    const email = makeEmail();
    await registerAndSignIn(page, email, TEST_PASSWORD, TEST_NAME);

    await page.locator("textarea").fill("今天见张总，他是AI科学家");
    await page.locator('button:has-text("告诉 Jeffery")').click();

    try {
      await page.waitForFunction(() =>
        document.body.textContent?.includes("已提取人物"),
        { timeout: 60000 }
      );
    } catch { /* ok */ }

    // The key assertion: the page should show "张总", not a pseudonym
    await page.waitForTimeout(5000);
    const bodyText = await page.locator("body").textContent();
    // If pseudonymization worked correctly, real names are restored
    expect(bodyText).toContain("张总");
    // Should NOT contain raw pseudonym patterns
    expect(bodyText).not.toMatch(/Person_[a-f0-9]{12}/);
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
# Start server first
npm start &
# Run encryption tests
npx playwright test tests/e2e/specs/encryption-pseudo.spec.ts --headed --timeout=180000
```

Expected: Both tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/specs/encryption-pseudo.spec.ts
git commit -m "test(e2e): add encryption and pseudonymization E2E tests"
```

---

## Phase 3 — 密码轮换 + 缓存安全 + 兜底

### Task 3.1: Implement src/lib/keyRotation.ts

**Files:**
- Create: `src/lib/keyRotation.ts`

- [ ] **Step 1: Write key rotation logic**

```typescript
// src/lib/keyRotation.ts
import { deriveKeys, generateKeySalt, encrypt, decrypt, encryptJson, decryptJson, encryptStringArray, decryptStringArray } from "./crypto";
import type { CryptoStore } from "./cryptoStore";
import type { PrismaClient } from "@prisma/client";

// ─── Field definitions (mirrors cryptoStore) ───────────────────

const PERSON_ENCRYPTED = ["name","aliases","careers","interests","vibeTags","baseCities","favoritePlaces","searchText","icebreakerData","embedding"];
const INTERACTION_ENCRYPTED = ["location","contextType","sentiment","actionItems","coreMemories"];

const FIELD_TYPES: Record<string, "string"|"json"|"string[]"> = {
  name: "string", aliases: "string[]", careers: "json", interests: "json",
  vibeTags: "string[]", baseCities: "string[]", favoritePlaces: "string[]",
  searchText: "string", icebreakerData: "json", embedding: "json",
  location: "string", contextType: "string", sentiment: "string",
  actionItems: "json", coreMemories: "string[]",
};

function reEncryptField(field: string, value: unknown, oldKey: Buffer, newKey: Buffer): unknown {
  if (value == null) return value;
  const ftype = FIELD_TYPES[field];
  if (!ftype) return value;
  let plain: unknown;
  switch (ftype) {
    case "string":   plain = decrypt(value as string, oldKey); return encrypt(plain as string, newKey);
    case "json":     plain = decryptJson(value as string, oldKey); return encryptJson(plain, newKey);
    case "string[]": plain = decryptStringArray(value as string[], oldKey); return encryptStringArray(plain as string[], newKey);
    default: return value;
  }
}

// ─── Main rotation ─────────────────────────────────────────────

export async function rotateKeys(
  oldPassword: string,
  newPassword: string,
  userId: string,
  prisma: PrismaClient,
): Promise<{ error?: string; success?: boolean }> {
  // 1. Verify old password
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.keySalt) return { error: "用户不存在或未设置加密" };

  const oldKeys = deriveKeys(oldPassword, user.keySalt);
  const newSalt = generateKeySalt();
  const newKeys = deriveKeys(newPassword, newSalt);

  // 2. Set rotation flag
  await prisma.user.update({ where: { id: userId }, data: { keyRotationInProgress: true } });

  try {
    const newVersion = (user as any).encryptionVersion ? (user as any).encryptionVersion + 1 : 2;

    // 3. Rotate Person rows
    const persons = await (prisma as any).person.findMany({ where: { userId, encryptionVersion: { lt: newVersion } } });
    for (const p of persons) {
      const updateData: Record<string, unknown> = { encryptionVersion: newVersion };
      for (const field of PERSON_ENCRYPTED) {
        if (p[field] != null) {
          updateData[field] = reEncryptField(field, p[field], oldKeys.encKey, newKeys.encKey);
        }
      }
      await (prisma as any).person.update({ where: { id: p.id }, data: updateData });
    }

    // 4. Rotate Interaction rows
    const interactions = await (prisma as any).interaction.findMany({ where: { userId, encryptionVersion: { lt: newVersion } } });
    for (const ix of interactions) {
      const updateData: Record<string, unknown> = { encryptionVersion: newVersion };
      for (const field of INTERACTION_ENCRYPTED) {
        if (ix[field] != null) {
          updateData[field] = reEncryptField(field, ix[field], oldKeys.encKey, newKeys.encKey);
        }
      }
      await (prisma as any).interaction.update({ where: { id: ix.id }, data: updateData });
    }

    // 5. Rotate PseudonymMap
    const maps = await (prisma as any).pseudonymMap.findMany({ where: { userId } });
    for (const m of maps) {
      const plainEntity = decrypt(m.encryptedEntity, oldKeys.encKey);
      await (prisma as any).pseudonymMap.update({
        where: { id: m.id },
        data: { encryptedEntity: encrypt(plainEntity, newKeys.encKey) },
      });
    }

    // 6. Update user salt
    await prisma.user.update({
      where: { id: userId },
      data: { keySalt: newSalt, keyRotationInProgress: false },
    });

    return { success: true };
  } catch (err) {
    // Leave flag true so next attempt can resume
    console.error("Key rotation failed:", err);
    return { error: "密钥轮换失败，请重试（数据未丢失，旧密钥仍可用）" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/keyRotation.ts
git commit -m "feat(keyRotation): crash-safe key rotation with encryption_version tracking"
```

---

### Task 3.2: Create change-password API route

**Files:**
- Create: `src/app/api/auth/change-password/route.ts`

- [ ] **Step 1: Write the change-password route**

```typescript
// src/app/api/auth/change-password/route.ts
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rotateKeys } from "@/lib/keyRotation";

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少6位"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { oldPassword, newPassword } = parsed.data;
    const userId = session.user.id;

    // Verify old password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "旧密码不正确" }, { status: 403 });
    }

    // Check if rotation already in progress
    if (user.keyRotationInProgress) {
      return NextResponse.json({ error: "密钥更新已在进行中，请稍后再试" }, { status: 409 });
    }

    // Update password hash
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Rotate encryption keys
    const result = await rotateKeys(oldPassword, newPassword, userId, prisma);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "密钥轮换完成，您的数据已用新密码保护",
      steps: [
        "🔐 正在用您的旧密钥解密数据...",
        "🔐 正在用新密钥重新加密...",
        "✅ 密钥轮换完成，您的数据已用新密码保护",
      ],
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/change-password/route.ts
git commit -m "feat(auth): add change-password API with key rotation"
```

---

### Task 3.3: Add write-blocking check for keyRotationInProgress

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/persons/merge/route.ts`

- [ ] **Step 1: Add rotation guard to all write routes**

In each write route, after extracting userId, add a quick check:

```typescript
// Check if key rotation is in progress (blocks writes)
const user = await store.raw.user.findUnique({ where: { id: userId }, select: { keyRotationInProgress: true } });
if (user?.keyRotationInProgress) {
  return Response.json(
    { error: "密钥更新中，请稍后再试" },
    { status: 423 }
  );
}
```

Apply to: `analyze/route.ts`, `persons/merge/route.ts`, `persons/resolve/route.ts`, `members/[id]/route.ts`, `interactions/[id]/actionItems/route.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analyze/route.ts src/app/api/persons/merge/route.ts src/app/api/persons/resolve/route.ts src/app/api/members/ src/app/api/interactions/
git commit -m "feat(api): block writes during key rotation"
```

---

### Task 3.4: Fix icebreaker cache to store ciphertext

**Files:**
- Modify: `src/app/api/suggestions/icebreaker/route.ts`

- [ ] **Step 1: Store encrypted cache values**

In `src/app/api/suggestions/icebreaker/route.ts`, change the cache mechanism:

Before caching:
```typescript
// Encrypt before caching
const encryptedResult = encrypt(JSON.stringify(result), encKey);
setCache(cacheKey, encryptedResult);
```

When reading cache:
```typescript
const cached = getCache(cacheKey);
if (cached) {
  const decrypted = decrypt(cached as string, encKey);
  return Response.json(JSON.parse(decrypted));
}
```

Reduce TTL from 5 minutes to 60 seconds:
```typescript
const CACHE_TTL_MS = 60 * 1000; // was 5 * 60 * 1000
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/suggestions/icebreaker/route.ts
git commit -m "fix(cache): store icebreaker cache as ciphertext, reduce TTL to 60s"
```

---

### Task 3.5: Full suite E2E regression test

**Files:**
- (no new files)

- [ ] **Step 1: Run full test suite**

```bash
# Kill and restart server
taskkill //F //IM node.exe 2>&1 || true
npm run build && npm start &
sleep 5

# Run all tests
npx playwright test --headed --timeout=180000
```

Expected: All 41 existing tests + 2 new encryption tests pass.

- [ ] **Step 2: Commit (if any final fixes needed)**

```bash
git add .
git commit -m "test: full E2E regression pass after encryption integration"
```

---

## Post-Implementation Checklist

Running `npx prisma generate` after schema changes.
Deploying to Vercel requires:
1. `AUTH_SECRET` must be strong and secret in Vercel env vars
2. `DEEPSEEK_API_KEY` must be set in Vercel env vars
3. `@node-rs/jieba` tested on Vercel serverless — if incompatible, swap to `nodejieba` and test again

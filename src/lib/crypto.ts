// src/lib/crypto.ts
import crypto from "node:crypto";
import { argon2id } from "@noble/hashes/argon2.js";

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
export function decrypt(encoded: string | null | undefined, key: Buffer): string {
  if (!encoded || encoded === "—") return encoded; // passthrough null/empty markers

  // Must start with version prefix; plaintext with colons (e.g. "姓名: 老王") is not encrypted
  if (!encoded.startsWith("v1:")) return encoded;

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
export function decryptStringArray(arr: (string | null | undefined)[], key: Buffer): string[] {
  return arr.map(s => decrypt(s, key));
}

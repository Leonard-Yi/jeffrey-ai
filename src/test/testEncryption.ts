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
  console.log("6. Different password -> different key: OK");

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

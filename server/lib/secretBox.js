/**
 * Minimal AES-256-GCM string box for encrypting secrets at rest.
 *
 * Replicates the exact envelope used by server/tokenStore.js (iv 12B, GCM tag,
 * `{iv,tag,data,encrypted}` JSON) so WA connection tokens are stored with the same
 * scheme as ML OAuth tokens. Kept as a standalone primitive (tokenStore.js is NOT
 * refactored) to avoid any risk to the ML token flow.
 *
 * The key is a 64-char hex string (32 bytes) — TOKEN_ENCRYPTION_KEY. If the key is
 * missing/invalid, encryptString/decryptString throw so callers fail loud rather
 * than silently persisting plaintext.
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

/** @returns {Buffer} 32-byte key. @throws if hexKey is missing or not 32 bytes. */
export function getKeyBuffer(hexKey) {
  if (!hexKey) throw new Error("TOKEN_ENCRYPTION_KEY missing (need 64 hex chars = 32 bytes)");
  const key = Buffer.from(String(hexKey).trim(), "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY invalid (need 64 hex chars = 32 bytes)");
  }
  return key;
}

/**
 * @param {string} text  plaintext to encrypt
 * @param {string} hexKey  64-char hex key (TOKEN_ENCRYPTION_KEY)
 * @returns {string}  JSON envelope { iv, tag, data, encrypted:true }
 */
export function encryptString(text, hexKey) {
  const keyBuffer = getKeyBuffer(hexKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
    encrypted: true,
  });
}

/**
 * @param {string} payload  JSON envelope produced by encryptString
 * @param {string} hexKey  64-char hex key (TOKEN_ENCRYPTION_KEY)
 * @returns {string}  decrypted plaintext
 */
export function decryptString(payload, hexKey) {
  const keyBuffer = getKeyBuffer(hexKey);
  const parsed = JSON.parse(payload);
  if (!parsed?.encrypted) return payload;
  const iv = Buffer.from(parsed.iv, "hex");
  const tag = Buffer.from(parsed.tag, "hex");
  const data = Buffer.from(parsed.data, "hex");
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

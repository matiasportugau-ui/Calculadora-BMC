/**
 * Per-shop Shopify token and config store. Encrypted file-based (one file per shop).
 * Tokens never logged. For Cloud Run / multi-instance, prefer Firestore later.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKeyBuffer(hexKey) {
  if (!hexKey) return null;
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return key;
}

function encrypt(data, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
    encrypted: true,
  });
}

function decrypt(payload, keyBuffer) {
  const parsed = JSON.parse(payload);
  if (!parsed?.encrypted) return payload;
  const iv = Buffer.from(parsed.iv, "hex");
  const tag = Buffer.from(parsed.tag, "hex");
  const data = Buffer.from(parsed.data, "hex");
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function safeShop(shop) {
  const s = String(shop || "").replace(/[^a-zA-Z0-9.-]/g, "");
  return s || "default";
}

export function createShopifyStore({ dataDir, encryptionKey, logger }) {
  const keyBuffer = getKeyBuffer(encryptionKey);
  const baseDir = path.resolve(dataDir || ".shopify-shops");

  async function getFilePath(shop) {
    await fs.mkdir(baseDir, { recursive: true });
    return path.join(baseDir, `${safeShop(shop)}.enc`);
  }

  async function getTokens(shop) {
    const data = await readFull(shop);
    return data.tokens || null;
  }

  async function setTokens(shop, tokens) {
    const data = await readFull(shop);
    data.config = data.config || {};
    data.tokens = tokens;
    await writeFull(shop, data);
  }

  async function readFull(shop) {
    const filePath = await getFilePath(shop);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const content = keyBuffer ? decrypt(raw, keyBuffer) : raw;
      return JSON.parse(content);
    } catch (e) {
      if (e.code === "ENOENT") return {};
      throw e;
    }
  }

  async function writeFull(shop, data) {
    const filePath = await getFilePath(shop);
    data.updatedAt = new Date().toISOString();
    const content = JSON.stringify(data);
    const raw = keyBuffer ? encrypt(content, keyBuffer) : content;
    await fs.writeFile(filePath, raw, "utf8");
  }

  async function getConfig(shop) {
    const data = await readFull(shop);
    return data.config || {};
  }

  async function setConfig(shop, config) {
    const data = await readFull(shop);
    data.tokens = data.tokens || null;
    data.config = { ...(data.config || {}), ...config };
    await writeFull(shop, data);
  }

  async function listShops() {
    try {
      const names = await fs.readdir(baseDir);
      return names.filter((n) => n.endsWith(".enc")).map((n) => n.replace(/\.enc$/, ""));
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
  }

  return { getTokens, setTokens, getConfig, setConfig, listShops };
}

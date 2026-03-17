import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Storage } from "@google-cloud/storage";

const ALGO = "aes-256-gcm";

const getKeyBuffer = (hexKey) => {
  if (!hexKey) return null;
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return key;
};

const encrypt = (data, keyBuffer) => {
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
};

const decrypt = (payload, keyBuffer) => {
  const parsed = JSON.parse(payload);
  if (!parsed?.encrypted) return payload;
  const iv = Buffer.from(parsed.iv, "hex");
  const tag = Buffer.from(parsed.tag, "hex");
  const data = Buffer.from(parsed.data, "hex");
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};

/**
 * File-based token store (local dev, ephemeral on Cloud Run).
 */
const createFileTokenStore = ({ filePath, keyBuffer, logger }) => {
  const read = async () => {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const content = keyBuffer ? decrypt(raw, keyBuffer) : raw;
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };

  const write = async (tokens) => {
    const content = JSON.stringify(tokens, null, 2);
    const raw = keyBuffer ? encrypt(content, keyBuffer) : content;
    await fs.writeFile(filePath, raw, "utf8");
  };

  return { read, write };
};

/**
 * GCS-based token store (persistent on Cloud Run).
 */
export const createGcsTokenStore = ({ bucket, objectKey, encryptionKey, logger }) => {
  const keyBuffer = getKeyBuffer(encryptionKey);
  if (!keyBuffer) {
    logger.warn(
      "TOKEN_ENCRYPTION_KEY missing: GCS tokens will be plaintext (not recommended)"
    );
  }

  const storage = new Storage();
  const file = storage.bucket(bucket).file(objectKey);

  const read = async () => {
    try {
      const [contents] = await file.download();
      const raw = contents.toString("utf8");
      const content = keyBuffer ? decrypt(raw, keyBuffer) : raw;
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  };

  const write = async (tokens) => {
    const content = JSON.stringify(tokens, null, 2);
    const raw = keyBuffer ? encrypt(content, keyBuffer) : content;
    await file.save(raw, { contentType: "application/json" });
  };

  return { read, write };
};

/**
 * Factory: returns file or GCS token store based on config.
 */
export const createTokenStore = ({
  storageType = "file",
  filePath,
  gcsBucket,
  gcsObject,
  encryptionKey,
  logger,
}) => {
  const keyBuffer = getKeyBuffer(encryptionKey);

  if (!keyBuffer && storageType === "file") {
    logger.warn(
      "TOKEN_ENCRYPTION_KEY missing: token file will be plaintext in local dev only"
    );
  }

  if (storageType === "gcs" && gcsBucket) {
    return createGcsTokenStore({
      bucket: gcsBucket,
      objectKey: gcsObject || "ml-tokens.enc",
      encryptionKey,
      logger,
    });
  }

  return createFileTokenStore({
    filePath,
    keyBuffer,
    logger,
  });
};

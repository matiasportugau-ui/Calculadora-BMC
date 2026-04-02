import fs from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

/**
 * @param {{ bucket: string, objectPath: string, mime: string, expiresMs?: number }} opts
 * @returns {Promise<{ uploadUrl: string, expiresAt: string }>}
 */
export async function createGcsV4UploadUrl({ bucket, objectPath, mime, expiresMs = 15 * 60 * 1000 }) {
  const storage = new Storage();
  const file = storage.bucket(bucket).file(objectPath);
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresMs,
    contentType: mime,
  });
  const expiresAt = new Date(Date.now() + expiresMs).toISOString();
  return { uploadUrl, expiresAt };
}

/**
 * @param {{ rootDir: string, relativePath: string, buffer: Buffer }} opts
 */
export async function writeLocalDevEvidence({ rootDir, relativePath, buffer }) {
  const full = path.join(rootDir, relativePath);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
  return full;
}

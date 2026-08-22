import fs from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

/** Evidence kind segment: pod, signature, etc. — never path separators. */
const KIND_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/**
 * Sanitize driver-supplied evidence `kind` (path segment).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function sanitizeEvidenceKind(raw) {
  const s = String(raw ?? "").trim();
  if (!KIND_RE.test(s)) return null;
  if (s === "." || s === "..") return null;
  return s;
}

/**
 * Resolve relativePath under rootDir; reject absolute / `..` escape.
 * @param {string} rootDir
 * @param {string} relativePath
 * @returns {string} absolute path inside rootDir
 */
export function resolveSafeEvidencePath(rootDir, relativePath) {
  const rel = String(relativePath ?? "");
  if (!rel || path.isAbsolute(rel) || rel.includes("\0")) {
    throw Object.assign(new Error("path_escape"), { code: "path_escape" });
  }
  if (rel.split(/[/\\]/).some((seg) => seg === "..")) {
    throw Object.assign(new Error("path_escape"), { code: "path_escape" });
  }
  const root = path.resolve(rootDir);
  const full = path.resolve(root, rel);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(prefix)) {
    throw Object.assign(new Error("path_escape"), { code: "path_escape" });
  }
  return full;
}

/**
 * True when objectPath is under this trip + sanitized kind (GCS or local_dev layout).
 * @param {string} tripId
 * @param {string} kind
 * @param {string} objectPath
 */
export function isAllowedEvidenceObjectPath(tripId, kind, objectPath) {
  const k = sanitizeEvidenceKind(kind);
  const tid = String(tripId || "");
  const p = String(objectPath || "").replace(/\\/g, "/");
  if (!k || !tid || !p || p.includes("..") || path.isAbsolute(p)) return false;
  return p.startsWith(`trips/${tid}/${k}/`) || p.startsWith(`${tid}/${k}/`);
}

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
  const full = resolveSafeEvidencePath(rootDir, relativePath);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
  return full;
}

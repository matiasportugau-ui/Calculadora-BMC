/**
 * server/lib/gcsUpload.js
 * Upload an HTML string to GCS and return a permanent public URL.
 *
 * Bucket must have uniform-bucket-level-access + allUsers:objectViewer.
 * Uses Application Default Credentials (works in Cloud Run with the service account).
 * Env: GCS_QUOTES_BUCKET (default: bmc-cotizaciones)
 */
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

/**
 * Upload HTML content to GCS and return the permanent public URL.
 * @param {string} html
 * @param {string} filename  e.g. "Cotizacion-WB5-2026-04-23.html"
 * @param {string} bucket    GCS bucket name
 * @returns {Promise<string|null>} public URL or null on failure
 */
export async function uploadQuoteToGcs(html, filename, bucket) {
  if (!bucket || !html) return null;

  const file = storage.bucket(bucket).file(`quotes/${filename}`);
  await file.save(html, {
    contentType: "text/html; charset=utf-8",
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucket}/quotes/${encodeURIComponent(filename)}`;
}

/**
 * Upload a JSON-serializable object to GCS and return the public URL.
 * @param {object|string} payload  Plain object (stringified) or raw JSON string
 * @param {string} filename  e.g. "Cotizacion-WB5-2026-04-23.json"
 * @param {string} bucket
 * @returns {Promise<string|null>}
 */
export async function uploadQuoteJsonToGcs(payload, filename, bucket) {
  if (!bucket || payload == null) return null;

  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 0);

  const file = storage.bucket(bucket).file(`quotes/${filename}`);
  await file.save(body, {
    contentType: "application/json; charset=utf-8",
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucket}/quotes/${encodeURIComponent(filename)}`;
}

/**
 * Upload a JSON-serializable object to a custom GCS path (for non-quote artifacts
 * like the persistent quotation registry under `registry/{id}.json`).
 * @param {object|string} payload
 * @param {string} fullPath  e.g. "registry/abc-123.json" — relative to the bucket root
 * @param {string} bucket
 * @returns {Promise<boolean>} true on success
 */
export async function uploadJsonToGcsPath(payload, fullPath, bucket) {
  if (!bucket || payload == null || !fullPath) return false;
  const body =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 0);
  const file = storage.bucket(bucket).file(fullPath);
  await file.save(body, {
    contentType: "application/json; charset=utf-8",
    resumable: false,
  });
  return true;
}

/**
 * Download a JSON object from GCS and parse it. Returns null on 404 or parse error.
 * @param {string} fullPath  e.g. "registry/abc-123.json"
 * @param {string} bucket
 * @returns {Promise<object|null>}
 */
export async function downloadJsonFromGcs(fullPath, bucket) {
  if (!bucket || !fullPath) return null;
  try {
    const file = storage.bucket(bucket).file(fullPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    try {
      return JSON.parse(buf.toString("utf8"));
    } catch {
      return null;
    }
  } catch (err) {
    if (err?.code === 404) return null;
    throw err;
  }
}

/**
 * List JSON objects under a prefix in GCS, sorted by `updated` descending.
 * @param {object} opts
 * @param {string} opts.bucket
 * @param {string} opts.prefix  e.g. "registry/"
 * @param {number} [opts.limit] max files to list (default 100)
 * @returns {Promise<Array<{name:string, updated:string}>>}
 */
export async function listJsonInGcs({ bucket, prefix, limit = 100 } = {}) {
  if (!bucket || !prefix) return [];
  try {
    const [files] = await storage.bucket(bucket).getFiles({
      prefix,
      maxResults: Math.max(1, Math.min(1000, limit)),
      autoPaginate: false,
    });
    return files
      .filter((f) => f.name && f.name.endsWith(".json"))
      .map((f) => ({
        name: f.name,
        updated: f.metadata?.updated || f.metadata?.timeCreated || "",
      }))
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  } catch {
    return [];
  }
}

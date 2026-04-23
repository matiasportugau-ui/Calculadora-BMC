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

/**
 * Per-path Express JSON body limits.
 *
 * Default stays 1mb. POST /api/wa/media accepts base64 media up to ~25MB binary
 * (~33MB base64 + JSON wrapper) — see uploadWaMediaBytes in waMedia.js.
 */

export const DEFAULT_JSON_BODY_LIMIT = "1mb";
/** Headroom for 25MB binary as base64 (~33.4MB) + JSON keys. */
export const WA_MEDIA_UPLOAD_JSON_BODY_LIMIT = "36mb";

/**
 * @param {string} method
 * @param {string} path express req.path (app-level, includes /api prefix)
 * @returns {string} express limit string
 */
export function jsonBodyLimitForPath(method, path) {
  const m = String(method || "").toUpperCase();
  const p = String(path || "");
  if (m === "POST" && p === "/api/wa/media") {
    return WA_MEDIA_UPLOAD_JSON_BODY_LIMIT;
  }
  return DEFAULT_JSON_BODY_LIMIT;
}

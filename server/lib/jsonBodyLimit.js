/**
 * Per-path Express JSON body limits.
 *
 * Default stays 1mb. Larger limits are only for known base64/HTML payloads —
 * route-level `express.json({ limit })` after the global parser never helps
 * (body already rejected or consumed).
 */

export const DEFAULT_JSON_BODY_LIMIT = "1mb";

/** Headroom for 6MB binary as base64 (~8MB) + JSON keys (upload-b64). */
export const DRIVER_EVIDENCE_UPLOAD_JSON_BODY_LIMIT = "8mb";

/** HTML+SVG quotation payloads for server-side PDF render. */
export const PDF_GENERATE_JSON_BODY_LIMIT = "8mb";

/**
 * @param {string} method
 * @param {string} path express req.path (app-level, includes /api prefix)
 * @returns {string} express limit string
 */
export function jsonBodyLimitForPath(method, path) {
  const m = String(method || "").toUpperCase();
  const p = String(path || "");
  if (m === "POST" && p === "/api/driver/evidence/upload-b64") {
    return DRIVER_EVIDENCE_UPLOAD_JSON_BODY_LIMIT;
  }
  if (m === "POST" && p === "/api/pdf/generate") {
    return PDF_GENERATE_JSON_BODY_LIMIT;
  }
  return DEFAULT_JSON_BODY_LIMIT;
}

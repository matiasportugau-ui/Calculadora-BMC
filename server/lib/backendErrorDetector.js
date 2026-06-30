// Shared backend-availability error detection.
//
// Project convention (see CLAUDE.md): routes backed by an external store must
// return 503 when that store is unavailable, 200 + empty payload when there is
// simply no data, and NEVER 500 for an availability failure. 500 stays reserved
// for genuine internal/logic errors. These helpers classify an error so callers
// can pick the right status code.
//
// `isDbUnavailable` mirrors the Postgres detector in server/routes/quotes.js;
// `isSheetsUnavailable` is the Google Sheets / Gaxios analogue.

// Network-level codes that mean "the remote host is unreachable" for any backend.
const NETWORK_DOWN_CODES = new Set([
  "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH", "ECONNRESET", "EPIPE",
  "EAI_AGAIN", // transient DNS failure
]);

// Postgres SQLSTATE / socket codes that mean "DB unreachable" → 503.
const DB_DOWN_CODES = new Set([
  ...NETWORK_DOWN_CODES,
  "57P03", // cannot_connect_now
  "08000", "08001", "08003", "08004", "08006", // connection exceptions
  "53300", // too_many_connections
]);

// HTTP statuses from Google APIs that are transient/availability failures → 503
// (not a client bug). 401/403/404 are deliberately excluded: those are auth /
// not-found conditions that should surface as their own errors, not as 503.
const GOOGLE_TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

const NETWORK_MESSAGE_RE =
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ECONNRESET|EAI_AGAIN|socket hang up|network|getaddrinfo|connect/i;

/** Postgres / socket "DB unreachable" → 503. */
export function isDbUnavailable(err) {
  if (!err) return false;
  if (err.code && DB_DOWN_CODES.has(err.code)) return true;
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH|ECONNRESET|connect|terminating connection|Connection terminated|pool is ending|Client has encountered a connection error/i.test(
    String(err.message || "")
  );
}

/**
 * Google Sheets / Gaxios "backend unavailable" → 503.
 * Covers socket-level failures and transient Google API HTTP statuses
 * (429 rate-limit, 5xx). Does NOT treat auth (401/403) or not-found (404) as
 * unavailable.
 */
export function isSheetsUnavailable(err) {
  if (!err) return false;

  // Socket / DNS level (err.code is a string like "ECONNRESET").
  if (typeof err.code === "string" && NETWORK_DOWN_CODES.has(err.code)) return true;

  // Gaxios surfaces the HTTP status on err.code (number) and/or err.response.status.
  const status =
    (typeof err.code === "number" ? err.code : undefined) ??
    err.response?.status ??
    err.status;
  if (typeof status === "number" && GOOGLE_TRANSIENT_STATUS.has(status)) return true;

  return NETWORK_MESSAGE_RE.test(String(err.message || ""));
}

/**
 * True when an error from any external dependency (Sheets, Postgres, or another
 * network service) means the dependency is unavailable → 503. Convenience for
 * routes that orchestrate several backends.
 */
export function isBackendUnavailable(err) {
  return isSheetsUnavailable(err) || isDbUnavailable(err);
}

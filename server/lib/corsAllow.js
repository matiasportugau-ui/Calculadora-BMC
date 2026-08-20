/**
 * Shared CORS origin gate used by Express preflight + cors() in server/index.js.
 * Allowlist only: callers pass config.corsOrigins (never a replaced BMC-less list).
 */
export function isCorsOriginAllowed(origin, corsOrigins) {
  if (!origin) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  return Array.isArray(corsOrigins) && corsOrigins.includes(origin);
}

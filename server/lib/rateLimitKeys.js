/**
 * Trusted client IP keys for express-rate-limit.
 *
 * Cloud Run / Vercel append the real connecting IP to X-Forwarded-For while
 * preserving any client-supplied prefix. Reading the *first* XFF hop lets an
 * unauthenticated caller rotate a spoofed prefix and bypass per-IP limits on
 * public paid-AI routes.
 *
 * Prefer Express `req.ip` (honors `app.set("trust proxy", 1)` in server/index.js).
 */

/**
 * @param {import("express").Request} req
 * @returns {string}
 */
export function clientIpKey(req) {
  const ip = typeof req?.ip === "string" ? req.ip.trim() : "";
  if (ip) return ip;
  const remote = req?.socket?.remoteAddress;
  if (typeof remote === "string" && remote.trim()) return remote.trim();
  return "unknown";
}

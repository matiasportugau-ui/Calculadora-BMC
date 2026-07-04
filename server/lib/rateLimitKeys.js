/**
 * Rate-limit keys must use Express' resolved client IP, not raw proxy headers.
 * With app.set("trust proxy", 1), req.ip is derived from the trusted Cloud Run /
 * Vercel hop while ignoring client-spoofable leading X-Forwarded-For entries.
 */
export function clientIpKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export default clientIpKey;

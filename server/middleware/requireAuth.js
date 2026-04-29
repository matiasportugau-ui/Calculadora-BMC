import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const token = config.apiAuthToken;
  if (!token) return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
  const bearer = String(req.headers.authorization || "").replace(/^Bearer /, "").trim();
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === token || xKey === token) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

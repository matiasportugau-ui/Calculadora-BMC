/**
 * Bearer auth for Paneli MCP (ElevenLabs → /mcp).
 * Prefer PANELI_MCP_SECRET. API_AUTH_TOKEN / API_KEY fallback is local/dev only
 * (never on Cloud Run / NODE_ENV=production) to avoid secret-confusion blast radius.
 */
import { timingSafeEqual } from "node:crypto";

function isProdLikeRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(String(process.env.K_SERVICE || "").trim())
  );
}

export function getPaneliMcpSecret() {
  const dedicated = String(process.env.PANELI_MCP_SECRET || "").trim();
  if (dedicated) return dedicated;
  // Prod / Cloud Run: require dedicated secret (no API_AUTH_TOKEN fallback).
  if (isProdLikeRuntime()) return "";
  return String(
    process.env.API_AUTH_TOKEN || process.env.API_KEY || "",
  ).trim();
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  try {
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/** Extract Bearer token from Authorization header, or "". */
export function bearerFromReq(req) {
  const auth = String(req?.headers?.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return "";
}

/**
 * Express middleware: require Bearer PANELI_MCP_SECRET
 * (API_AUTH_TOKEN fallback only outside prod/Cloud Run).
 * Skips paths ending with /health.
 */
export function requirePaneliMcpAuth(req, res, next) {
  const path = String(req.path || req.url || "");
  if (path === "/health" || path.endsWith("/health")) return next();

  const secret = getPaneliMcpSecret();
  if (!secret) {
    return res.status(503).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "PANELI_MCP_SECRET not configured",
      },
      id: null,
    });
  }

  const bearer = bearerFromReq(req);
  const xKey = String(req.headers["x-api-key"] || "").trim();
  if (!safeEqual(bearer, secret) && !safeEqual(xKey, secret)) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  }
  return next();
}

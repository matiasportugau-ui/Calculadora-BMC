// Vercel function on calculadora-bc only. Writes Jenerik actions to the
// shared activity log. Not rewritten to Cloud Run (see vercel.json).
import pg from "pg";
import { isTenantClientAction, recordTenantActivity } from "../server/lib/tenantActivity.js";

const ALLOWED_ORIGINS = new Set([
  "https://calculadora-bc.vercel.app",
  "https://calculadora-paneleslam.vercel.app",
  "https://calculadora-smartbuilding.vercel.app",
  "http://127.0.0.1:5180",
  "http://localhost:5180",
]);

let pool;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool = new pg.Pool({ connectionString: url, max: 2, ssl: { rejectUnauthorized: false } });
  return pool;
}

function originOk(req) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) return true;
  const host = req.headers.host || "";
  return host.startsWith("calculadora-bc.") || host.startsWith("calculadora-paneleslam.") || host.startsWith("calculadora-smartbuilding.") || host.startsWith("127.0.0.1:5180");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "https://calculadora-bc.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  if (!originOk(req)) return res.status(403).json({ ok: false, error: "origin" });

  const db = getPool();
  if (!db) return res.status(503).json({ ok: false, error: "db" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = String(body.action || "");
  if (!isTenantClientAction(action)) {
    return res.status(400).json({ ok: false, error: "unknown_action" });
  }
  await recordTenantActivity({
    pool: db,
    action,
    resourceType: typeof body.resource_type === "string" ? body.resource_type : undefined,
    resourceId: typeof body.resource_id === "string" ? body.resource_id : undefined,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    req: { ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress, get: (h) => req.headers[h.toLowerCase()] },
    clientEmitted: true,
  });
  return res.status(202).json({ ok: true });
}

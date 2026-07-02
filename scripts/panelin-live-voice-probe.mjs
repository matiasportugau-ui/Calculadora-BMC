#!/usr/bin/env node
/**
 * panelin-live-voice-probe.mjs — live API checks for /panelin/live voice stack.
 *
 * Tier 1: /health, /capabilities
 * Tier 2: GET /api/agent/voice/health (service token)
 * Tier 3: POST /api/agent/voice/session (ephemeral Realtime token)
 *
 * Env:
 *   BMC_API_BASE   default http://127.0.0.1:3001 (use http://127.0.0.1:5173 if Vite proxy only)
 *   API_AUTH_TOKEN or API_KEY
 *   TOUR_SESSION_COOKIE  optional — also tests user-JWT path via /auth/refresh + session
 *                        (rotates bmc_sess; do not reuse the same value in Playwright E2E)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API = (process.env.BMC_API_BASE || "http://127.0.0.1:3001").replace(/\/+$/, "");

function envKey(key) {
  if (process.env[key]) return process.env[key];
  const p = resolve(ROOT, ".env");
  if (!existsSync(p)) return "";
  const line = readFileSync(p, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

const SERVICE_TOKEN = envKey("API_AUTH_TOKEN") || envKey("API_KEY") || "";
const TOUR_COOKIE = process.env.TOUR_SESSION_COOKIE || "";
const SKIP_SESSION_MINT = process.env.PROBE_SKIP_SESSION_MINT === "1";

let fail = 0;

function ok(label, detail = "") {
  console.log(`  ✓  ${label}${detail ? ` — ${detail}` : ""}`);
}
function bad(label, detail = "") {
  fail++;
  console.log(`  ✗  ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail = "") {
  console.log(`  ⚠  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function jsonFetch(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (SERVICE_TOKEN && !headers.Authorization) {
    headers.Authorization = `Bearer ${SERVICE_TOKEN}`;
  }
  const r = await fetch(`${API}${path}`, { ...init, headers });
  let body = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, ok: r.ok, body, headers: r.headers };
}

async function userJwtFromCookie() {
  if (!TOUR_COOKIE) return null;
  const r = await fetch(`${API}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `bmc_sess=${TOUR_COOKIE}` },
  });
  if (!r.ok) return null;
  const body = await r.json().catch(() => null);
  return body?.accessToken || null;
}

console.log(`\nPanelin Live voice probe — ${API}\n`);

const health = await jsonFetch("/health", { headers: {} });
health.ok ? ok("GET /health", `status=${health.status}`) : bad("GET /health", `HTTP ${health.status}`);

const caps = await jsonFetch("/capabilities", { headers: {} });
caps.ok ? ok("GET /capabilities", caps.body?.version ? `v${caps.body.version}` : "") : bad("GET /capabilities", `HTTP ${caps.status}`);

if (!SERVICE_TOKEN) {
  warn("API_AUTH_TOKEN missing — skipping service-token voice probes");
} else {
  const vh = await jsonFetch("/api/agent/voice/health");
  if (vh.ok && vh.body?.ok) {
    ok("GET /api/agent/voice/health", `latency=${vh.body.latencyMs}ms model=${vh.body.model || "?"}`);
  } else {
    bad("GET /api/agent/voice/health", `HTTP ${vh.status} ${vh.body?.error || ""}`.trim());
  }

  if (SKIP_SESSION_MINT) {
    warn("PROBE_SKIP_SESSION_MINT=1 — skipping POST /session (E2E covers mint path)");
  } else {
    const sess = await jsonFetch("/api/agent/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calcState: {}, devMode: false }),
    });
    const secret = sess.body?.client_secret?.value || sess.body?.client_secret;
    if (sess.ok && secret) {
      ok("POST /api/agent/voice/session (service)", `session_id=${String(sess.body.session_id || "").slice(0, 8)}…`);
    } else {
      bad("POST /api/agent/voice/session (service)", `HTTP ${sess.status} ${sess.body?.error || JSON.stringify(sess.body || {}).slice(0, 120)}`);
    }
  }
}

if (!TOUR_COOKIE) {
  warn("TOUR_SESSION_COOKIE missing — skipping user-JWT voice session (browser E2E path)");
} else {
  const jwt = await userJwtFromCookie();
  if (!jwt) {
    bad("POST /api/auth/refresh", "could not mint access JWT from bmc_sess");
  } else {
    ok("POST /api/auth/refresh", "access JWT OK");
    const sess = await fetch(`${API}/api/agent/voice/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ calcState: {} }),
    });
    const body = await sess.json().catch(() => ({}));
    const secret = body?.client_secret?.value || body?.client_secret;
    if (sess.ok && secret) {
      ok("POST /api/agent/voice/session (user JWT)", "same path as /panelin/live");
    } else {
      bad("POST /api/agent/voice/session (user JWT)", `HTTP ${sess.status} ${body?.error || ""}`);
    }
  }
}

console.log(fail ? `\nRESULT: ${fail} failure(s)\n` : "\nRESULT: voice stack OK for API layer (WebRTC is browser-only)\n");
process.exit(fail ? 1 : 0);
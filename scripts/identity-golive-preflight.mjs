#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// identity-golive-preflight.mjs
//
// Probes a deployed Calculadora-BMC API to verify that the Comprador
// identity feature is operationally healthy. Intended to run AFTER:
//   1. identity-golive-apply.sh applied the migrations
//   2. IDENTITY_JWT_SECRET / GOOGLE_OAUTH_CLIENT_ID / IDENTITY_COOKIE_DOMAIN
//      have been injected into Cloud Run
//   3. The service has been (re-)deployed
//
// Asserts:
//   1. GET /health → 200
//   2. GET /api/auth/me → 401 (proves the route is mounted, but unauth)
//   3. POST /api/auth/google with no body → 400 (proves rate-limiter wired)
//   4. POST /api/auth/refresh with no cookie → 401
//   5. (optional, if ADMIN_BEARER set) GET /api/admin/sheets/clientes/status → 200
//
// Usage:
//   API_BASE=https://panelin-calc-...run.app \
//     node scripts/identity-golive-preflight.mjs
//
//   API_BASE=... ADMIN_BEARER=eyJ... \
//     node scripts/identity-golive-preflight.mjs
// ──────────────────────────────────────────────────────────────────────────

const API_BASE = (process.env.API_BASE || "").replace(/\/+$/, "");
const ADMIN_BEARER = process.env.ADMIN_BEARER || "";

if (!API_BASE) {
  console.error("✖ API_BASE is required (e.g. https://panelin-calc-....run.app)");
  process.exit(1);
}

const checks = [];
let failed = 0;

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failed += 1;
  const symbol = ok ? "✔" : "✖";
  const color = ok ? "[32m" : "[31m";
  console.log(`${color}${symbol}[0m ${name}${detail ? `   ${detail}` : ""}`);
}

async function probe(path, init = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await fetch(url, init);
    const body = await r.text().catch(() => "");
    return { status: r.status, body: body.slice(0, 200), ok: true };
  } catch (e) {
    return { status: 0, body: e.message, ok: false };
  }
}

console.log(`\nProbing ${API_BASE} …\n`);

const r1 = await probe("/health");
record("GET /health → 200",
  r1.status === 200,
  r1.status ? `(got ${r1.status})` : `(network error: ${r1.body})`);

const r2 = await probe("/api/auth/me");
record("GET /api/auth/me → 401 (route mounted, unauthenticated)",
  r2.status === 401,
  `(got ${r2.status})`);

const r3 = await probe("/api/auth/google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
record("POST /api/auth/google {} → 400 (input validation)",
  r3.status === 400,
  `(got ${r3.status})`);

const r4 = await probe("/api/auth/refresh", { method: "POST" });
record("POST /api/auth/refresh (no cookie) → 401",
  r4.status === 401,
  `(got ${r4.status})`);

if (ADMIN_BEARER) {
  const r5 = await probe("/api/admin/sheets/clientes/status", {
    headers: { Authorization: `Bearer ${ADMIN_BEARER}` },
  });
  record("GET /api/admin/sheets/clientes/status (admin Bearer) → 200",
    r5.status === 200,
    `(got ${r5.status})`);

  if (r5.status === 200) {
    try {
      const j = JSON.parse(r5.body);
      record("  └ status response shape (.enabled, .tab)",
        typeof j.enabled === "boolean" && typeof j.tab === "string",
        `enabled=${j.enabled} tab="${j.tab}"`);
    } catch {
      record("  └ status response shape", false, "non-JSON body");
    }
  }
} else {
  console.log("\n  (set ADMIN_BEARER=<jwt> to also exercise the admin sheets check)\n");
}

console.log("");
if (failed === 0) {
  console.log("[32m✔ All preflight checks passed.[0m");
  process.exit(0);
} else {
  console.log(`[31m✖ ${failed} check(s) failed. Review the above.[0m`);
  process.exit(1);
}

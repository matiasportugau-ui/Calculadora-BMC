// ═══════════════════════════════════════════════════════════════════════════
// E2E API tests — Panelin platform router (/api/panelin/*)
// Run: node tests/panelinApi.test.js
//
// Offline by design: these assert the AUTH contract (requireAuth) + request
// validation + the DB-unavailable guard, none of which need a live Postgres.
// The happy-path DB behavior (recalc, negative-stock guard, 404-on-missing-SKU)
// is exercised by scripts/verify-panelin-fase2.mjs against a real DB.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { config } from "../server/config.js";
import createPanelinRouter from "../server/routes/panelin.js";

// Force a deterministic offline environment BEFORE any request:
// - a known service token so requireAuth has something to match (it reads the
//   singleton config at request time, so mutating it here is enough);
// - no DATABASE_URL so getPool() returns null → handlers answer 503, which
//   proves a request got PAST auth (401 vs 503 distinguishes the two).
delete process.env.DATABASE_URL;
const TEST_TOKEN = "test-token-panelin-api-suite";
config.apiAuthToken = TEST_TOKEN;
config.databaseUrl = "";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed += 1;
  }
}

async function run() {
  console.log("\n═══ SUITE: panelin platform router E2E API ═══");

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/panelin", createPanelinRouter(config, console));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api/panelin`;

  const call = async (method, path, { body, headers = {} } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  const bearer = { Authorization: `Bearer ${TEST_TOKEN}` };
  const apiKey = { "X-Api-Key": TEST_TOKEN };
  const wrong = { Authorization: "Bearer not-the-token" };

  try {
    // ── Auth is enforced on every surface (reads AND writes) ────────────────
    let r = await call("GET", "/status");
    assert("GET /status sin token → 401", r.status === 401, r.status, 401);

    r = await call("GET", "/products");
    assert("GET /products sin token → 401", r.status === 401, r.status, 401);

    r = await call("PATCH", "/products/ABC", { body: { cost_usd: 10 } });
    assert("PATCH /products/:sku sin token → 401", r.status === 401, r.status, 401);

    r = await call("POST", "/stock/movements", { body: { sku: "ABC", deposito: "principal", delta: 1 } });
    assert("POST /stock/movements sin token → 401", r.status === 401, r.status, 401);

    r = await call("POST", "/invoices", { body: {} });
    assert("POST /invoices sin token → 401", r.status === 401, r.status, 401);

    // ── A wrong token is rejected ───────────────────────────────────────────
    r = await call("GET", "/products", { headers: wrong });
    assert("GET /products token inválido → 401", r.status === 401, r.status, 401);

    // ── A valid token passes auth (then hits the DB-unavailable guard) ──────
    r = await call("GET", "/products", { headers: bearer });
    assert("GET /products con Bearer → pasa auth (no 401)", r.status !== 401, r.status, "!=401");
    assert("GET /products con Bearer → 503 (DB no disponible)", r.status === 503, r.status, 503);

    r = await call("GET", "/products", { headers: apiKey });
    assert("GET /products con X-Api-Key → pasa auth (no 401)", r.status !== 401, r.status, "!=401");

    // ── Validation runs after auth, before the DB ───────────────────────────
    r = await call("PATCH", "/products/ABC", { headers: bearer, body: { cost_usd: "not-a-number" } });
    assert("PATCH cost_usd inválido (con token) → 400", r.status === 400, r.status, 400);
    assert("PATCH cost_usd inválido → error invalid_cost_usd", r.json?.error === "invalid_cost_usd", r.json?.error, "invalid_cost_usd");

    r = await call("PATCH", "/products/ABC", { headers: bearer, body: { cost_usd: 12.5 } });
    assert("PATCH cost_usd válido (con token, sin DB) → 503", r.status === 503, r.status, 503);
  } finally {
    server.close();
  }

  console.log(`\n── panelin platform router: ${passed} passed, ${failed} failed ──`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("SUITE CRASHED:", err);
  process.exit(1);
});

// Targeted kill-switch for POST /api/wolfboard/row-create.
// Offline route test — never touches Google Sheets.
// node tests/wolfboardRowCreateKillSwitch.test.js

import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_rc_killswitch";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";

const { createWolfboardRouter } = await import("../server/routes/wolfboard.js");

function makeApp(cfg) {
  const app = express();
  app.use(express.json());
  app.use("/api/wolfboard", createWolfboardRouter(cfg));
  return app;
}

function startServer(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
}

function fetchJson(server, path, { method = "GET", headers = {}, body } = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          let json = null;
          try { json = chunks ? JSON.parse(chunks) : null; } catch { /* non-JSON */ }
          resolve({ status: res.statusCode, body: chunks, json });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const BEARER = { Authorization: "Bearer static_service_token_rc_killswitch" };

// Minimal config shared by the three tests. wolfbAdminSheetId is set so that
// the endpoint reaches the kill-switch guard before the ENV_MISSING guard.
const baseCfg = {
  wolfbAdminSheetId: "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0",
  wolfbAdminTab: "Admin.",
  wolfbDryRun: false,
};

// ── Test 1: kill-switch ON → 200 soft-skip, no Sheets client ──────────────
{
  const app = makeApp({ ...baseCfg, wolfbRowCreateDisabled: true });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/wolfboard/row-create", {
    method: "POST",
    headers: BEARER,
    body: { consulta: "lead chat storefront", origen: "VW", cliente: "QA", telefono: "0" },
  });
  assert.equal(r.status, 200, "kill-switch soft-skip must stay 200 so storefront chat does not error-page");
  assert.equal(r.json?.ok, true);
  assert.equal(r.json?.skipped, "row_create_disabled");
  // Should NOT have attempted to append — no adminRow field.
  assert.equal(r.json?.adminRow, undefined);
  srv.close();
}

// ── Test 2: kill-switch OFF (default) → endpoint does NOT short-circuit on
//            the kill-switch; the request keeps flowing through the normal
//            path (which, offline, fails at getSheetsClient — that's fine; we
//            only need to prove the kill-switch did not fire).
{
  const app = makeApp({ ...baseCfg /* wolfbRowCreateDisabled defaults off */ });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/wolfboard/row-create", {
    method: "POST",
    headers: BEARER,
    body: { consulta: "lead chat storefront", origen: "VW", cliente: "QA", telefono: "0" },
  });
  assert.notEqual(
    r.json?.skipped,
    "row_create_disabled",
    "default config must NOT trip the kill-switch — current deploys stay unbroken",
  );
  srv.close();
}

// ── Test 3: kill-switch ON + missing consulta → still 200 skipped (short-circuits input validation)
{
  const app = makeApp({ ...baseCfg, wolfbRowCreateDisabled: true });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/wolfboard/row-create", {
    method: "POST",
    headers: BEARER,
    body: {},
  });
  assert.equal(r.status, 200);
  assert.equal(r.json?.skipped, "row_create_disabled");
  srv.close();
}

console.log("wolfboardRowCreateKillSwitch.test.js: ok");

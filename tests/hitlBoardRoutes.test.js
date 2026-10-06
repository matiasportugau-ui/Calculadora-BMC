// hitl board — route-level integration without touching Google Sheets.
// Covers: auth (401), health (public), ENV_MISSING 503, dry-run write path,
// validation 400, CORS allowlist. Keeps the test offline so it runs in gate:local.

import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_hitl";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.HITL_DASHBOARD_ORIGINS = "https://bmc-cola-hitl-matprompts-projects.vercel.app, https://preview.example.vercel.app";

const { createHitlBoardRouter } = await import("../server/routes/hitlBoard.js");

function makeApp(cfg) {
  const app = express();
  app.use(express.json());
  app.use("/api/hitl", createHitlBoardRouter(cfg));
  return app;
}

function startServer(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
}

async function fetchJson(server, path, { method = "GET", headers = {}, body } = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          let json = null;
          try { json = chunks ? JSON.parse(chunks) : null; } catch { /* non-JSON */ }
          resolve({ status: res.statusCode, headers: res.headers, body: chunks, json });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

const BEARER = { Authorization: "Bearer static_service_token_hitl" };

// ── Test 1: /health is open and reports config ────────────────────────────
{
  const app = makeApp({ wolfbAdminSheetId: "", wolfbAdminTab: "Admin." });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/hitl/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.service, "hitl-board");
  assert.equal(r.json.configured.tab, "Admin.");
  assert.equal(r.json.configured.sheet_id, false);
  assert.deepEqual(
    r.json.configured.dashboard_origins,
    ["https://bmc-cola-hitl-matprompts-projects.vercel.app", "https://preview.example.vercel.app"],
  );
  srv.close();
}

// ── Test 2: /board rejects unauthenticated (service-token guard) ──────────
{
  const app = makeApp({ wolfbAdminSheetId: "1xxx", wolfbAdminTab: "Admin." });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/hitl/board");
  assert.equal(r.status, 401, "no auth → 401");
  srv.close();
}

// ── Test 3: /board 503 ENV_MISSING when WOLFB_ADMIN_SHEET_ID absent ───────
{
  const app = makeApp({ wolfbAdminSheetId: "", wolfbAdminTab: "Admin." });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/hitl/board", { headers: BEARER });
  assert.equal(r.status, 503);
  assert.equal(r.json.code, "ENV_MISSING");
  assert.equal(r.json.envVar, "WOLFB_ADMIN_SHEET_ID");
  srv.close();
}

// ── Test 4: /row/update dry-run → no sheet writes, echoes planned ranges ─
{
  const app = makeApp({
    wolfbAdminSheetId: "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0",
    wolfbAdminTab: "Admin.",
    wolfbDryRun: true,
  });
  const srv = await startServer(app);
  const r = await fetchJson(srv, "/api/hitl/row/update", {
    method: "POST",
    headers: BEARER,
    body: {
      admin_row: 42,
      estado: "Cotizable",
      respuesta: "ok",
      link: "https://x",
      interpretacion: "escenario=solo_techo",
      datos_faltantes: "faltan medidas",
      replay_snapshot_url: "gs://x/replay.json",
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.dry_run, true);
  assert.equal(r.json.admin_row, 42);
  // LIVE Admin header mapping:
  //   estado → C, interpretacion → J, respuesta → K, datos_faltantes → L, link → M
  assert.deepEqual(r.json.updates, [
    "'Admin.'!C42",
    "'Admin.'!J42",
    "'Admin.'!K42",
    "'Admin.'!L42",
    "'Admin.'!M42",
  ]);
  // replay_snapshot_url must be dropped (no column for it on the live header).
  assert.deepEqual(r.json.dropped, ["replay_snapshot_url"]);
  srv.close();
}

// ── Test 5: /row/update validation 400 (bad admin_row, no fields) ─────────
{
  const app = makeApp({
    wolfbAdminSheetId: "1xxx",
    wolfbAdminTab: "Admin.",
    wolfbDryRun: true,
  });
  const srv = await startServer(app);

  const r1 = await fetchJson(srv, "/api/hitl/row/update", {
    method: "POST", headers: BEARER, body: { admin_row: 0, estado: "x" },
  });
  assert.equal(r1.status, 400);
  assert.match(r1.json.error, /admin_row/);

  const r2 = await fetchJson(srv, "/api/hitl/row/update", {
    method: "POST", headers: BEARER, body: { admin_row: 5 },
  });
  assert.equal(r2.status, 400);
  assert.match(r2.json.error, /Nada para actualizar/);
  srv.close();
}

// ── Test 6: CORS allowlist (OPTIONS preflight) ────────────────────────────
{
  const app = makeApp({ wolfbAdminSheetId: "1xxx", wolfbAdminTab: "Admin." });
  const srv = await startServer(app);
  const allowed = await fetchJson(srv, "/api/hitl/board", {
    method: "OPTIONS",
    headers: {
      Origin: "https://bmc-cola-hitl-matprompts-projects.vercel.app",
      "Access-Control-Request-Method": "GET",
    },
  });
  assert.equal(allowed.status, 204);
  assert.equal(
    allowed.headers["access-control-allow-origin"],
    "https://bmc-cola-hitl-matprompts-projects.vercel.app",
  );
  assert.match(allowed.headers["access-control-allow-methods"] || "", /GET/);

  const blocked = await fetchJson(srv, "/api/hitl/board", {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
  });
  assert.equal(blocked.status, 204);
  assert.equal(
    blocked.headers["access-control-allow-origin"],
    undefined,
    "non-allowlisted origins must NOT receive ACAO",
  );
  srv.close();
}

console.log("hitlBoardRoutes.test.js: ok");

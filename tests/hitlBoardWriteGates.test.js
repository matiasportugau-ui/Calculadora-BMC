// HITL route gates missing from the smoke suite: formula-safe USER_ENTERED
// writes, exact-match 304, query dry-run, and auth on the write path.
// Injects cfg.getSheetsClient so Google is never called.

import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_hitl_edges";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.HITL_DASHBOARD_ORIGINS = "https://bmc-cola-hitl-matprompts-projects.vercel.app";

const { createHitlBoardRouter } = await import("../server/routes/hitlBoard.js");

const TOKEN = "static_service_token_hitl_edges";
const BEARER = { Authorization: `Bearer ${TOKEN}` };
const SHEET = "sheet-test-id";
const ORIGIN = "https://bmc-cola-hitl-matprompts-projects.vercel.app";

function pendienteRow(consulta = "Consulta base") {
  return ["", "01-09", "", "099", "ACME", "ML", "", "MVD", consulta, "", "", "Pendiente", ""];
}

function makeApp(cfg) {
  const app = express();
  app.use(express.json());
  app.use("/api/hitl", createHitlBoardRouter(cfg));
  return app;
}

function startServer(app) {
  return new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
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
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { /* 304 / empty */ }
          resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
        });
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function withServer(cfg, fn) {
  const srv = await startServer(makeApp(cfg));
  try {
    await fn(srv);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
}

function sheetsDouble({ values, onGet, onWrite }) {
  return {
    getSheetsClient: async () => ({
      spreadsheets: {
        values: {
          get: async (args) => {
            if (onGet) onGet(args);
            const current = typeof values === "function" ? values() : values;
            return { data: { values: current } };
          },
          batchUpdate: async (args) => {
            if (onWrite) onWrite(args);
            return {};
          },
        },
      },
    }),
  };
}

const baseCfg = {
  wolfbAdminSheetId: SHEET,
  wolfbAdminTab: "Admin.",
  wolfbDryRun: false,
};

// 1. Unauthenticated write and compat read never touch Sheets.
{
  let writes = 0;
  await withServer({
    ...baseCfg,
    ...sheetsDouble({ values: [pendienteRow()], onWrite: () => { writes += 1; } }),
  }, async (srv) => {
    const post = await fetchJson(srv, "/api/hitl/row/update", {
      method: "POST",
      body: { admin_row: 2, estado: "Enviado" },
    });
    assert.equal(post.status, 401);
    const lower = await fetchJson(srv, "/api/hitl/row/update", {
      method: "POST",
      headers: { Authorization: `bearer ${TOKEN}` },
      body: { admin_row: 2, estado: "Enviado" },
    });
    assert.equal(lower.status, 401);
    const queryKey = await fetchJson(srv, `/api/hitl/row/update?key=${TOKEN}`, {
      method: "POST",
      body: { admin_row: 2, estado: "Enviado" },
    });
    assert.equal(queryKey.status, 401);
    const compat = await fetchJson(srv, "/api/hitl/board.json");
    assert.equal(compat.status, 401);
    assert.equal(writes, 0);
  });
}

// 2. X-Api-Key is accepted. Query dry_run skips batchUpdate. Float row is not truncated.
{
  let writes = 0;
  await withServer({
    ...baseCfg,
    ...sheetsDouble({ values: [], onWrite: () => { writes += 1; } }),
  }, async (srv) => {
    const dry = await fetchJson(srv, "/api/hitl/row/update?dry_run=YES", {
      method: "POST",
      headers: { "X-Api-Key": TOKEN },
      body: {
        adminRow: 9,
        estado: "Cotizable",
        replay_snapshot_url: "https://replay.example/s",
      },
    });
    assert.equal(dry.status, 200);
    assert.equal(dry.json.dry_run, true);
    assert.equal(dry.json.admin_row, 9);
    assert.deepEqual(dry.json.updates, ["'Admin.'!L9", "'Admin.'!M9"]);

    const floated = await fetchJson(srv, "/api/hitl/row/update?dry_run=1", {
      method: "POST",
      headers: BEARER,
      body: { admin_row: 2.9, estado: "ok" },
    });
    assert.equal(floated.json.updates[0], "'Admin.'!L2.9");

    const off = await fetchJson(srv, "/api/hitl/row/update?dry_run=0", {
      method: "POST",
      headers: BEARER,
      body: { admin_row: 4, estado: "ok" },
    });
    assert.equal(off.json.dry_run, undefined);
    assert.equal(off.json.ok, true);
    assert.equal(writes, 1);

    const alsoOff = await fetchJson(srv, "/api/hitl/row/update?dry_run=false", {
      method: "POST",
      headers: BEARER,
      body: { admin_row: 4, estado: "ok" },
    });
    assert.equal(alsoOff.json.updated_fields[0], "estado");
    assert.equal(writes, 2);
  });
}

// 3. A string "0" config flag is truthy and must not write.
{
  let writes = 0;
  await withServer({
    ...baseCfg,
    wolfbDryRun: "0",
    ...sheetsDouble({ values: [], onWrite: () => { writes += 1; } }),
  }, async (srv) => {
    const r = await fetchJson(srv, "/api/hitl/row/update", {
      method: "POST",
      headers: BEARER,
      body: { admin_row: 4, estado: "ok" },
    });
    assert.equal(r.json.dry_run, true);
    assert.equal(writes, 0);
  });
}

// 4. Live write uses USER_ENTERED and prefixes formula triggers.
{
  const writes = [];
  await withServer({
    ...baseCfg,
    ...sheetsDouble({ values: [], onWrite: (args) => writes.push(args) }),
  }, async (srv) => {
    const r = await fetchJson(srv, "/api/hitl/row/update", {
      method: "POST",
      headers: BEARER,
      body: {
        admin_row: 12,
        estado: '=IMPORTRANGE("https://evil","A1")',
        respuesta: " =HYPERLINK(\"http://evil\")",
        link: "https://drive.example/q",
        replay_snapshot_url: "@SUM(A1)",
      },
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.updated_fields, ["estado", "respuesta", "link", "replay_snapshot_url"]);
    assert.equal(writes.length, 1);
    const req = writes[0];
    assert.equal(req.spreadsheetId, SHEET);
    assert.equal(req.requestBody.valueInputOption, "USER_ENTERED");
    const byRange = Object.fromEntries(req.requestBody.data.map((d) => [d.range, d.values[0][0]]));
    assert.equal(byRange["'Admin.'!L12"], "'=IMPORTRANGE(\"https://evil\",\"A1\")");
    assert.equal(byRange["'Admin.'!J12"], "' =HYPERLINK(\"http://evil\")");
    assert.equal(byRange["'Admin.'!K12"], "https://drive.example/q");
    assert.equal(byRange["'Admin.'!M12"], "'@SUM(A1)");
  });
}

// 5. Empty estado still writes a cell. Sheet failures stay 503.
{
  const writes = [];
  await withServer({
    ...baseCfg,
    ...sheetsDouble({
      values: [],
      onWrite: (args) => {
        writes.push(args);
        throw new Error("quota write");
      },
    }),
  }, async (srv) => {
    const r = await fetchJson(srv, "/api/hitl/row/update", {
      method: "POST",
      headers: BEARER,
      body: { admin_row: 6, estado: "" },
    });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /Error al escribir en Admin: quota write/);
    assert.equal(writes[0].requestBody.data[0].values[0][0], "");
  });
}

// 6. Sheets auth errors are redacted. Read errors are surfaced as 503.
{
  await withServer({
    ...baseCfg,
    getSheetsClient: async () => {
      throw new Error("-----BEGIN PRIVATE KEY-----\nsecret-material");
    },
  }, async (srv) => {
    for (const path of ["/api/hitl/board", "/api/hitl/row/update"]) {
      const r = await fetchJson(srv, path, {
        method: path.endsWith("update") ? "POST" : "GET",
        headers: BEARER,
        body: path.endsWith("update") ? { admin_row: 4, estado: "ok" } : undefined,
      });
      assert.equal(r.status, 503);
      assert.match(r.json.error, /credenciales mal formadas/);
      assert.equal(r.body.includes("PRIVATE KEY"), false);
      assert.equal(r.body.includes("secret-material"), false);
    }
  });

  const gets = [];
  await withServer({
    ...baseCfg,
    ...sheetsDouble({
      values: [],
      onGet: (args) => {
        gets.push(args);
        throw new Error("quota exceeded");
      },
    }),
  }, async (srv) => {
    const r = await fetchJson(srv, "/api/hitl/board.json", { headers: BEARER });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /Error al leer Admin: quota exceeded/);
    assert.equal(gets[0].range, "'Admin.'!A2:M");
    assert.equal(gets[0].valueRenderOption, "FORMATTED_VALUE");
    const missing = await fetchJson(srv, "/api/hitl/board.json", {
      headers: BEARER,
    });
    assert.equal(missing.status, 503);
  });
}

{
  await withServer({
    wolfbAdminSheetId: "",
    wolfbAdminTab: "Admin.",
    wolfbDryRun: false,
  }, async (srv) => {
    const r = await fetchJson(srv, "/api/hitl/board.json", { headers: BEARER });
    assert.equal(r.status, 503);
    assert.equal(r.json.envVar, "WOLFB_ADMIN_SHEET_ID");
  });
}

// 7. Exact If-None-Match 304s before Cache-Control. A list or "*" still 304s
//    via res.json(). A same-length consulta edit still 304s.
{
  let consulta = "Consulta base";
  await withServer({
    ...baseCfg,
    ...sheetsDouble({ values: () => [pendienteRow(consulta)] }),
  }, async (srv) => {
    const first = await fetchJson(srv, "/api/hitl/board", { headers: BEARER });
    assert.equal(first.status, 200);
    assert.equal(first.headers.etag, first.json.etag);
    assert.equal(first.headers["cache-control"], "private, max-age=15, must-revalidate");
    assert.equal(first.json.items[0].consulta, "Consulta base");

    const fresh = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": first.json.etag },
    });
    assert.equal(fresh.status, 304);
    assert.equal(fresh.body, "");
    assert.equal(fresh.headers.etag, first.json.etag);
    // Early return happens before Cache-Control. Express res.json() is a second 304 path.
    assert.equal(fresh.headers["cache-control"], undefined);

    const listed = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": `${first.json.etag}, W/"other"` },
    });
    assert.equal(listed.status, 304);
    assert.equal(listed.body, "");
    assert.equal(listed.headers["cache-control"], "private, max-age=15, must-revalidate");

    const star = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": "*" },
    });
    assert.equal(star.status, 304);

    const other = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": 'W/"deadbeef"' },
    });
    assert.equal(other.status, 200);

    consulta = "Consulta basX";
    const stale = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": first.json.etag },
    });
    assert.equal(stale.status, 304, "same-length consulta edit currently revalidates");

    consulta = "Consulta base!";
    const changed = await fetchJson(srv, "/api/hitl/board", {
      headers: { ...BEARER, "If-None-Match": first.json.etag },
    });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.json.etag, first.json.etag);
    assert.equal(changed.json.items[0].consulta, "Consulta base!");

    const compat = await fetchJson(srv, "/api/hitl/board.json", {
      headers: { ...BEARER, "If-None-Match": changed.json.etag, Origin: ORIGIN },
    });
    assert.equal(compat.status, 200);
    assert.equal(compat.json.count, 1);
    assert.equal(compat.json.items[0].url, `https://docs.google.com/spreadsheets/d/${SHEET}/edit`);
    assert.equal(compat.headers["access-control-allow-origin"], ORIGIN);
    assert.match(compat.headers["access-control-expose-headers"], /ETag/);
  });
}

// 8. CORS is exact-origin, including on a credentialed GET.
{
  await withServer({ ...baseCfg, wolfbDryRun: false }, async (srv) => {
    const lookalike = await fetchJson(srv, "/api/hitl/health", {
      headers: { Origin: `${ORIGIN}.evil` },
    });
    assert.equal(lookalike.status, 200);
    assert.equal(lookalike.headers["access-control-allow-origin"], undefined);
    const bare = await fetchJson(srv, "/api/hitl/health");
    assert.equal(bare.headers["access-control-allow-origin"], undefined);
  });
}

console.log("hitlBoardWriteGates.test.js: ok");

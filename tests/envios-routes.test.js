/**
 * Envíos API (#884/#886/#890) — offline route regression.
 * Covers auth gates, DB-unavailable, ventas-csv validation/cache,
 * geocode lat/lng validation, and draft PUT revision_conflict (409).
 *
 * Run: node --test tests/envios-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import createEnviosRouter, {
  __resetEnviosVentasCsvCacheForTests,
} from "../server/routes/envios.js";

const API_TOKEN = "envios-test-token-not-a-secret";
const SHEET_ID = "1KFNabcdefghijklmnopqrstuvwxyz0123456789"; // ≥20 valid chars

function silentLogger() {
  return { warn() {}, error() {}, info() {}, debug() {} };
}

function makeDraftPool({ drafts = [] } = {}) {
  const rows = drafts.map((d) => ({ ...d }));
  return {
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (norm === "select 1") return { rows: [{ "?column?": 1 }] };

      // ensureEnviosSchema — DDL no-op in shim
      if (norm.startsWith("create table") || norm.startsWith("create index")) {
        return { rows: [] };
      }

      if (norm.includes("from envios_drafts") && norm.includes("order by updated_at")) {
        const limit = Number(params[0]) || 20;
        return {
          rows: rows
            .slice()
            .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
            .slice(0, limit)
            .map((r) => ({
              id: r.id,
              env_no: r.env_no,
              revision: r.revision,
              updated_at: r.updated_at,
              created_at: r.created_at,
              updated_by: r.updated_by,
              saved_at: r.payload?.savedAt || null,
              stop_count: Array.isArray(r.payload?.stops) ? r.payload.stops.length : 0,
            })),
        };
      }

      if (
        norm.includes("from envios_drafts where id = $1") &&
        norm.startsWith("select id, env_no, payload, revision")
      ) {
        const row = rows.find((r) => r.id === params[0]);
        return { rows: row ? [row] : [] };
      }

      if (norm.startsWith("insert into envios_drafts")) {
        const [id, envNo, payloadJson, updatedBy] = params;
        const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
        let row = rows.find((r) => r.id === id);
        if (!row) {
          row = {
            id,
            env_no: envNo,
            payload,
            revision: 1,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
          rows.push(row);
        } else {
          row.env_no = envNo;
          row.payload = payload;
          row.revision = Number(row.revision) + 1;
          row.updated_by = updatedBy;
          row.updated_at = new Date().toISOString();
        }
        return {
          rows: [
            {
              id: row.id,
              env_no: row.env_no,
              revision: row.revision,
              updated_at: row.updated_at,
              created_at: row.created_at,
              updated_by: row.updated_by,
            },
          ],
        };
      }

      if (norm.startsWith("delete from envios_drafts")) {
        const idx = rows.findIndex((r) => r.id === params[0]);
        if (idx < 0) return { rows: [], rowCount: 0 };
        rows.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected envios SQL: ${norm.slice(0, 140)}`);
    },
    _rows: rows,
  };
}

function request(port, method, path, { token, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          if (chunks) {
            try {
              parsed = JSON.parse(chunks);
            } catch {
              parsed = chunks;
            }
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: chunks });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function listenRouter(config, deps) {
  const app = express();
  app.use(express.json());
  app.use("/api", createEnviosRouter(config, silentLogger(), deps));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    port,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test("GET /api/envios/health without DB reports draftsDb false", async () => {
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "" },
    { pool: null },
  );
  try {
    const res = await request(port, "GET", "/api/envios/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.module, "envios");
    assert.equal(res.body.draftsDb, false);
  } finally {
    await close();
  }
});

test("drafts require API auth — 401 without token", async () => {
  const pool = makeDraftPool();
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "GET", "/api/envios/drafts");
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  } finally {
    await close();
  }
});

test("drafts return 503 when API_AUTH_TOKEN unset", async () => {
  const pool = makeDraftPool();
  const { port, close } = await listenRouter(
    { apiAuthToken: "", databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "GET", "/api/envios/drafts", { token: "x" });
    assert.equal(res.status, 503);
    assert.match(String(res.body.error || ""), /API_AUTH_TOKEN/);
  } finally {
    await close();
  }
});

test("drafts return 503 when DATABASE_URL / pool missing", async () => {
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "" },
    { pool: null },
  );
  try {
    const res = await request(port, "GET", "/api/envios/drafts", { token: API_TOKEN });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, "DATABASE_URL not configured");
  } finally {
    await close();
  }
});

test("PUT draft returns 409 revision_conflict when expectedRevision mismatches", async () => {
  const pool = makeDraftPool({
    drafts: [
      {
        id: "ENV-1",
        env_no: "ENV-1",
        payload: {
          info: { numero: "ENV-1", fecha: "2026-08-06" },
          stops: [],
          savedAt: "2026-08-06T10:00:00.000Z",
        },
        revision: 3,
        updated_at: "2026-08-06T10:00:00.000Z",
        created_at: "2026-08-06T09:00:00.000Z",
        updated_by: "ops",
      },
    ],
  });
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "PUT", "/api/envios/drafts/ENV-1", {
      token: API_TOKEN,
      body: {
        expectedRevision: 1,
        payload: {
          info: { numero: "ENV-1", fecha: "2026-08-06" },
          stops: [{ id: "s1", cliente: "A", paneles: [] }],
        },
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "revision_conflict");
    assert.equal(res.body.draft.revision, 3);
    assert.equal(pool._rows[0].revision, 3, "conflict must not bump revision");
  } finally {
    await close();
  }
});

test("PUT draft upserts and increments revision when expectedRevision matches", async () => {
  const pool = makeDraftPool({
    drafts: [
      {
        id: "ENV-2",
        env_no: "ENV-2",
        payload: { info: { numero: "ENV-2", fecha: "2026-08-06" }, stops: [] },
        revision: 2,
        updated_at: "2026-08-06T10:00:00.000Z",
        created_at: "2026-08-06T09:00:00.000Z",
        updated_by: null,
      },
    ],
  });
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "PUT", "/api/envios/drafts/ENV-2", {
      token: API_TOKEN,
      body: {
        expectedRevision: 2,
        updatedBy: "matias",
        payload: {
          info: { numero: "ENV-2", fecha: "2026-08-06" },
          stops: [{ id: "s1", cliente: "B", paneles: [] }],
        },
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.draft.revision, 3);
    assert.equal(res.body.draft.stopCount, 1);
  } finally {
    await close();
  }
});

test("PUT draft rejects invalid payload", async () => {
  const pool = makeDraftPool();
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "PUT", "/api/envios/drafts/ENV-x", {
      token: API_TOKEN,
      body: { payload: { stops: "not-an-array" } },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  } finally {
    await close();
  }
});

test("POST geocode validates lat/lng without calling Nominatim", async () => {
  let fetchCalls = 0;
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "" },
    {
      pool: null,
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("should not fetch");
      },
    },
  );
  try {
    const bad = await request(port, "POST", "/api/envios/geocode", {
      token: API_TOKEN,
      body: { lat: 99, lng: -56 },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "invalid_lat_lng");

    const empty = await request(port, "POST", "/api/envios/geocode", {
      token: API_TOKEN,
      body: {},
    });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.error, "address_required");

    const ok = await request(port, "POST", "/api/envios/geocode", {
      token: API_TOKEN,
      body: { lat: -34.9, lng: -56.2, label: "MVD" },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);
    assert.equal(ok.body.geo.source, "manual");
    assert.equal(fetchCalls, 0);
  } finally {
    await close();
  }
});

test("GET ventas-csv validates sheetId and serves cache HIT", async () => {
  __resetEnviosVentasCsvCacheForTests();
  let upstreamHits = 0;
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "" },
    {
      pool: null,
      fetch: async () => {
        upstreamHits += 1;
        return {
          ok: true,
          status: 200,
          async text() {
            return "NOMBRE,ENCARGO\nAda,https://drive.google.com/file/d/x/view\n";
          },
        };
      },
    },
  );
  try {
    const bad = await request(port, "GET", "/api/envios/ventas-csv?sheetId=short&gid=0", {
      token: API_TOKEN,
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, "invalid_sheet_id");

    const miss = await request(
      port,
      "GET",
      `/api/envios/ventas-csv?sheetId=${encodeURIComponent(SHEET_ID)}&gid=926747636`,
      { token: API_TOKEN },
    );
    assert.equal(miss.status, 200);
    assert.equal(miss.headers["x-envios-cache"], "MISS");
    assert.match(String(miss.raw), /Ada/);

    const hit = await request(
      port,
      "GET",
      `/api/envios/ventas-csv?sheetId=${encodeURIComponent(SHEET_ID)}&gid=926747636`,
      { token: API_TOKEN },
    );
    assert.equal(hit.status, 200);
    assert.equal(hit.headers["x-envios-cache"], "HIT");
    assert.equal(upstreamHits, 1, "second request must use process cache");
  } finally {
    __resetEnviosVentasCsvCacheForTests();
    await close();
  }
});

test("GET draft 404 when missing", async () => {
  const pool = makeDraftPool();
  const { port, close } = await listenRouter(
    { apiAuthToken: API_TOKEN, databaseUrl: "postgres://test" },
    { pool },
  );
  try {
    const res = await request(port, "GET", "/api/envios/drafts/missing-id", {
      token: API_TOKEN,
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "not_found");
  } finally {
    await close();
  }
});

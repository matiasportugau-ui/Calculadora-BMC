/**
 * Repartos API (#903) — offline route regression.
 * Covers auth gates, DB-unavailable, revision conflict, immutable PUT,
 * confirm transition/no_stops, and create numbering without live Postgres.
 *
 * Run: node --test tests/repartos-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import createRepartosRouter from "../server/routes/repartos.js";

const API_TOKEN = "repartos-test-token-not-a-secret";

function silentLogger() {
  return { warn() {}, error() {}, info() {}, debug() {} };
}

function makeRepartosPool({ repartos = [], events = [] } = {}) {
  const rows = repartos.map((r) => ({ ...r, payload: r.payload ? { ...r.payload } : {} }));
  const eventRows = events.map((e) => ({ ...e }));

  return {
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (norm === "select 1") return { rows: [{ "?column?": 1 }] };

      // ensureEnviosSchema — DDL no-op in shim
      if (
        norm.startsWith("create table") ||
        norm.startsWith("create index")
      ) {
        return { rows: [] };
      }

      if (norm.includes("from repartos where reparto_no like $1")) {
        const like = String(params[0] || "");
        const prefix = like.replace(/%/g, "");
        return {
          rows: rows
            .filter((r) => String(r.reparto_no || "").startsWith(prefix))
            .map((r) => ({ reparto_no: r.reparto_no })),
        };
      }

      if (norm.startsWith("insert into repartos")) {
        const [
          id,
          repartoNo,
          ymd,
          truckL,
          vehicleLabel,
          transportista,
          patente,
          payloadJson,
          actor,
        ] = params;
        const payload =
          typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
        const row = {
          id,
          reparto_no: repartoNo,
          status: "en_coordinacion",
          delivery_date: ymd,
          truck_l: truckL,
          vehicle_label: vehicleLabel,
          transportista,
          patente,
          payload,
          created_by: actor,
          revision: 1,
          drive_folder_url: null,
          confirmed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        rows.push(row);
        return { rows: [row] };
      }

      if (norm.startsWith("insert into reparto_events")) {
        const [repartoId, type, message, actor, metaJson] = params;
        eventRows.push({
          id: `ev-${eventRows.length + 1}`,
          reparto_id: repartoId,
          type,
          message,
          actor,
          meta: typeof metaJson === "string" ? JSON.parse(metaJson) : metaJson,
          at: new Date().toISOString(),
        });
        return { rows: [] };
      }

      if (
        norm.includes("from repartos where id = $1 or reparto_no = $1") ||
        (norm.includes("from repartos where id = $1") && norm.includes("or reparto_no"))
      ) {
        const key = params[0];
        const row = rows.find((r) => r.id === key || r.reparto_no === key);
        return { rows: row ? [{ ...row, payload: { ...(row.payload || {}) } }] : [] };
      }

      if (norm.startsWith("select id from repartos where id = $1 or reparto_no = $1")) {
        const key = params[0];
        const row = rows.find((r) => r.id === key || r.reparto_no === key);
        return { rows: row ? [{ id: row.id }] : [] };
      }

      if (norm.includes("from reparto_events") && norm.includes("where reparto_id = $1")) {
        const id = params[0];
        return {
          rows: eventRows
            .filter((e) => e.reparto_id === id)
            .slice()
            .sort((a, b) => String(b.at).localeCompare(String(a.at))),
        };
      }

      if (norm.includes("from reparto_documents where reparto_id = $1")) {
        return { rows: [] };
      }

      if (norm.startsWith("update repartos set") && norm.includes("payload = $2::jsonb")) {
        // PUT autosave path (status stays en_coordinacion) OR confirm path
        const id = params[0];
        const row = rows.find((r) => r.id === id);
        if (!row) return { rows: [], rowCount: 0 };
        if (norm.includes("status = 'coordinado'")) {
          row.status = "coordinado";
          row.payload =
            typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
          row.revision = params[2];
          row.confirmed_at = new Date().toISOString();
          if (params[3]) row.drive_folder_url = params[3];
        } else {
          row.payload =
            typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
          if (params[2] != null) row.truck_l = params[2];
          if (params[3] != null) row.transportista = params[3];
          if (params[4] != null) row.patente = params[4];
          if (params[5] != null) row.vehicle_label = params[5];
          row.status = "en_coordinacion";
          row.revision = params[6];
        }
        row.updated_at = new Date().toISOString();
        return { rows: [row], rowCount: 1 };
      }

      if (norm.includes("from repartos") && norm.includes("order by updated_at")) {
        const limit = Number(params[params.length - 1]) || 20;
        let list = rows.slice();
        if (norm.includes("where status = $1")) {
          list = list.filter((r) => r.status === params[0]);
        }
        return {
          rows: list
            .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
            .slice(0, limit)
            .map((r) => ({
              id: r.id,
              reparto_no: r.reparto_no,
              status: r.status,
              delivery_date: r.delivery_date,
              truck_l: r.truck_l,
              transportista: r.transportista,
              patente: r.patente,
              drive_folder_url: r.drive_folder_url,
              confirmed_at: r.confirmed_at,
              created_at: r.created_at,
              updated_at: r.updated_at,
              revision: r.revision,
              stop_count: Array.isArray(r.payload?.stops) ? r.payload.stops.length : 0,
            })),
        };
      }

      throw new Error(`Unexpected repartos SQL: ${norm.slice(0, 160)}`);
    },
    _rows: rows,
    _events: eventRows,
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
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
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
              parsed = { raw: chunks };
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function withServer(deps, handler, configOverrides = {}) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api",
    createRepartosRouter(
      {
        databaseUrl: "postgres://test",
        apiAuthToken: API_TOKEN,
        ...configOverrides,
      },
      silentLogger(),
      deps,
    ),
  );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await handler(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/repartos/health without DB reports db false", async () => {
  await withServer({ pool: null }, async (port) => {
    const res = await request(port, "GET", "/api/repartos/health");
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.module, "repartos");
    assert.equal(res.body?.db, false);
  });
});

test("list/create require API auth — 401 without token", async () => {
  const pool = makeRepartosPool();
  await withServer({ pool }, async (port) => {
    const list = await request(port, "GET", "/api/repartos");
    assert.equal(list.status, 401);
    assert.equal(list.body?.error, "Unauthorized");

    const create = await request(port, "POST", "/api/repartos", {
      body: { deliveryDate: "2026-08-07", payload: { stops: [] } },
    });
    assert.equal(create.status, 401);
  });
});

test("list returns 503 when API_AUTH_TOKEN unset", async () => {
  const pool = makeRepartosPool();
  await withServer({ pool }, async (port) => {
    const res = await request(port, "GET", "/api/repartos", { token: API_TOKEN });
    assert.equal(res.status, 503);
    assert.match(String(res.body?.error || ""), /API_AUTH_TOKEN/);
  }, { apiAuthToken: "" });
});

test("list returns 503 when DATABASE_URL / pool missing", async () => {
  await withServer({ pool: null }, async (port) => {
    const res = await request(port, "GET", "/api/repartos", { token: API_TOKEN });
    assert.equal(res.status, 503);
    assert.match(String(res.body?.error || ""), /DATABASE_URL/);
  });
});

test("POST create allocates next REP-YYYY-MM-DD-NNN and starts en_coordinacion", async () => {
  const pool = makeRepartosPool({
    repartos: [
      {
        id: "existing",
        reparto_no: "REP-2026-08-07-001",
        status: "en_coordinacion",
        delivery_date: "2026-08-07",
        revision: 1,
        payload: { stops: [] },
        updated_at: "2026-08-07T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
    ],
  });
  await withServer({ pool }, async (port) => {
    const res = await request(port, "POST", "/api/repartos", {
      token: API_TOKEN,
      body: {
        id: "r-new",
        deliveryDate: "2026-08-07",
        truckL: 12,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "s1", cliente: "A", orderId: "1", orden: 1 }],
        },
        actor: "tester",
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.reparto?.repartoNo, "REP-2026-08-07-002");
    assert.equal(res.body?.reparto?.status, "en_coordinacion");
    assert.equal(res.body?.reparto?.revision, 1);
    assert.equal(pool._rows.some((r) => r.id === "r-new"), true);
    assert.equal(pool._events.some((e) => e.type === "reparto.created"), true);
  });
});

test("PUT returns 409 conflict when expectedRevision mismatches", async () => {
  const pool = makeRepartosPool({
    repartos: [
      {
        id: "r1",
        reparto_no: "REP-2026-08-07-001",
        status: "en_coordinacion",
        delivery_date: "2026-08-07",
        revision: 3,
        payload: { stops: [{ id: "s1", cliente: "A", orderId: "1" }] },
        updated_at: "2026-08-07T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
    ],
  });
  await withServer({ pool }, async (port) => {
    const res = await request(port, "PUT", "/api/repartos/r1", {
      token: API_TOKEN,
      body: {
        expectedRevision: 2,
        payload: { stops: [{ id: "s1", cliente: "B", orderId: "1" }] },
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body?.error, "conflict");
    assert.equal(res.body?.revision, 3);
  });
});

test("PUT returns 409 immutable after confirm (coordinado)", async () => {
  const pool = makeRepartosPool({
    repartos: [
      {
        id: "r1",
        reparto_no: "REP-2026-08-07-001",
        status: "coordinado",
        delivery_date: "2026-08-07",
        revision: 2,
        payload: { stops: [{ id: "s1", cliente: "A", orderId: "1" }] },
        updated_at: "2026-08-07T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
    ],
  });
  await withServer({ pool }, async (port) => {
    const res = await request(port, "PUT", "/api/repartos/r1", {
      token: API_TOKEN,
      body: {
        expectedRevision: 2,
        payload: { stops: [{ id: "s1", cliente: "B", orderId: "1" }] },
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body?.error, "immutable");
  });
});

test("POST confirm rejects empty stops and invalid transition from cerrado", async () => {
  const pool = makeRepartosPool({
    repartos: [
      {
        id: "empty",
        reparto_no: "REP-2026-08-07-001",
        status: "en_coordinacion",
        delivery_date: "2026-08-07",
        revision: 1,
        payload: { stops: [] },
        updated_at: "2026-08-07T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
      {
        id: "closed",
        reparto_no: "REP-2026-08-07-002",
        status: "cerrado",
        delivery_date: "2026-08-07",
        revision: 2,
        payload: { stops: [{ id: "s1", cliente: "A", orderId: "1" }] },
        updated_at: "2026-08-07T11:00:00.000Z",
        created_at: "2026-08-07T11:00:00.000Z",
      },
    ],
  });
  await withServer({ pool }, async (port) => {
    const noStops = await request(port, "POST", "/api/repartos/empty/confirm", {
      token: API_TOKEN,
      body: { actor: "tester" },
    });
    assert.equal(noStops.status, 400);
    assert.equal(noStops.body?.error, "no_stops");

    // Identity transition coordinado→coordinado is allowed; cerrado→coordinado is not.
    const bad = await request(port, "POST", "/api/repartos/closed/confirm", {
      token: API_TOKEN,
      body: { actor: "tester" },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body?.error, "invalid_transition");
  });
});

test("POST confirm transitions en_coordinacion → coordinado and snapshots drivePlan", async () => {
  const pool = makeRepartosPool({
    repartos: [
      {
        id: "r-ok",
        reparto_no: "REP-2026-08-07-003",
        status: "en_coordinacion",
        delivery_date: "2026-08-07",
        revision: 1,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [
            { id: "s1", cliente: "Alfredo", orderId: "3102022", orden: 1 },
            { id: "s2", cliente: "Luis", orderId: "1344059", orden: 2 },
          ],
        },
        updated_at: "2026-08-07T10:00:00.000Z",
        created_at: "2026-08-07T10:00:00.000Z",
      },
    ],
  });
  await withServer({ pool }, async (port) => {
    const res = await request(port, "POST", "/api/repartos/r-ok/confirm", {
      token: API_TOKEN,
      body: { actor: "ops" },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.reparto?.status, "coordinado");
    assert.equal(res.body?.reparto?.revision, 2);
    assert.equal(res.body?.reparto?.stopsSummary?.length, 2);
    assert.ok(res.body?.reparto?.drivePlan?.path?.includes("REP-2026-08-07-003"));
    assert.equal(pool._rows.find((r) => r.id === "r-ok")?.status, "coordinado");
    assert.equal(
      pool._events.some((e) => e.type === "coordination.confirmed"),
      true,
    );
  });
});

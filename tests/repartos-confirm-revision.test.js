/**
 * Offline: POST /api/repartos/:id/confirm must not stamp a stale client payload
 * as the immutable coordinado snapshot (Bug AU).
 *
 * Gates:
 * - client payload requires expectedRevision
 * - revision mismatch → 409 conflict (no overwrite)
 * - UPDATE WHERE includes status + revision; revision = revision + 1
 */
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import createRepartosRouter from "../server/routes/repartos.js";

const TOKEN = "test-repartos-confirm-revision-token";

function makePool(handlers) {
  return {
    query: async (sql, params) => {
      const s = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      for (const h of handlers) {
        if (h.match(s, params)) return h.run(s, params);
      }
      throw new Error(`unexpected query: ${s.slice(0, 160)}`);
    },
  };
}

async function withServer(pool, handler) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api",
    createRepartosRouter({ databaseUrl: "postgres://mock", apiAuthToken: TOKEN }, console, { pool }),
  );
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await handler(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

let n = 0;
function ok(m) {
  n += 1;
  console.log(`  ✓ ${m}`);
}

const DDL = {
  match: (s) => s.startsWith("create table") || s.includes("create index"),
  run: async () => ({ rows: [], rowCount: 0 }),
};

const ROW_REV2 = {
  id: "r-au",
  reparto_no: "REP-2026-08-07-042",
  status: "en_coordinacion",
  revision: 2,
  delivery_date: "2026-08-07",
  payload: {
    schema: "bmc-reparto-payload-v1",
    stops: [
      { id: "s1", cliente: "Tab B newer", orderId: "111", orden: 1 },
      { id: "s2", cliente: "Extra stop", orderId: "222", orden: 2 },
    ],
  },
  truck_l: 12,
  transportista: null,
  patente: null,
  vehicle_label: null,
  drive_folder_url: null,
};

console.log("repartos-confirm-revision (Bug AU)");

{
  const pool = makePool([
    DDL,
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1") && !s.startsWith("update"),
      run: async () => ({ rows: [ROW_REV2], rowCount: 1 }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r-au/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "stale-tab",
        // Stale payload (missing s2) without expectedRevision — must reject
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "s1", cliente: "Tab A stale", orderId: "111", orden: 1 }],
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, `expected 400, got ${res.status} ${JSON.stringify(body)}`);
    assert.equal(body.error, "expected_revision_required");
  });
  ok("confirm with payload but no expectedRevision → 400");
}

{
  const pool = makePool([
    DDL,
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1") && !s.startsWith("update"),
      run: async () => ({ rows: [ROW_REV2], rowCount: 1 }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r-au/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "stale-tab",
        expectedRevision: 1, // server is at 2
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "s1", cliente: "Tab A stale", orderId: "111", orden: 1 }],
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 409, `expected 409, got ${res.status} ${JSON.stringify(body)}`);
    assert.equal(body.error, "conflict");
    assert.equal(body.revision, 2);
  });
  ok("confirm stale expectedRevision → 409 conflict (no overwrite)");
}

{
  let updateSql = "";
  let updateParams = null;
  const pool = makePool([
    DDL,
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1") && !s.startsWith("update"),
      run: async () => ({ rows: [ROW_REV2], rowCount: 1 }),
    },
    {
      match: (s) => s.startsWith("update repartos set"),
      run: async (s, params) => {
        updateSql = s;
        updateParams = params;
        return {
          rows: [{ id: "r-au", revision: 3, confirmed_at: new Date() }],
          rowCount: 1,
        };
      },
    },
    {
      match: (s) => s.startsWith("insert into reparto_events"),
      run: async () => ({ rows: [], rowCount: 1 }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r-au/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "fresh-tab",
        expectedRevision: 2,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: ROW_REV2.payload.stops,
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, `expected 200, got ${res.status} ${JSON.stringify(body)}`);
    assert.equal(body.ok, true);
    assert.equal(body.reparto.status, "coordinado");
    assert.match(updateSql, /status = 'coordinado'/);
    assert.match(updateSql, /revision = revision \+ 1/);
    assert.ok(
      updateSql.includes("and status = 'en_coordinacion'"),
      "UPDATE must gate on status atomically",
    );
    assert.ok(updateSql.includes("and revision = $"), "UPDATE must gate on expectedRevision");
    assert.equal(updateParams?.[3], 2, "expectedRevision bound as $4");
  });
  ok("confirm matching revision → 200 + atomic WHERE status+revision");
}

{
  let updateSql = "";
  const pool = makePool([
    DDL,
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1") && !s.startsWith("update"),
      run: async () => ({ rows: [ROW_REV2], rowCount: 1 }),
    },
    {
      match: (s) => s.startsWith("update repartos set"),
      run: async (s) => {
        updateSql = s;
        // Concurrent PUT bumped revision after SELECT — atomic WHERE loses
        return { rows: [], rowCount: 0 };
      },
    },
    {
      match: (s) => s.includes("select status, revision from repartos where id = $1"),
      run: async () => ({
        rows: [{ status: "en_coordinacion", revision: 3 }],
        rowCount: 1,
      }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r-au/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: "race-tab",
        expectedRevision: 2,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "s1", cliente: "Stale mid-flight", orderId: "111", orden: 1 }],
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 409, `expected 409, got ${res.status} ${JSON.stringify(body)}`);
    assert.equal(body.error, "conflict");
    assert.ok(updateSql.includes("and revision = $"), "lost race still used revision gate");
  });
  ok("confirm loses mid-flight revision race → 409 conflict");
}

console.log(`\nrepartos-confirm-revision: ${n} passed`);

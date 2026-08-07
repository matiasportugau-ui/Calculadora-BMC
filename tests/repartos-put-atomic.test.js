/**
 * Offline: PUT /api/repartos/:id must not overwrite a confirmed snapshot (TOCTOU vs confirm).
 * Simulates SELECT seeing en_coordinacion then UPDATE matching 0 rows (confirm won the race).
 */
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import createRepartosRouter from "../server/routes/repartos.js";

const TOKEN = "test-repartos-put-atomic-token";

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

console.log("repartos-put-atomic");

{
  let updateSql = "";
  const pool = makePool([
    {
      match: (s) => s.startsWith("create table") || s.includes("create index"),
      run: async () => ({ rows: [], rowCount: 0 }),
    },
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1") && !s.startsWith("update"),
      run: async () => ({
        rows: [
          {
            id: "r1",
            reparto_no: "REP-2026-08-07-001",
            status: "en_coordinacion",
            revision: 2,
            payload: { stops: [{ id: "s1", cliente: "A" }] },
            truck_l: 12,
            transportista: null,
            patente: null,
            vehicle_label: null,
          },
        ],
        rowCount: 1,
      }),
    },
    {
      match: (s) => s.startsWith("update repartos set"),
      run: async (s) => {
        updateSql = s;
        // Confirm won the race: status no longer en_coordinacion → 0 rows
        return { rows: [], rowCount: 0 };
      },
    },
    {
      match: (s) => s.includes("select status, revision from repartos where id = $1"),
      run: async () => ({
        rows: [{ status: "coordinado", revision: 3 }],
        rowCount: 1,
      }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r1`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expectedRevision: 2,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "sX", cliente: "OVERWRITE", orden: 1 }],
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 409, `expected 409, got ${res.status} ${JSON.stringify(body)}`);
    assert.equal(body.error, "immutable");
    assert.match(updateSql, /status = 'en_coordinacion'/);
    assert.match(updateSql, /revision = revision \+ 1/);
    assert.ok(
      updateSql.includes("and status = 'en_coordinacion'"),
      "UPDATE must gate on status atomically",
    );
    assert.ok(updateSql.includes("and revision = $"), "UPDATE must gate on expectedRevision");
  });
  ok("PUT loses to concurrent confirm → 409 immutable (atomic WHERE)");
}

{
  const pool = makePool([
    {
      match: (s) => s.startsWith("create table") || s.includes("create index"),
      run: async () => ({ rows: [], rowCount: 0 }),
    },
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1"),
      run: async () => ({
        rows: [
          {
            id: "r2",
            reparto_no: "REP-2026-08-07-002",
            status: "coordinado",
            revision: 5,
            payload: { stops: [{ id: "s1", cliente: "Frozen" }], confirmedAt: "2026-08-07T12:00:00.000Z" },
            truck_l: 12,
            transportista: null,
            patente: null,
            vehicle_label: null,
          },
        ],
        rowCount: 1,
      }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r2`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: { stops: [{ id: "sX", cliente: "HACK" }] },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.error, "immutable");
    assert.equal(body.status, "coordinado");
  });
  ok("PUT after confirm (sequential) → 409 immutable");
}

{
  const pool = makePool([
    {
      match: (s) => s.startsWith("create table") || s.includes("create index"),
      run: async () => ({ rows: [], rowCount: 0 }),
    },
    {
      match: (s) => s.includes("from repartos where id = $1 or reparto_no = $1"),
      run: async () => ({
        rows: [
          {
            id: "r3",
            reparto_no: "REP-2026-08-07-003",
            status: "en_curso",
            revision: 4,
            payload: { stops: [{ id: "s1", cliente: "On road" }] },
            truck_l: 12,
            transportista: null,
            patente: null,
            vehicle_label: null,
          },
        ],
        rowCount: 1,
      }),
    },
  ]);

  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/repartos/r3`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: { stops: [{ id: "sX", cliente: "REOPEN" }] },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 409, `en_curso must be immutable to PUT, got ${res.status}`);
    assert.equal(body.error, "immutable");
    assert.equal(body.status, "en_curso");
  });
  ok("PUT cannot mutate/reopen en_curso → 409");
}

console.log(`\nrepartos-put-atomic: ${n} passed`);

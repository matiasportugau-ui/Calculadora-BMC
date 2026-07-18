import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import createBancoRouter from "../server/routes/banco.js";

const JWT_SECRET = "banco-cash-flow-test-secret-at-least-32-characters";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createAuthPool() {
  return {
    async query(sql) {
      if (sql.includes("from identity.users")) {
        return {
          rows: [{
            user_id: USER_ID,
            email: "finanzas@example.com",
            name: "Finanzas Test",
            picture_url: null,
            avatar_preset: null,
            plan_tier: "base",
            status: "active",
            jwt_revoked_at: null,
          }],
        };
      }
      if (sql.includes("from identity.role_grants")) {
        return { rows: [{ role: "superadmin" }] };
      }
      if (sql.includes("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected auth SQL: ${sql}`);
    },
  };
}

function accessToken() {
  return jwt.sign(
    { sub: USER_ID, sid: "cash-flow-test-session" },
    JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
      expiresIn: "5m",
    },
  );
}

function requestJson(port, path, token = accessToken()) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: chunks ? JSON.parse(chunks) : null,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function withBancoApp(pool, run) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({ pool: createAuthPool(), logger: { warn() {}, error() {} } });

  const app = express();
  app.use(createBancoRouter({ databaseUrl: "" }, console, { pool }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuthTest.reset();
    if (oldIdentitySecret === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = oldIdentitySecret;
    if (oldWaSecret === undefined) delete process.env.WA_JWT_SECRET;
    else process.env.WA_JWT_SECRET = oldWaSecret;
  }
}

test("cash-flow rejects anonymous access before querying Banco", async () => {
  let bancoQueries = 0;
  const pool = {
    async query() {
      bancoQueries += 1;
      throw new Error("Banco must not be queried");
    },
  };

  await withBancoApp(pool, async (port) => {
    const response = await requestJson(port, "/api/banco/cash-flow", null);
    assert.equal(response.status, 401);
    assert.equal(response.body?.error, "missing_credentials");
    assert.equal(bancoQueries, 0);
  });
});

test("cash-flow requires one account when filtered data spans currencies", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      assert.match(sql, /select distinct a\.currency/);
      return { rows: [{ currency: "UYU" }, { currency: "USD" }] };
    },
  };

  await withBancoApp(pool, async (port) => {
    const response = await requestJson(port, "/api/banco/cash-flow?from=2026-01-01");
    assert.equal(response.status, 400);
    assert.equal(response.body?.error, "account_id_required");
    assert.match(response.body?.detail, /distintas monedas/);
    assert.equal(calls.length, 1, "aggregates must not run across mixed currencies");
    assert.deepEqual(calls[0].params, ["2026-01-01"]);
  });
});

test("cash-flow applies filters and returns deterministic financial aggregates", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("select currency from banco_accounts")) {
        return { rows: [{ currency: "USD" }] };
      }
      if (sql.includes("as unclassified_count")) {
        return { rows: [{ unclassified_count: 3 }] };
      }
      if (sql.includes("to_char(m.fecha, 'YYYY-MM')")) {
        return {
          rows: [
            { month: "2026-01", inflow: 200.11, outflow: 100, net: 100.11 },
            { month: "2026-02", inflow: 74.9, outflow: 100, net: -25.1 },
          ],
        };
      }
      if (sql.includes("m.categoria as category")) {
        return {
          rows: [
            { category: "ingreso_venta", total: 200.11 },
            { category: null, total: -25.1 },
            { category: "legacy_custom", total: -5 },
          ],
        };
      }
      if (sql.includes("as inflow") && sql.includes("as outflow")) {
        return { rows: [{ inflow: 275.01, outflow: 200, net: 75.01 }] };
      }
      throw new Error(`Unexpected Banco SQL: ${sql}`);
    },
  };

  await withBancoApp(pool, async (port) => {
    const response = await requestJson(
      port,
      `/api/banco/cash-flow?account_id=${ACCOUNT_ID}&from=2026-01-01&to=2026-02-28`,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body?.currency, "USD");
    assert.deepEqual(response.body?.totals, { inflow: 275.01, outflow: 200, net: 75.01 });
    assert.equal(response.body?.unclassified_count, 3);
    assert.deepEqual(
      response.body?.monthly.map(({ month, cumulative }) => ({ month, cumulative })),
      [
        { month: "2026-01", cumulative: 100.11 },
        { month: "2026-02", cumulative: 75.01 },
      ],
    );
    assert.deepEqual(response.body?.by_category, [
      {
        category: "ingreso_venta",
        label: "Ingreso venta",
        total: 200.11,
        kind: "inflow",
      },
      {
        category: null,
        label: "Sin clasificar",
        total: -25.1,
        kind: "unknown",
      },
      {
        category: "legacy_custom",
        label: "legacy_custom",
        total: -5,
        kind: "unknown",
      },
    ]);

    const aggregateCalls = calls.filter(({ sql }) => sql.includes("from banco_movements m"));
    assert.equal(aggregateCalls.length, 4);
    for (const { sql, params } of aggregateCalls) {
      assert.match(sql, /m\.account_id = \$1/);
      assert.match(sql, /m\.fecha >= \$2/);
      assert.match(sql, /m\.fecha <= \$3/);
      assert.deepEqual(params, [ACCOUNT_ID, "2026-01-01", "2026-02-28"]);
    }
  });
});

test("cash-flow rejects invalid shared movement filters before querying Banco", async () => {
  let bancoQueries = 0;
  const pool = {
    async query() {
      bancoQueries += 1;
      throw new Error("Banco must not be queried");
    },
  };

  await withBancoApp(pool, async (port) => {
    const response = await requestJson(port, "/api/banco/cash-flow?entidad=otra");
    assert.equal(response.status, 400);
    assert.equal(response.body?.error, "invalid_entidad");
    assert.equal(bancoQueries, 0);
  });
});

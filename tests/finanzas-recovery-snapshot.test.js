// Recovery snapshot validation + route auth contract
// Run: node --test tests/finanzas-recovery-snapshot.test.js

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import {
  validateRecoveryPayload,
  putRecoverySnapshot,
  getLatestRecoverySnapshot,
} from "../server/lib/finanzasRecoverySnapshot.js";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import createBancoRouter from "../server/routes/banco.js";

const JWT_SECRET = "recovery-snapshot-test-secret-at-least-32-chars";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("validateRecoveryPayload rejects empty", () => {
  assert.equal(validateRecoveryPayload(null).ok, false);
  assert.equal(validateRecoveryPayload({}).error, "kpi_required");
});

test("validateRecoveryPayload accepts viz shape", () => {
  const v = validateRecoveryPayload({
    as_of: "2026-08-06",
    kpi: { cash_uyu: 15194.41, cash_usd: 2321.06, pipeline_usd: 17453.28 },
    sales_monthly: [{ month: "2026-01", usd: 1, uyu: 2 }],
    pipeline: [{ cliente: "A", amount_usd: 10, estado: "listo_hitl" }],
    waterfall_usd: [{ name: "Disponible USD", value: 100 }],
    obligations: [],
    disclaimers: ["x"],
    sources: ["y"],
  });
  assert.equal(v.ok, true);
  assert.equal(v.payload.kpi.cash_uyu, 15194.41);
  assert.equal(v.payload.pipeline.length, 1);
});

function createAuthPool() {
  return {
    async query(sql) {
      if (sql.includes("from identity.users")) {
        return {
          rows: [{
            user_id: USER_ID,
            email: "admin@example.com",
            name: "Admin",
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

/** In-memory pool for recovery snapshot table only. */
function createSnapshotPool() {
  const rows = [];
  let id = 0;
  return {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (s.includes("create table") || s.includes("create index")) {
        return { rows: [] };
      }
      if (s.startsWith("insert into public.finanzas_recovery_snapshots")) {
        id += 1;
        const row = {
          id,
          as_of: params[0],
          payload: typeof params[1] === "string" ? JSON.parse(params[1]) : params[1],
          created_by: params[2],
          created_at: new Date().toISOString(),
        };
        rows.unshift(row);
        return { rows: [row] };
      }
      if (s.includes("from public.finanzas_recovery_snapshots") && s.includes("order by")) {
        return { rows: rows.slice(0, 1) };
      }
      // unlock bypass for superadmin — no session query needed if bypass
      if (s.includes("finanzas_unlocked_until")) {
        return { rows: [{ finanzas_unlocked_until: new Date(Date.now() + 3600e3).toISOString() }] };
      }
      throw new Error(`Unexpected SQL: ${sql.slice(0, 120)}`);
    },
  };
}

function accessToken() {
  return jwt.sign(
    { sub: USER_ID, sid: "recovery-test-session" },
    JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
      expiresIn: "5m",
    },
  );
}

function requestJson(port, method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
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
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => {
          chunks += c;
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
    if (data) req.write(data);
    req.end();
  });
}

test("lib put/get latest snapshot (memory pool)", async () => {
  const pool = createSnapshotPool();
  const v = validateRecoveryPayload({
    as_of: "2026-08-06",
    kpi: { cash_usd: 2321.06, pipeline_usd: 17453.28 },
  });
  assert.equal(v.ok, true);
  await putRecoverySnapshot(pool, v.payload, { createdBy: "test" });
  const latest = await getLatestRecoverySnapshot(pool);
  assert.equal(latest.payload.kpi.cash_usd, 2321.06);
  assert.equal(latest.created_by, "test");
});

test("GET recovery-snapshot without auth → 401", async () => {
  const old = process.env.IDENTITY_JWT_SECRET;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({ pool: createAuthPool(), logger: { warn() {}, error() {} } });

  const app = express();
  app.use(express.json());
  app.use(createBancoRouter({ databaseUrl: "postgres://x", appEnv: "development" }, console, {
    pool: createSnapshotPool(),
  }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const res = await requestJson(server.address().port, "GET", "/api/banco/recovery-snapshot");
    assert.equal(res.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    identityAuthTest.reset();
    if (old === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = old;
  }
});

test("PUT then GET recovery-snapshot with auth", async () => {
  const old = process.env.IDENTITY_JWT_SECRET;
  const oldApp = process.env.APP_ENV;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  process.env.APP_ENV = "development"; // bypass finanzas password gate
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({ pool: createAuthPool(), logger: { warn() {}, error() {} } });

  const pool = createSnapshotPool();
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(createBancoRouter({ databaseUrl: "postgres://x", appEnv: "development" }, console, { pool }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const token = accessToken();

  try {
    const empty = await requestJson(port, "GET", "/api/banco/recovery-snapshot", { token });
    assert.equal(empty.status, 404);

    const bad = await requestJson(port, "PUT", "/api/banco/recovery-snapshot", {
      token,
      body: { foo: 1 },
    });
    assert.equal(bad.status, 400);

    const put = await requestJson(port, "PUT", "/api/banco/recovery-snapshot", {
      token,
      body: {
        snapshot: {
          as_of: "2026-08-06",
          kpi: { cash_uyu: 15194.41, cash_usd: 2321.06, debt_bank_capital: 7482.57, pipeline_usd: 17453.28 },
          sales_monthly: [],
          pipeline: [{ cliente: "Javier Plada", amount_usd: 3185.87, estado: "listo_hitl" }],
          waterfall_usd: [{ name: "Disponible USD", value: 2321.06 }],
          obligations: [],
          disclaimers: ["test"],
          sources: ["fixture"],
        },
      },
    });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.ok, true);
    assert.equal(put.body.snapshot.kpi.cash_usd, 2321.06);

    const get = await requestJson(port, "GET", "/api/banco/recovery-snapshot", { token });
    assert.equal(get.status, 200);
    assert.equal(get.body.snapshot.kpi.debt_bank_capital, 7482.57);
    assert.equal(get.body.snapshot.pipeline[0].cliente, "Javier Plada");
  } finally {
    await new Promise((r) => server.close(r));
    identityAuthTest.reset();
    if (old === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = old;
    if (oldApp === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = oldApp;
  }
});

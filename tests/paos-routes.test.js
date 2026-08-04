/**
 * PAOS admin HTTP routes (#777 G2) — offline auth / flag / RBAC regression.
 * Lib SM + promote suites exist; this locks the Express surface so anonymous
 * callers, disabled flags, and non-superadmin promote paths fail closed.
 *
 * Run: node --test tests/paos-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import { __paosCandidatesTest } from "../server/lib/paosCandidates.js";
import { __paosLedgerTest } from "../server/lib/paosEventLedger.js";
import createPaosRouter from "../server/routes/paos.js";

const JWT_SECRET = "paos-routes-test-secret-at-least-32-chars!!";
const SUPERADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPERATOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createAuthPool({ roleByUser = {} } = {}) {
  return {
    async query(sql, params = []) {
      if (sql.includes("from identity.users")) {
        const id = params[0];
        return {
          rows: [
            {
              user_id: id,
              email: id === SUPERADMIN_ID ? "super@example.com" : "ops@example.com",
              name: "PAOS Tester",
              picture_url: null,
              avatar_preset: null,
              plan_tier: "plus",
              status: "active",
              jwt_revoked_at: null,
            },
          ],
        };
      }
      if (sql.includes("from identity.role_grants")) {
        const id = params[0];
        return { rows: [{ role: roleByUser[id] || "operator" }] };
      }
      if (sql.includes("from identity.module_grants")) {
        return { rows: [] };
      }
      if (sql.includes("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected auth SQL: ${sql}`);
    },
  };
}

function accessToken(userId = SUPERADMIN_ID) {
  return jwt.sign(
    { sub: userId, sid: "paos-route-session" },
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

async function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function withPaosApp({ roleByUser }, run) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({
    pool: createAuthPool({ roleByUser }),
    logger: { warn() {}, error() {}, info() {} },
  });

  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(createPaosRouter({}));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuthTest.reset();
    __paosCandidatesTest.reset();
    __paosLedgerTest.reset();
    if (oldIdentitySecret === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = oldIdentitySecret;
    if (oldWaSecret === undefined) delete process.env.WA_JWT_SECRET;
    else process.env.WA_JWT_SECRET = oldWaSecret;
  }
}

test("GET /api/paos/health is public and reports flags", async () => {
  await withEnv({ PAOS_ENABLED: "0", PAOS_PROMOTE: "0" }, async () => {
    await withPaosApp({ roleByUser: {} }, async (port) => {
      const res = await requestJson(port, "GET", "/api/paos/health");
      assert.equal(res.status, 200);
      assert.equal(res.body?.ok, true);
      assert.equal(res.body?.paos?.enabled, false);
      assert.equal(res.body?.paos?.promote, false);
      assert.ok(res.body?.ledger);
    });
  });
});

test("protected PAOS reads reject anonymous callers", async () => {
  await withEnv({ PAOS_ENABLED: "1" }, async () => {
    await withPaosApp({ roleByUser: {} }, async (port) => {
      for (const path of [
        "/api/paos/flags",
        "/api/paos/events",
        "/api/paos/metrics",
        "/api/paos/candidates",
      ]) {
        const res = await requestJson(port, "GET", path);
        assert.equal(res.status, 401, path);
        assert.equal(res.body?.error, "missing_credentials", path);
      }
    });
  });
});

test("PAOS_ENABLED=0 → events/candidates 503 paos_disabled; create mutator too", async () => {
  await withEnv({ PAOS_ENABLED: "0" }, async () => {
    await withPaosApp(
      { roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
      async (port) => {
        const token = accessToken(SUPERADMIN_ID);
        const events = await requestJson(port, "GET", "/api/paos/events", { token });
        assert.equal(events.status, 503);
        assert.equal(events.body?.error, "paos_disabled");

        const list = await requestJson(port, "GET", "/api/paos/candidates", { token });
        assert.equal(list.status, 503);
        assert.equal(list.body?.error, "paos_disabled");

        const created = await requestJson(port, "POST", "/api/paos/candidates", {
          token,
          body: { delta: { question: "q", goodAnswer: "a" } },
        });
        assert.equal(created.status, 503);
        assert.equal(created.body?.error, "paos_disabled");
      },
    );
  });
});

test("operator can create/evaluate; approve/reject require superadmin", async () => {
  await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "1" }, async () => {
    await withPaosApp(
      {
        roleByUser: {
          [SUPERADMIN_ID]: "superadmin",
          [OPERATOR_ID]: "operator",
        },
      },
      async (port) => {
        const ops = accessToken(OPERATOR_ID);
        const created = await requestJson(port, "POST", "/api/paos/candidates", {
          token: ops,
          body: {
            delta: { question: "m2 techo?", goodAnswer: "usar /calc" },
            source: "api_test",
          },
        });
        assert.equal(created.status, 201);
        assert.equal(created.body?.ok, true);
        const id = created.body?.candidate?.id;
        assert.ok(id);
        assert.equal(created.body?.candidate?.state, "drafted");

        const evaluated = await requestJson(port, "POST", `/api/paos/candidates/${id}/evaluate`, {
          token: ops,
          body: { pass: true, details: { suite: "route" } },
        });
        assert.equal(evaluated.status, 200);
        assert.equal(evaluated.body?.candidate?.state, "pending_approval");

        const forbiddenApprove = await requestJson(
          port,
          "POST",
          `/api/paos/candidates/${id}/approve`,
          { token: ops, body: { mode: "canary" } },
        );
        assert.equal(forbiddenApprove.status, 403);
        assert.equal(forbiddenApprove.body?.error, "superadmin_required");

        const forbiddenReject = await requestJson(
          port,
          "POST",
          `/api/paos/candidates/${id}/reject`,
          { token: ops, body: { reason: "nope" } },
        );
        assert.equal(forbiddenReject.status, 403);

        const approved = await requestJson(port, "POST", `/api/paos/candidates/${id}/approve`, {
          token: accessToken(SUPERADMIN_ID),
          body: { mode: "canary" },
        });
        assert.equal(approved.status, 200);
        assert.equal(approved.body?.candidate?.state, "canary");
      },
    );
  });
});

test("approve with PAOS_PROMOTE=0 → 503 paos_promote_disabled", async () => {
  await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "0" }, async () => {
    await withPaosApp(
      { roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
      async (port) => {
        const token = accessToken(SUPERADMIN_ID);
        const created = await requestJson(port, "POST", "/api/paos/candidates", {
          token,
          body: { delta: { question: "q", goodAnswer: "a" } },
        });
        const id = created.body?.candidate?.id;
        await requestJson(port, "POST", `/api/paos/candidates/${id}/evaluate`, {
          token,
          body: { pass: true },
        });
        const res = await requestJson(port, "POST", `/api/paos/candidates/${id}/approve`, {
          token,
          body: { mode: "canary" },
        });
        assert.equal(res.status, 503);
        assert.equal(res.body?.error, "paos_promote_disabled");
      },
    );
  });
});

test("unknown candidate evaluate/get → 404", async () => {
  await withEnv({ PAOS_ENABLED: "1" }, async () => {
    await withPaosApp(
      { roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
      async (port) => {
        const token = accessToken(SUPERADMIN_ID);
        const get = await requestJson(port, "GET", "/api/paos/candidates/missing-id", {
          token,
        });
        assert.equal(get.status, 404);
        assert.equal(get.body?.error, "not_found");

        const ev = await requestJson(port, "POST", "/api/paos/candidates/missing-id/evaluate", {
          token,
          body: { pass: true },
        });
        assert.equal(ev.status, 404);
      },
    );
  });
});

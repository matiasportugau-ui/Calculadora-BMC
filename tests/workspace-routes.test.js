/**
 * Workspace API (ADR-008 / PR #741) — offline route regression.
 * Covers auth gates, DB-unavailable semantics, input validation, and
 * change-request approve/reject permission + conflict transitions.
 *
 * Run: node --test tests/workspace-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import { isDbConnectionError } from "../server/lib/workspaceDb.js";
import createWorkspaceRouter from "../server/routes/workspace.js";

const JWT_SECRET = "workspace-routes-test-secret-at-least-32-chars";
const SUPERADMIN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATOR_ID = "22222222-2222-4222-8222-222222222222";

function createAuthPool({ roleByUser = {} } = {}) {
  return {
    async query(sql, params = []) {
      if (sql.includes("from identity.users")) {
        const id = params[0];
        const email =
          id === SUPERADMIN_ID ? "super@example.com" : "ops@example.com";
        return {
          rows: [
            {
              user_id: id,
              email,
              name: "Workspace Tester",
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
        const role = roleByUser[id] || "operator";
        return { rows: [{ role }] };
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
    { sub: userId, sid: "workspace-test-session" },
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

async function withWorkspaceApp({ pool, roleByUser, injectPool = true }, run) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({
    pool: createAuthPool({ roleByUser }),
    logger: { warn() {}, error() {}, info() {} },
  });

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  // deps.pool uses ?? — omit the key to force getWorkspacePool(databaseUrl="") → null.
  const deps = injectPool ? { pool } : {};
  app.use(createWorkspaceRouter({ databaseUrl: "" }, { warn() {}, error() {}, info() {} }, deps));

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

test("isDbConnectionError classifies infra codes only", () => {
  assert.equal(isDbConnectionError({ code: "ECONNREFUSED" }), true);
  assert.equal(isDbConnectionError({ code: "08006" }), true);
  assert.equal(isDbConnectionError({ code: "42P01" }), false);
  assert.equal(isDbConnectionError({ code: "23505" }), false);
  assert.equal(isDbConnectionError(null), false);
});

test("health without DATABASE_URL / pool → 503 no_db", async () => {
  await withWorkspaceApp({ injectPool: false, roleByUser: {} }, async (port) => {
    const res = await requestJson(port, "GET", "/api/workspace/health");
    assert.equal(res.status, 503);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "no_db");
  });
});

test("protected routes without pool → 503 before auth", async () => {
  await withWorkspaceApp({ injectPool: false, roleByUser: {} }, async (port) => {
    const state = await requestJson(port, "GET", "/api/workspace/state");
    assert.equal(state.status, 503);
    assert.equal(state.body?.error, "DATABASE_URL not configured");

    const projects = await requestJson(port, "POST", "/api/workspace/projects", {
      body: { name: "X" },
    });
    assert.equal(projects.status, 503);
  });
});

test("protected routes reject anonymous callers before querying workspace tables", async () => {
  let workspaceQueries = 0;
  const pool = {
    async query() {
      workspaceQueries += 1;
      throw new Error("workspace must not be queried for anonymous callers");
    },
  };

  await withWorkspaceApp(
    {
      pool,
      roleByUser: { [SUPERADMIN_ID]: "superadmin" },
    },
    async (port) => {
      const state = await requestJson(port, "GET", "/api/workspace/state", { token: null });
      assert.equal(state.status, 401);
      assert.equal(state.body?.error, "missing_credentials");
      assert.equal(workspaceQueries, 0);

      const telemetry = await requestJson(port, "POST", "/api/workspace/telemetry", {
        token: null,
        body: { label: "x" },
      });
      assert.equal(telemetry.status, 401);
      assert.equal(workspaceQueries, 0);
    },
  );
});

test("health with schema missing → 503 workspace_schema_missing", async () => {
  const pool = {
    async query() {
      const err = new Error("relation missing");
      err.code = "42P01";
      throw err;
    },
  };

  await withWorkspaceApp(
    { pool, roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
    async (port) => {
      const res = await requestJson(port, "GET", "/api/workspace/health");
      assert.equal(res.status, 503);
      assert.equal(res.body?.error, "workspace_schema_missing");
      assert.match(String(res.body?.hint || ""), /workspace:migrate/);
    },
  );
});

test("health ok when workspaces table responds", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("FROM panelin_workspace.workspaces LIMIT 1")) {
        return { rows: [{ id: "ws-1" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  await withWorkspaceApp(
    { pool, roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
    async (port) => {
      const res = await requestJson(port, "GET", "/api/workspace/health");
      assert.equal(res.status, 200);
      assert.equal(res.body?.ok, true);
      assert.equal(res.body?.schema, "panelin_workspace");
    },
  );
});

test("create project / session / telemetry validate required fields", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      throw new Error("validation paths must not hit SQL");
    },
  };

  await withWorkspaceApp(
    { pool, roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
    async (port) => {
      const token = accessToken(SUPERADMIN_ID);

      const noName = await requestJson(port, "POST", "/api/workspace/projects", {
        token,
        body: { name: "   " },
      });
      assert.equal(noName.status, 400);
      assert.equal(noName.body?.error, "name_required");

      const badSession = await requestJson(port, "POST", "/api/workspace/sessions", {
        token,
        body: { title: "Solo título" },
      });
      assert.equal(badSession.status, 400);
      assert.equal(badSession.body?.error, "projectId_and_title_required");

      const noLabel = await requestJson(port, "POST", "/api/workspace/telemetry", {
        token,
        body: { source: "workspace", kind: "fix" },
      });
      assert.equal(noLabel.status, 400);
      assert.equal(noLabel.body?.error, "label_required");

      const badSource = await requestJson(port, "POST", "/api/workspace/telemetry", {
        token,
        body: { label: "ok", source: "slack", kind: "fix" },
      });
      assert.equal(badSource.status, 400);
      assert.equal(badSource.body?.error, "invalid_source");

      const badKind = await requestJson(port, "POST", "/api/workspace/telemetry", {
        token,
        body: { label: "ok", source: "calc", kind: "warn" },
      });
      assert.equal(badKind.status, 400);
      assert.equal(badKind.body?.error, "invalid_kind");

      const patchEmpty = await requestJson(port, "PATCH", "/api/workspace/sessions/s1", {
        token,
        body: {},
      });
      assert.equal(patchEmpty.status, 400);
      assert.equal(patchEmpty.body?.error, "no_fields");

      assert.equal(calls.length, 0, "invalid payloads must fail closed before SQL");
    },
  );
});

test("create project happy path inserts and returns 201", async () => {
  const inserts = [];
  const pool = {
    async query(sql, params = []) {
      if (sql.includes("INSERT INTO panelin_workspace.projects")) {
        inserts.push(params);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  await withWorkspaceApp(
    { pool, roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
    async (port) => {
      const res = await requestJson(port, "POST", "/api/workspace/projects", {
        token: accessToken(SUPERADMIN_ID),
        body: { id: "proj-test", name: "Cotizaciones", workspaceId: "ws-1" },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body?.ok, true);
      assert.equal(res.body?.project?.id, "proj-test");
      assert.equal(res.body?.project?.name, "Cotizaciones");
      assert.deepEqual(inserts[0], ["proj-test", "ws-1", "Cotizaciones", null]);
    },
  );
});

test("change-request approve requires superadmin; reject handles conflicts", async () => {
  const crs = {
    "cr-pending": {
      id: "cr-pending",
      type: "skill",
      title: "Enable tool",
      description: "desc",
      status: "pending",
      workspace_id: "ws-1",
      author_name: "ops",
      diff_text: null,
      diff_json: null,
    },
    "cr-approved": {
      id: "cr-approved",
      type: "skill",
      title: "Already done",
      description: "desc",
      status: "approved",
      workspace_id: "ws-1",
      author_name: "ops",
      diff_text: null,
      diff_json: null,
    },
  };

  const pool = {
    async query(sql, params = []) {
      if (sql.includes("FROM panelin_workspace.change_requests WHERE id")) {
        const row = crs[params[0]];
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("UPDATE panelin_workspace.change_requests")) {
        const id = params[0];
        if (crs[id]) {
          crs[id] = {
            ...crs[id],
            status: sql.includes("'rejected'") ? "rejected" : "approved",
            reviewer_id: params[1],
          };
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO panelin_workspace.telemetry_events")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  await withWorkspaceApp(
    {
      pool,
      roleByUser: {
        [SUPERADMIN_ID]: "superadmin",
        [OPERATOR_ID]: "operator",
      },
    },
    async (port) => {
      const forbidden = await requestJson(
        port,
        "POST",
        "/api/workspace/change-requests/cr-pending/approve",
        { token: accessToken(OPERATOR_ID) },
      );
      assert.equal(forbidden.status, 403);

      const rejectApproved = await requestJson(
        port,
        "POST",
        "/api/workspace/change-requests/cr-approved/reject",
        { token: accessToken(SUPERADMIN_ID) },
      );
      assert.equal(rejectApproved.status, 409);
      assert.equal(rejectApproved.body?.error, "already_approved");

      const rejected = await requestJson(
        port,
        "POST",
        "/api/workspace/change-requests/cr-pending/reject",
        { token: accessToken(SUPERADMIN_ID) },
      );
      assert.equal(rejected.status, 200);
      assert.equal(rejected.body?.status, "rejected");
      assert.equal(crs["cr-pending"].status, "rejected");

      const approveRejected = await requestJson(
        port,
        "POST",
        "/api/workspace/change-requests/cr-pending/approve",
        { token: accessToken(SUPERADMIN_ID) },
      );
      assert.equal(approveRejected.status, 409);
      assert.equal(approveRejected.body?.error, "already_rejected");
    },
  );
});

test("db connection errors on state → 503 db_unreachable", async () => {
  const pool = {
    async query() {
      const err = new Error("connect ECONNREFUSED");
      err.code = "ECONNREFUSED";
      throw err;
    },
  };

  await withWorkspaceApp(
    { pool, roleByUser: { [SUPERADMIN_ID]: "superadmin" } },
    async (port) => {
      const res = await requestJson(port, "GET", "/api/workspace/state", {
        token: accessToken(SUPERADMIN_ID),
      });
      assert.equal(res.status, 503);
      assert.equal(res.body?.error, "db_unreachable");
    },
  );
});

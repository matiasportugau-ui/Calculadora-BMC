/**
 * Workspace API authorization gate.
 *
 * Regression: bare requireUser() accepted any self-registered comprador JWT
 * for shared customers/quotes/chat sessions. Routes must require module
 * grant `workspace` (operator+ via role defaults; comprador denied).
 *
 * Run: node --test tests/workspaceAuthGate.test.js
 */
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";

if (!process.env.IDENTITY_JWT_SECRET || process.env.IDENTITY_JWT_SECRET.length < 32) {
  process.env.IDENTITY_JWT_SECRET = "test_workspace_auth_gate_secret_32chars_x";
}
process.env.APP_ENV = "test";
if (process.env.WA_JWT_SECRET === process.env.IDENTITY_JWT_SECRET) {
  process.env.WA_JWT_SECRET = "wa_test_secret_different_from_identity_yy";
}

const identityAuth = await import("../server/lib/identityAuth.js");
const createWorkspaceRouter = (await import("../server/routes/workspace.js")).default;

const JWT_ISSUER = "bmc-identity";
const JWT_AUDIENCE = "bmc-identity-api";

function makeIdentityShim(userId, role) {
  const user = {
    user_id: userId,
    email: `${userId}@example.com`,
    name: `WS Auth ${role}`,
    picture_url: null,
    avatar_preset: null,
    plan_tier: "plus",
    status: "active",
    jwt_revoked_at: null,
  };
  return {
    async query(sql, params = []) {
      const norm = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (
        norm.startsWith(
          "select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at",
        )
      ) {
        return { rows: params[0] === userId ? [user] : [] };
      }
      if (norm.startsWith("select role from identity.role_grants")) {
        return { rows: params[0] === userId ? [{ role }] : [] };
      }
      if (norm.startsWith("select module, level from identity.module_grants")) {
        // No explicit grants — rely on role defaults only.
        return { rows: [] };
      }
      if (norm.startsWith("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

/** Minimal pool so requireDb passes; auth must fail before real queries matter. */
function makeFakePool() {
  return {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };
}

function signAccessToken(userId) {
  return jwt.sign(
    { sub: userId, sid: `sess-${userId}` },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    },
  );
}

function requestJson(port, method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const req = http.request(
      { host: "127.0.0.1", port, method, path, headers },
      (res) => {
        let chunks = "";
        res.on("data", (d) => {
          chunks += d;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = { raw: chunks };
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

async function withApp(role, fn) {
  const userId = `u-ws-auth-${role}`;
  identityAuth.__test__.reset();
  identityAuth.initIdentityAuth({
    pool: makeIdentityShim(userId, role),
    logger: { warn() {}, error() {}, info() {} },
  });
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createWorkspaceRouter(
      { databaseUrl: "postgres://fake" },
      { warn() {}, error() {}, info() {} },
      { pool: makeFakePool() },
    ),
  );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    await fn({ port, token: signAccessToken(userId), userId });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuth.__test__.reset();
  }
}

describe("workspace API module grant gate", () => {
  it("POST /customers without auth → 401", async () => {
    await withApp("operator", async ({ port }) => {
      const res = await requestJson(port, "POST", "/api/workspace/customers", {
        body: { name: "No Auth" },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body?.ok, false);
    });
  });

  it("comprador JWT cannot POST customers (403)", async () => {
    await withApp("comprador", async ({ port, token }) => {
      const res = await requestJson(port, "POST", "/api/workspace/customers", {
        token,
        body: { name: "Injected by comprador", workspaceId: "ws-1" },
      });
      assert.equal(res.status, 403, JSON.stringify(res.body));
      assert.equal(res.body?.ok, false);
      assert.match(
        String(res.body?.error || ""),
        /forbidden|insufficient_module_grant/,
      );
    });
  });

  it("comprador JWT cannot GET /state (403)", async () => {
    await withApp("comprador", async ({ port, token }) => {
      const res = await requestJson(port, "GET", "/api/workspace/state", {
        token,
      });
      assert.equal(res.status, 403, JSON.stringify(res.body));
      assert.equal(res.body?.ok, false);
    });
  });

  it("operator JWT passes workspace write gate (not 401/403)", async () => {
    await withApp("operator", async ({ port, token }) => {
      const res = await requestJson(port, "POST", "/api/workspace/customers", {
        token,
        body: { name: "Operator OK", workspaceId: "ws-1" },
      });
      // Fake pool may yield 500/201 depending on store SQL — auth must not block.
      assert.notEqual(res.status, 401, JSON.stringify(res.body));
      assert.notEqual(res.status, 403, JSON.stringify(res.body));
    });
  });
});

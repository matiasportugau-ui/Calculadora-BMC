// Contract tests for server/middleware/requireGrant.js
// Run: node --test tests/requireGrant.test.js

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

const SECRET = "require_grant_test_secret_32_chars_minimum";

process.env.IDENTITY_JWT_SECRET = SECRET;
process.env.WA_JWT_SECRET = "different_wa_secret_32_chars_minimum";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

const { initIdentityAuth, __test__ } = await import("../server/lib/identityAuth.js");
const { requireGrant } = await import("../server/middleware/requireGrant.js");

function makePool() {
  const tables = {
    users: [],
    role_grants: [],
    module_grants: [],
    lastActiveTouches: [],
  };

  return {
    _tables: tables,
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
        const [userId] = params;
        return { rows: tables.users.filter((u) => u.user_id === userId) };
      }

      if (norm.startsWith("select role from identity.role_grants")) {
        const [userId] = params;
        return { rows: tables.role_grants.filter((r) => r.user_id === userId) };
      }

      if (norm.startsWith("select module, level from identity.module_grants")) {
        const [userId] = params;
        return { rows: tables.module_grants.filter((r) => r.user_id === userId) };
      }

      if (norm.startsWith("update identity.users set last_active_at = now()")) {
        tables.lastActiveTouches.push(params[0]);
        return { rows: [] };
      }

      throw new Error(`unhandled SQL in requireGrant test: ${norm.slice(0, 120)}`);
    },
  };
}

function seedUser(pool, {
  userId,
  email = `${userId}@example.com`,
  role = "comprador",
  grants = [],
}) {
  pool._tables.users.push({
    user_id: userId,
    email,
    name: userId,
    picture_url: null,
    avatar_preset: null,
    plan_tier: "base",
    status: "active",
    jwt_revoked_at: null,
  });
  pool._tables.role_grants.push({ user_id: userId, role });
  for (const grant of grants) {
    pool._tables.module_grants.push({ user_id: userId, ...grant });
  }
}

function signAccessToken(userId) {
  return jwt.sign(
    { sub: userId, sid: `sess-${userId}`, subject_type: "user" },
    SECRET,
    {
      algorithm: "HS256",
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
      expiresIn: "15m",
    },
  );
}

function makeReqRes({ token } = {}) {
  const req = {
    user: undefined,
    get(headerName) {
      if (String(headerName || "").toLowerCase() !== "authorization") return "";
      return token ? `Bearer ${token}` : "";
    },
  };
  const res = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return { req, res };
}

async function runMiddleware(mw, req, res) {
  let nextCalled = false;
  await mw(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled };
}

describe("requireGrant middleware wrapper", () => {
  let pool;

  beforeEach(() => {
    __test__.reset();
    process.env.IDENTITY_JWT_SECRET = SECRET;
    process.env.WA_JWT_SECRET = "different_wa_secret_32_chars_minimum";
    pool = makePool();
    initIdentityAuth({ pool, logger: { warn: () => {}, error: () => {}, info: () => {} } });
  });

  it("validates module and level at construction time", () => {
    assert.throws(() => requireGrant(), /module is required/);
    assert.throws(() => requireGrant("clientes", "owner"), /minLevel must be one of/);
  });

  it("forwards optional auth so anonymous read probes can pass through deliberately", async () => {
    const mw = requireGrant.read("clientes", { optional: true });
    const { req, res } = makeReqRes();
    const { nextCalled } = await runMiddleware(mw, req, res);

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 0);
    assert.equal(req.user, undefined);
  });

  it("requires credentials by default", async () => {
    const mw = requireGrant("clientes");
    const { req, res } = makeReqRes();
    const { nextCalled } = await runMiddleware(mw, req, res);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "missing_credentials");
  });

  it("honors default/read/write/admin grant thresholds for a module", async () => {
    seedUser(pool, {
      userId: "user-write-clientes",
      grants: [{ module: "clientes", level: "write" }],
    });
    const token = signAccessToken("user-write-clientes");

    for (const mw of [
      requireGrant("clientes"),
      requireGrant.read("clientes"),
      requireGrant.write("clientes"),
    ]) {
      const { req, res } = makeReqRes({ token });
      const { nextCalled } = await runMiddleware(mw, req, res);
      assert.equal(nextCalled, true);
      assert.equal(res.statusCode, 0);
      assert.equal(req.user.id, "user-write-clientes");
    }

    const denied = makeReqRes({ token });
    const { nextCalled } = await runMiddleware(requireGrant.admin("clientes"), denied.req, denied.res);
    assert.equal(nextCalled, false);
    assert.equal(denied.res.statusCode, 403);
    assert.equal(denied.res.body.error, "insufficient_module_grant");
    assert.deepEqual(denied.res.body.required, { module: "clientes", minLevel: "admin" });
    assert.deepEqual(denied.res.body.have, { module: "clientes", level: "write" });
  });

  it("keeps identityAuth superadmin bypass intact for module admin gates", async () => {
    seedUser(pool, { userId: "user-super", role: "superadmin", grants: [] });
    const token = signAccessToken("user-super");
    const { req, res } = makeReqRes({ token });
    const { nextCalled } = await runMiddleware(requireGrant.admin("clientes"), req, res);

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 0);
    assert.equal(req.user.role, "superadmin");
  });
});

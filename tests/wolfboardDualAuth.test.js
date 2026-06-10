// S5 Phase B PR2 — wolfboard accepts static token OR identity JWT (admin+).

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const { requireWolfboardRead } = await import("../server/middleware/requireWolfboardAuth.js");

function makeShim() {
  const tables = {
    users: [
      {
        user_id: "u-admin",
        email: "admin@x.com",
        name: "Admin",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
      },
      {
        user_id: "u-op",
        email: "op@x.com",
        name: "Op",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
      },
    ],
    role_grants: [
      { user_id: "u-admin", role: "admin" },
      { user_id: "u-op", role: "operator" },
    ],
    module_grants: [],
    sessions: [],
    audit_log: [],
  };

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      norm.startsWith(
        "select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at",
      )
    ) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select module, level from identity.module_grants")) {
      return { rows: tables.module_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("update identity.users set last_active_at = now()")) {
      return { rows: [] };
    }
    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }

  return { query };
}

function bearerFor(userId) {
  const t = jwt.sign(
    { sub: userId, sid: "sess-test", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 60 * 15,
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  );
  return `Bearer ${t}`;
}

let server;
let port;

before(async () => {
  const app = express();
  app.get("/wolfboard/read", requireWolfboardRead, (req, res) => {
    res.json({ ok: true, role: req.user?.role });
  });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  identityAuth.__test__.reset();
  identityAuth.initIdentityAuth({
    pool: makeShim(),
    logger: { warn() {}, error() {}, info() {} },
  });
});

describe("requireWolfboardRead", () => {
  it("accepts static API_AUTH_TOKEN", async () => {
    const r = await fetch(`http://127.0.0.1:${port}/wolfboard/read`, {
      headers: { Authorization: "Bearer static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
  });

  it("accepts admin JWT", async () => {
    const r = await fetch(`http://127.0.0.1:${port}/wolfboard/read`, {
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 200);
  });

  it("403 for operator JWT (insufficient role)", async () => {
    const r = await fetch(`http://127.0.0.1:${port}/wolfboard/read`, {
      headers: { Authorization: bearerFor("u-op") },
    });
    assert.equal(r.status, 403);
  });
});
// PR #309 regression: identity `operator` has wa:write by default, but WA
// tenant-management routes must remain admin-only.

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const createWaRouter = (await import("../server/routes/wa.js")).default;

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
        name: "Operator",
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
  app.use(express.json());
  app.use(
    "/api",
    createWaRouter(
      { apiAuthToken: process.env.API_AUTH_TOKEN, databaseUrl: "" },
      { warn() {}, error() {}, info() {} },
    ),
  );
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

function url(path) {
  return `http://127.0.0.1:${port}${path}`;
}

describe("WA identity auth admin boundary", () => {
  it("forbids identity operator JWT on WA settings management", async () => {
    const r = await fetch(url("/api/wa/settings"), {
      method: "PATCH",
      headers: {
        Authorization: bearerFor("u-op"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key: "outbound.ratePerMinPerOperator", value: 99 }),
    });
    assert.equal(r.status, 403);
  });

  it("allows identity admin JWT past auth on WA settings management", async () => {
    const r = await fetch(url("/api/wa/settings"), {
      method: "PATCH",
      headers: {
        Authorization: bearerFor("u-admin"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key: "outbound.ratePerMinPerOperator", value: 99 }),
    });
    assert.equal(r.status, 503);
    const j = await r.json();
    assert.equal(j.error, "DATABASE_URL not configured");
  });

  it("still allows identity operator JWT past auth on regular WA writes", async () => {
    const r = await fetch(url("/api/wa/outbound"), {
      method: "POST",
      headers: {
        Authorization: bearerFor("u-op"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: "chat-1", text: "Hola", kind: "paste_back" }),
    });
    assert.equal(r.status, 503);
    const j = await r.json();
    assert.equal(j.error, "DATABASE_URL not configured");
  });
});

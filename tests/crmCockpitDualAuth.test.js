// S5 Phase B PR1 — CRM cockpit accepts static token OR identity JWT (canales).

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const {
  requireCrmCockpitRead,
  requireCrmCockpitWrite,
} = await import("../server/middleware/requireCrmCockpitAuth.js");

function makeShim() {
  const tables = {
    users: [
      {
        user_id: "u-reader",
        email: "reader@x.com",
        name: "Reader",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
      },
      {
        user_id: "u-writer",
        email: "writer@x.com",
        name: "Writer",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
      },
      {
        user_id: "u-none",
        email: "none@x.com",
        name: "None",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "base",
        status: "active",
        jwt_revoked_at: null,
      },
    ],
    role_grants: [
      { user_id: "u-reader", role: "operator" },
      { user_id: "u-writer", role: "operator" },
      { user_id: "u-none", role: "comprador" },
    ],
    module_grants: [
      { user_id: "u-reader", module: "canales", level: "read" },
      { user_id: "u-writer", module: "canales", level: "write" },
    ],
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
  app.get("/cockpit/read", requireCrmCockpitRead, (req, res) => {
    res.json({ ok: true, principal: req.user?.role || req.user?.id });
  });
  app.post("/cockpit/write", requireCrmCockpitWrite, (req, res) => {
    res.json({ ok: true, principal: req.user?.role || req.user?.id });
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

function url(p) {
  return `http://127.0.0.1:${port}${p}`;
}

describe("requireCrmCockpitRead", () => {
  it("accepts static API_AUTH_TOKEN", async () => {
    const r = await fetch(url("/cockpit/read"), {
      headers: { Authorization: "Bearer static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.principal, "service");
  });

  it("accepts JWT with canales:read", async () => {
    const r = await fetch(url("/cockpit/read"), {
      headers: { Authorization: bearerFor("u-reader") },
    });
    assert.equal(r.status, 200);
  });

  it("accepts JWT with canales:write on read route", async () => {
    const r = await fetch(url("/cockpit/read"), {
      headers: { Authorization: bearerFor("u-writer") },
    });
    assert.equal(r.status, 200);
  });

  it("403 when JWT lacks canales grant", async () => {
    const r = await fetch(url("/cockpit/read"), {
      headers: { Authorization: bearerFor("u-none") },
    });
    assert.equal(r.status, 403);
  });

  it("401 without credentials", async () => {
    const r = await fetch(url("/cockpit/read"));
    assert.equal(r.status, 401);
  });

  it("rejects query-string key (security)", async () => {
    const r = await fetch(url("/cockpit/read?key=static_service_token_xyz"));
    assert.equal(r.status, 401);
  });
});

describe("requireCrmCockpitWrite", () => {
  it("accepts static API_AUTH_TOKEN", async () => {
    const r = await fetch(url("/cockpit/write"), {
      method: "POST",
      headers: { Authorization: "Bearer static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
  });

  it("accepts JWT with canales:write", async () => {
    const r = await fetch(url("/cockpit/write"), {
      method: "POST",
      headers: { Authorization: bearerFor("u-writer") },
    });
    assert.equal(r.status, 200);
  });

  it("403 when JWT has only canales:read", async () => {
    const r = await fetch(url("/cockpit/write"), {
      method: "POST",
      headers: { Authorization: bearerFor("u-reader") },
    });
    assert.equal(r.status, 403);
  });

  it("401 without credentials", async () => {
    const r = await fetch(url("/cockpit/write"), { method: "POST" });
    assert.equal(r.status, 401);
  });
});
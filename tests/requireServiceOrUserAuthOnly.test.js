// PR1 — requireServiceOrUser({ authOnly: true }): closes anonymous exposure on
// /crm/suggest-response WITHOUT 403-ing operator cohorts that lack a specific
// module grant. Accepts static token OR any active identity JWT; rejects anon.

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const { requireServiceOrUser } = await import("../server/middleware/requireServiceOrUser.js");

function makeShim() {
  const tables = {
    users: [
      // A comprador with NO module grants — the cohort a module-scoped guard
      // would 403. authOnly must accept them.
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
      // A disabled user must still be rejected (not merely "any signed JWT").
      {
        user_id: "u-disabled",
        email: "disabled@x.com",
        name: "Disabled",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "base",
        status: "disabled",
        jwt_revoked_at: null,
      },
    ],
    role_grants: [
      { user_id: "u-none", role: "comprador" },
      { user_id: "u-disabled", role: "comprador" },
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
    { algorithm: "HS256", expiresIn: 60 * 15, issuer: "bmc-identity", audience: "bmc-identity-api" },
  );
  return `Bearer ${t}`;
}

let server;
let port;

before(async () => {
  const app = express();
  app.post("/ai/generate", requireServiceOrUser({ authOnly: true }), (req, res) => {
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

const url = (p) => `http://127.0.0.1:${port}${p}`;

describe("requireServiceOrUser({ authOnly: true })", () => {
  it("accepts the static API_AUTH_TOKEN via Bearer", async () => {
    const r = await fetch(url("/ai/generate"), {
      method: "POST",
      headers: { Authorization: "Bearer static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).principal, "service");
  });

  it("accepts the static API_AUTH_TOKEN via x-api-key (smoke uses this)", async () => {
    const r = await fetch(url("/ai/generate"), {
      method: "POST",
      headers: { "x-api-key": "static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
  });

  it("accepts ANY active user JWT even with no module grant (no false 403)", async () => {
    const r = await fetch(url("/ai/generate"), {
      method: "POST",
      headers: { Authorization: bearerFor("u-none") },
    });
    assert.equal(r.status, 200);
  });

  it("rejects a disabled user's JWT", async () => {
    const r = await fetch(url("/ai/generate"), {
      method: "POST",
      headers: { Authorization: bearerFor("u-disabled") },
    });
    assert.equal(r.status, 401);
  });

  it("rejects anonymous (the closed hole)", async () => {
    const r = await fetch(url("/ai/generate"), { method: "POST" });
    assert.equal(r.status, 401);
  });

  it("rejects a query-string key (no ?key= auth surface)", async () => {
    const r = await fetch(url("/ai/generate?key=static_service_token_xyz"), { method: "POST" });
    assert.equal(r.status, 401);
  });
});

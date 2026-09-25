/**
 * Pin: POST /api/internal/omni/ai/run is service-token-only.
 * Identity JWTs (even canales:write / admin) must not force-run AI jobs or
 * wa_crm_sync CRM writes. SoT: docs/transformation/09-security-model.md.
 *
 * Run: node tests/omniInternalAiRunAuth.test.js
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "omni-ai-run-service-token";
process.env.DATABASE_URL = ""; // force omni DB unavailable after auth

const identityAuth = await import("../server/lib/identityAuth.js");
const { requireServiceOrUser } = await import("../server/middleware/requireServiceOrUser.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const omniSrc = fs.readFileSync(path.join(__dirname, "../server/routes/omni.js"), "utf8");

// Source contract: route must not opt into module-scoped user JWTs.
assert.match(
  omniSrc,
  /\/internal\/omni\/ai\/run[\s\S]{0,240}?requireServiceOrUser\(\)/,
  "ai/run must call requireServiceOrUser() with no JWT module opts",
);
assert.doesNotMatch(
  omniSrc,
  /\/internal\/omni\/ai\/run[\s\S]{0,240}?requireServiceOrUser\(\{\s*module:\s*["']canales["']/,
  "ai/run must not accept canales JWT grants",
);

function makeShim() {
  const tables = {
    users: [
      {
        user_id: "u-canales-write",
        email: "ops@x.com",
        name: "Ops",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
      },
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
    ],
    role_grants: [
      { user_id: "u-canales-write", role: "operador" },
      { user_id: "u-admin", role: "admin" },
    ],
    module_grants: [
      { user_id: "u-canales-write", module: "canales", level: "write" },
      { user_id: "u-admin", module: "canales", level: "admin" },
    ],
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
  return jwt.sign(
    { sub: userId, sid: "sess-omni-ai", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    { algorithm: "HS256", expiresIn: 60 * 15, issuer: "bmc-identity", audience: "bmc-identity-api" },
  );
}

/** Mirror the fixed gate: service-token-only (no module opts). */
function mountProbe() {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/internal/omni/ai/run",
    requireServiceOrUser(),
    (_req, res) => res.json({ ok: true, gated: "service" }),
  );
  return app;
}

async function request(app, { method = "POST", path = "/api/internal/omni/ai/run", headers = {}, body } = {}) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body !== undefined ? JSON.stringify(body) : JSON.stringify({ job_type: "classify" }),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe("POST /internal/omni/ai/run auth (service token only)", () => {
  let app;

  before(() => {
    app = mountProbe();
  });

  beforeEach(() => {
    identityAuth.__test__.reset();
    identityAuth.initIdentityAuth({
      pool: makeShim(),
      logger: { warn() {}, error() {}, info() {} },
    });
  });

  it("rejects anonymous callers", async () => {
    const r = await request(app, {});
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "service_token_required");
  });

  it("rejects canales:write identity JWT (former bypass)", async () => {
    const r = await request(app, {
      headers: { authorization: `Bearer ${bearerFor("u-canales-write")}` },
    });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "service_token_required");
  });

  it("rejects admin identity JWT", async () => {
    const r = await request(app, {
      headers: { authorization: `Bearer ${bearerFor("u-admin")}` },
    });
    assert.equal(r.status, 401);
    assert.equal(r.json.error, "service_token_required");
  });

  it("accepts static API_AUTH_TOKEN via Bearer", async () => {
    const r = await request(app, {
      headers: { authorization: `Bearer ${process.env.API_AUTH_TOKEN}` },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });

  it("accepts static API_AUTH_TOKEN via x-api-key", async () => {
    const r = await request(app, {
      headers: { "x-api-key": process.env.API_AUTH_TOKEN },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// tests/drive-config-routes.test.js — integration tests for /api/drive/config
// ───────────────────────────────────────────────────────────────────────────
// Spins up Express with the real router from server/routes/driveConfig.js,
// stubs identity.users + identity.user_drive_config via the in-memory pg shim:
//   - GET  /api/drive/config (401 unauth, null initially, persisted after POST)
//   - POST /api/drive/config (upsert, 400 on missing fields)
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test";

const identityAuth = await import("../server/lib/identityAuth.js");
const driveConfigModule = await import("../server/routes/driveConfig.js");
const driveConfigRouter = driveConfigModule.default;
const driveConfigTest = driveConfigModule.__test__;

// ─── Shim ──────────────────────────────────────────────────────────────

function makeShim() {
  const tables = {
    users: [
      { user_id: "u-comprador", email: "comp@x.com", name: "Comp", picture_url: null, avatar_preset: null, plan_tier: "base", status: "active", jwt_revoked_at: null },
    ],
    role_grants: [{ user_id: "u-comprador", role: "comprador" }],
    module_grants: [],
    user_drive_config: [],
  };

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    // identityAuth.requireUser flow:
    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select module, level from identity.module_grants")) {
      return { rows: tables.module_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("update identity.users set last_active_at = now()")) return { rows: [] };

    // driveConfig — read
    if (norm.startsWith("select folder_id, folder_name, valid, configured_at, last_validated_at")) {
      const row = tables.user_drive_config.find((c) => c.user_id === params[0]);
      return { rows: row ? [row] : [] };
    }
    // driveConfig — upsert
    if (norm.startsWith("insert into identity.user_drive_config")) {
      const [user_id, email, folder_id, folder_name, valid] = params;
      let row = tables.user_drive_config.find((c) => c.user_id === user_id);
      if (!row) {
        row = { user_id };
        tables.user_drive_config.push(row);
      }
      Object.assign(row, {
        email, folder_id, folder_name, valid,
        configured_at: new Date(), last_validated_at: new Date(),
      });
      return { rows: [{ folder_id, folder_name, valid, configured_at: row.configured_at, last_validated_at: row.last_validated_at }] };
    }

    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }
  return { query, _tables: tables };
}

function bearerFor(userId) {
  const token = jwt.sign(
    { sub: userId, sid: "test-sess", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    { algorithm: "HS256", expiresIn: 60 * 15, issuer: "bmc-identity", audience: "bmc-identity-api" },
  );
  return `Bearer ${token}`;
}

let server, port, pool;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(driveConfigRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => { port = server.address().port; resolve(); });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  identityAuth.__test__.reset();
  pool = makeShim();
  identityAuth.initIdentityAuth({ pool, logger: { warn() {}, error() {}, info() {} } });
  driveConfigTest.setPool(pool);
});

function url(p) { return `http://127.0.0.1:${port}${p}`; }

describe("GET /api/drive/config", () => {
  it("401 unauthenticated", async () => {
    const r = await fetch(url("/api/drive/config"));
    assert.equal(r.status, 401);
  });

  it("returns null config when nothing configured", async () => {
    const r = await fetch(url("/api/drive/config"), { headers: { Authorization: bearerFor("u-comprador") } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.config, null);
  });
});

describe("POST /api/drive/config", () => {
  it("400 when folderId/folderName missing", async () => {
    const r = await fetch(url("/api/drive/config"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ folderId: "", folderName: "" }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "folderId_and_folderName_required");
  });

  it("upserts and persists; GET returns it afterwards", async () => {
    const post = await fetch(url("/api/drive/config"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ folderId: "fldr-123", folderName: "Mis Cotizaciones", valid: true }),
    });
    assert.equal(post.status, 200);
    const pj = await post.json();
    assert.equal(pj.config.folderId, "fldr-123");
    assert.equal(pj.config.folderName, "Mis Cotizaciones");
    assert.equal(pj.config.valid, true);

    const get = await fetch(url("/api/drive/config"), { headers: { Authorization: bearerFor("u-comprador") } });
    const gj = await get.json();
    assert.equal(gj.config.folderId, "fldr-123");
    assert.equal(gj.config.valid, true);
    // email is stamped from req.user, not the body
    assert.equal(pool._tables.user_drive_config[0].email, "comp@x.com");
  });

  it("second POST overwrites (one row per user)", async () => {
    const headers = { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") };
    await fetch(url("/api/drive/config"), { method: "POST", headers, body: JSON.stringify({ folderId: "a", folderName: "A" }) });
    await fetch(url("/api/drive/config"), { method: "POST", headers, body: JSON.stringify({ folderId: "b", folderName: "B" }) });
    assert.equal(pool._tables.user_drive_config.length, 1);
    assert.equal(pool._tables.user_drive_config[0].folder_id, "b");
  });
});

// Deploy-before-migrate safety net: when identity.user_drive_config is absent
// (Postgres 42P01) GET degrades to null config, POST returns a clear 503.
describe("migration not yet applied (42P01)", () => {
  beforeEach(() => {
    const base = makeShim();
    const undefinedTable = () => Object.assign(new Error('relation "identity.user_drive_config" does not exist'), { code: "42P01" });
    const wrapped = {
      _tables: base._tables,
      async query(sql, params) {
        const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (norm.startsWith("select folder_id, folder_name, valid, configured_at, last_validated_at")) throw undefinedTable();
        if (norm.startsWith("insert into identity.user_drive_config")) throw undefinedTable();
        return base.query(sql, params);
      },
    };
    driveConfigTest.setPool(wrapped);
  });

  it("GET degrades to 200 + null config", async () => {
    const r = await fetch(url("/api/drive/config"), { headers: { Authorization: bearerFor("u-comprador") } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.config, null);
  });

  it("POST returns 503 drive_config_unavailable", async () => {
    const r = await fetch(url("/api/drive/config"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ folderId: "x", folderName: "X" }),
    });
    assert.equal(r.status, 503);
    const j = await r.json();
    assert.equal(j.error, "drive_config_unavailable");
  });
});

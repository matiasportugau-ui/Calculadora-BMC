/**
 * Identity admin user-management RBAC (#identityAdmin).
 * Offline Express + in-memory pg shim — no DB / network.
 *
 * Locks fail-closed gates on /api/admin/users*:
 *   - anon / non-admin denied
 *   - cannot_modify_self on role grant / suspend
 *   - only superadmin may grant/revoke superadmin
 *   - admin cannot suspend a superadmin target
 *   - invalid role rejected
 *
 * Run: node --test tests/identity-admin-routes.test.js
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test";

const identityAuth = await import("../server/lib/identityAuth.js");
const identityAdminModule = await import("../server/routes/identityAdmin.js");
const identityAdminRouter = identityAdminModule.default;
const identityAdminTest = identityAdminModule.__test__;

function makeShim() {
  const tables = {
    users: [
      {
        user_id: "u-comprador",
        email: "comp@x.com",
        name: "Comp",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "base",
        status: "active",
        jwt_revoked_at: null,
        mfa_required: false,
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
        last_login_at: null,
        last_active_at: null,
      },
      {
        user_id: "u-admin",
        email: "adm@x.com",
        name: "Adm",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
        mfa_required: false,
        created_at: new Date("2026-01-02"),
        updated_at: new Date("2026-01-02"),
        last_login_at: null,
        last_active_at: null,
      },
      {
        user_id: "u-super",
        email: "super@x.com",
        name: "Super",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
        mfa_required: false,
        created_at: new Date("2026-01-03"),
        updated_at: new Date("2026-01-03"),
        last_login_at: null,
        last_active_at: null,
      },
      {
        user_id: "u-operator",
        email: "ops@x.com",
        name: "Ops",
        picture_url: null,
        avatar_preset: null,
        plan_tier: "plus",
        status: "active",
        jwt_revoked_at: null,
        mfa_required: false,
        created_at: new Date("2026-01-04"),
        updated_at: new Date("2026-01-04"),
        last_login_at: null,
        last_active_at: null,
      },
    ],
    role_grants: [
      { user_id: "u-comprador", role: "comprador", granted_by: null, granted_at: new Date() },
      { user_id: "u-admin", role: "admin", granted_by: null, granted_at: new Date() },
      { user_id: "u-super", role: "superadmin", granted_by: null, granted_at: new Date() },
      { user_id: "u-operator", role: "operator", granted_by: null, granted_at: new Date() },
    ],
    module_grants: [],
    modules: [{ module: "calc" }, { module: "wa" }],
    sessions: [],
    audit_log: [],
    user_activity_log: [],
  };

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]).map((r) => ({ role: r.role })) };
    }
    if (norm.startsWith("select module, level from identity.module_grants")) {
      return { rows: tables.module_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("update identity.users set last_active_at = now()")) {
      return { rows: [] };
    }

    if (norm.includes("from identity.users u") && norm.includes("order by u.created_at desc")) {
      const limit = Number(params[params.length - 1]) || 50;
      const rows = [...tables.users]
        .sort((a, b) => +b.created_at - +a.created_at)
        .slice(0, limit)
        .map((u) => ({
          ...u,
          roles: tables.role_grants.filter((r) => r.user_id === u.user_id).map((r) => r.role),
          module_grant_count: tables.module_grants.filter((g) => g.user_id === u.user_id).length,
        }));
      return { rows };
    }

    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status,")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role, granted_by, granted_at from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select module, level, granted_by, granted_at from identity.module_grants")) {
      return { rows: tables.module_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select session_id, ip, user_agent, created_at, refresh_expires_at, revoked_at")) {
      return { rows: tables.sessions.filter((s) => s.user_id === params[0]).slice(0, 10) };
    }
    if (norm.startsWith("select audit_id, actor_user_id, action, resource, resource_id, ip, payload, at")) {
      return { rows: [] };
    }

    if (norm.startsWith("select 1 from identity.users where user_id")) {
      return { rows: tables.users.some((u) => u.user_id === params[0]) ? [{ "?column?": 1 }] : [] };
    }
    if (norm.startsWith("select 1 from identity.role_grants where user_id") && norm.includes("superadmin")) {
      const hit = tables.role_grants.some((r) => r.user_id === params[0] && r.role === "superadmin");
      return { rows: hit ? [{ "?column?": 1 }] : [] };
    }
    if (norm.startsWith("select 1 from identity.modules where module")) {
      return { rows: tables.modules.some((m) => m.module === params[0]) ? [{ "?column?": 1 }] : [] };
    }

    if (norm.startsWith("insert into identity.role_grants")) {
      const [user_id, role, granted_by] = params;
      if (!tables.role_grants.find((r) => r.user_id === user_id && r.role === role)) {
        tables.role_grants.push({ user_id, role, granted_by, granted_at: new Date() });
      }
      return { rows: [], rowCount: 1 };
    }
    if (norm.startsWith("delete from identity.role_grants where user_id")) {
      const before = tables.role_grants.length;
      tables.role_grants = tables.role_grants.filter(
        (r) => !(r.user_id === params[0] && r.role === params[1]),
      );
      return { rows: [], rowCount: before - tables.role_grants.length };
    }

    if (norm.startsWith("update identity.users set status='suspended'")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      if (!u) return { rows: [], rowCount: 0 };
      u.status = "suspended";
      u.jwt_revoked_at = new Date();
      return { rows: [{ user_id: u.user_id, status: u.status }], rowCount: 1 };
    }
    if (norm.startsWith("update identity.users set status='active'")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      if (!u) return { rows: [], rowCount: 0 };
      u.status = "active";
      return { rows: [{ user_id: u.user_id, status: u.status }], rowCount: 1 };
    }
    if (norm.startsWith("update identity.sessions set revoked_at=now()")) {
      let count = 0;
      for (const s of tables.sessions) {
        if (s.user_id === params[0] && !s.revoked_at) {
          s.revoked_at = new Date();
          count += 1;
        }
      }
      return { rows: [], rowCount: count };
    }
    if (norm.startsWith("update identity.users set jwt_revoked_at=now()")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      if (u) u.jwt_revoked_at = new Date();
      return { rows: [], rowCount: u ? 1 : 0 };
    }

    if (norm.startsWith("insert into identity.audit_log")) {
      tables.audit_log.push({
        actor_user_id: params[0],
        action: params[1],
        resource_id: params[2],
        payload: params[5],
      });
      return { rows: [], rowCount: 1 };
    }
    if (norm.startsWith("insert into identity.user_activity_log")) {
      tables.user_activity_log.push({ actor_user_id: params[0], action: params[2] });
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`unhandled SQL: ${norm.slice(0, 140)}`);
  }

  return { query, _tables: tables };
}

function bearerFor(userId) {
  return `Bearer ${jwt.sign(
    { sub: userId, sid: "test-sess", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 60 * 15,
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  )}`;
}

let server;
let port;
let pool;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(identityAdminRouter);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  identityAdminTest.reset();
  identityAuth.__test__.reset();
});

beforeEach(() => {
  identityAuth.__test__.reset();
  pool = makeShim();
  identityAuth.initIdentityAuth({
    pool,
    logger: { warn() {}, error() {}, info() {} },
  });
  identityAdminTest.setPool(pool);
});

function url(p) {
  return `http://127.0.0.1:${port}${p}`;
}

describe("GET /api/admin/users — auth gates", () => {
  it("401 unauthenticated", async () => {
    const r = await fetch(url("/api/admin/users"));
    assert.equal(r.status, 401);
  });

  it("403 for comprador", async () => {
    const r = await fetch(url("/api/admin/users"), {
      headers: { Authorization: bearerFor("u-comprador") },
    });
    assert.equal(r.status, 403);
  });

  it("200 for admin with items envelope", async () => {
    const r = await fetch(url("/api/admin/users"), {
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.ok(Array.isArray(j.items));
    assert.ok(j.items.length >= 1);
  });
});

describe("POST /api/admin/users/:id/role-grants — RBAC edges", () => {
  it("rejects invalid role", async () => {
    const r = await fetch(url("/api/admin/users/u-operator/role-grants"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ role: "root" }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "invalid_role");
  });

  it("admin cannot modify self", async () => {
    const r = await fetch(url("/api/admin/users/u-admin/role-grants"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ role: "operator" }),
    });
    assert.equal(r.status, 403);
    const j = await r.json();
    assert.equal(j.error, "cannot_modify_self");
  });

  it("admin cannot grant superadmin", async () => {
    const r = await fetch(url("/api/admin/users/u-operator/role-grants"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ role: "superadmin" }),
    });
    assert.equal(r.status, 403);
    const j = await r.json();
    assert.equal(j.error, "superadmin_required");
  });

  it("superadmin can grant operator role", async () => {
    const r = await fetch(url("/api/admin/users/u-comprador/role-grants"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-super"),
      },
      body: JSON.stringify({ role: "operator" }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.ok(
      pool._tables.role_grants.some((g) => g.user_id === "u-comprador" && g.role === "operator"),
    );
  });
});

describe("DELETE /api/admin/users/:id/role-grants/:role — superadmin protection", () => {
  it("admin cannot revoke a superadmin role grant", async () => {
    const r = await fetch(url("/api/admin/users/u-super/role-grants/superadmin"), {
      method: "DELETE",
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 403);
    const j = await r.json();
    assert.equal(j.error, "superadmin_required");
  });
});

describe("POST /api/admin/users/:id/suspend — self + superadmin guards", () => {
  it("admin cannot suspend self", async () => {
    const r = await fetch(url("/api/admin/users/u-admin/suspend"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ reason: "oops" }),
    });
    assert.equal(r.status, 403);
    const j = await r.json();
    assert.equal(j.error, "cannot_modify_self");
  });

  it("admin cannot suspend a superadmin target", async () => {
    const r = await fetch(url("/api/admin/users/u-super/suspend"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ reason: "nope" }),
    });
    assert.equal(r.status, 403);
    const j = await r.json();
    assert.equal(j.error, "target_is_superadmin");
  });

  it("admin can suspend an operator", async () => {
    const r = await fetch(url("/api/admin/users/u-operator/suspend"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor("u-admin"),
      },
      body: JSON.stringify({ reason: "policy" }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.user.status, "suspended");
    const u = pool._tables.users.find((x) => x.user_id === "u-operator");
    assert.equal(u.status, "suspended");
    assert.ok(u.jwt_revoked_at);
  });
});

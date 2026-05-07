// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-default-admin.test.js
// ───────────────────────────────────────────────────────────────────────────
// Regression coverage for migration 20260601000003_identity_seed_default_admin.
//
// Simulates the post-migration DB state (matias.portugau@gmail.com pre-created
// with admin + superadmin role grants) and exercises the Google login flow to
// confirm:
//   - role resolution returns 'superadmin' (top of admin+superadmin),
//   - email_verified flips to true on first verified Google login,
//   - requireUser({ role: 'admin' | 'superadmin' }) gates pass,
//   - superadmin bypasses module grant checks for any module,
//   - re-applying the seed (idempotency) does not duplicate grants,
//   - an unverified Google profile cannot bind to the seeded email.
//
// Uses the same in-memory pg shim style as tests/identity-auth.test.js so the
// suite runs without a real Postgres.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

const mod = await import("../server/lib/identityAuth.js");
const {
  initIdentityAuth,
  verifyGoogleAndUpsert,
  requireUser,
  getModuleGrants,
  __test__,
} = mod;

const DEFAULT_ADMIN_EMAIL = "matias.portugau@gmail.com";

// ─── In-memory pg.Pool shim (mirrors identity-auth.test.js) ────────────

function makeShim() {
  const tables = {
    users: [],
    sessions: [],
    role_grants: [],
    module_grants: [],
    audit_log: [],
  };

  let nextUserId = 1;
  let nextSessionId = 1;

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (norm.startsWith("insert into identity.users")) {
      const [google_sub, email, email_verified, name, picture] = params;
      let u = tables.users.find((x) => x.email === email);
      if (!u) {
        u = {
          user_id: `user-${nextUserId++}`,
          google_sub,
          email,
          email_verified: !!email_verified,
          name,
          picture_url: picture,
          avatar_preset: null,
          plan_tier: "base",
          status: "active",
          jwt_revoked_at: null,
          last_login_at: new Date(),
          last_active_at: new Date(),
        };
        tables.users.push(u);
      } else {
        u.google_sub = u.google_sub || google_sub;
        u.email_verified = u.email_verified || !!email_verified;
        u.name = u.name || name;
        u.picture_url = u.picture_url || picture;
        u.last_login_at = new Date();
        u.last_active_at = new Date();
      }
      return { rows: [u] };
    }

    if (norm.startsWith("insert into identity.role_grants")) {
      const [user_id, ...rest] = params;
      const role = /'comprador'/i.test(sql) ? "comprador" : rest[0];
      if (!tables.role_grants.find((r) => r.user_id === user_id && r.role === role)) {
        tables.role_grants.push({ user_id, role });
      }
      return { rows: [] };
    }

    if (norm.startsWith("select role from identity.role_grants")) {
      const [user_id] = params;
      return { rows: tables.role_grants.filter((r) => r.user_id === user_id) };
    }

    if (norm.startsWith("insert into identity.sessions")) {
      const [user_id, refresh_token_hash, refresh_expires_at, ip, user_agent, rotated_from_session_id] = params;
      const session_id = `sess-${nextSessionId++}`;
      tables.sessions.push({
        session_id,
        user_id,
        refresh_token_hash,
        refresh_expires_at,
        ip,
        user_agent,
        rotated_from_session_id,
        revoked_at: null,
        created_at: new Date(),
      });
      return { rows: [{ session_id }] };
    }

    if (norm.startsWith("update identity.users set last_active_at = now()")) {
      return { rows: [] };
    }

    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const [user_id] = params;
      const u = tables.users.find((x) => x.user_id === user_id);
      return { rows: u ? [u] : [] };
    }

    if (norm.startsWith("select module, level from identity.module_grants")) {
      const [user_id] = params;
      return { rows: tables.module_grants.filter((r) => r.user_id === user_id) };
    }

    if (norm.startsWith("insert into identity.audit_log")) {
      tables.audit_log.push({ params });
      return { rows: [] };
    }

    throw new Error(`unhandled SQL in test shim: ${norm.slice(0, 120)}`);
  }

  return { query, _tables: tables };
}

function stubGoogleClient(profile) {
  __test__.injectGoogleAuthClient({
    verifyIdToken: async () => ({
      getPayload: () => ({
        sub: profile.sub,
        email: profile.email,
        email_verified: profile.email_verified ?? true,
        name: profile.name,
        picture: profile.picture,
        locale: profile.locale,
      }),
    }),
  });
}

// Replays the migration's effect on the in-memory tables: pre-create user,
// grant admin + superadmin. Idempotent.
function applySeedMigration(pool) {
  const t = pool._tables;
  let u = t.users.find((x) => x.email === DEFAULT_ADMIN_EMAIL);
  if (!u) {
    u = {
      user_id: `seed-user-${t.users.length + 1}`,
      google_sub: null,
      email: DEFAULT_ADMIN_EMAIL,
      email_verified: false,
      name: null,
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
    };
    t.users.push(u);
  } else {
    u.status = "active";
  }
  for (const role of ["admin", "superadmin"]) {
    if (!t.role_grants.find((r) => r.user_id === u.user_id && r.role === role)) {
      t.role_grants.push({ user_id: u.user_id, role });
    }
  }
  return u;
}

let pool;

beforeEach(() => {
  __test__.reset();
  pool = makeShim();
  initIdentityAuth({ pool, logger: { warn: () => {}, error: () => {}, info: () => {} } });
  process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
});

describe("migration 003 — default admin seed", () => {
  it("post-seed: user row exists with email_verified=false and 2 role grants", () => {
    const u = applySeedMigration(pool);
    assert.equal(u.email, DEFAULT_ADMIN_EMAIL);
    assert.equal(u.email_verified, false);
    assert.equal(u.status, "active");
    const grants = pool._tables.role_grants
      .filter((r) => r.user_id === u.user_id)
      .map((r) => r.role)
      .sort();
    assert.deepEqual(grants, ["admin", "superadmin"]);
  });

  it("idempotent re-apply: no duplicate users or grants", () => {
    applySeedMigration(pool);
    applySeedMigration(pool);
    applySeedMigration(pool);
    assert.equal(
      pool._tables.users.filter((u) => u.email === DEFAULT_ADMIN_EMAIL).length,
      1,
    );
    const seedUser = pool._tables.users.find((u) => u.email === DEFAULT_ADMIN_EMAIL);
    const grants = pool._tables.role_grants.filter((r) => r.user_id === seedUser.user_id);
    assert.equal(grants.length, 2);
  });
});

describe("seeded admin → Google login flow", () => {
  it("first verified Google login binds google_sub, flips email_verified, resolves role=superadmin", async () => {
    applySeedMigration(pool);

    stubGoogleClient({
      sub: "google-sub-matias",
      email: DEFAULT_ADMIN_EMAIL,
      email_verified: true,
      name: "Matias Portugau",
    });

    const r = await verifyGoogleAndUpsert({ idToken: "fake-id-token" });

    assert.equal(r.ok, true);
    assert.equal(r.user.email, DEFAULT_ADMIN_EMAIL);
    assert.equal(r.role, "superadmin", "top role must be superadmin (rank > admin)");

    const u = pool._tables.users.find((x) => x.email === DEFAULT_ADMIN_EMAIL);
    assert.equal(u.google_sub, "google-sub-matias", "google_sub must be bound");
    assert.equal(u.email_verified, true, "email_verified must flip to true");

    // The login flow inserts an idempotent 'comprador' grant; admin+superadmin
    // from the seed must remain intact.
    const grants = pool._tables.role_grants
      .filter((r) => r.user_id === u.user_id)
      .map((r) => r.role)
      .sort();
    assert.deepEqual(grants, ["admin", "comprador", "superadmin"]);
  });

  it("rejects login when Google reports email_verified=false (no privilege binding)", async () => {
    applySeedMigration(pool);

    stubGoogleClient({
      sub: "attacker-sub",
      email: DEFAULT_ADMIN_EMAIL,
      email_verified: false,
      name: "Attacker",
    });

    await assert.rejects(
      () => verifyGoogleAndUpsert({ idToken: "fake-id-token" }),
      (err) => err.status === 401 && /email_not_verified/.test(err.message),
    );

    const u = pool._tables.users.find((x) => x.email === DEFAULT_ADMIN_EMAIL);
    assert.equal(u.google_sub, null, "google_sub must NOT be bound on rejected login");
    assert.equal(u.email_verified, false);
  });
});

function makeReqRes({ authHeader = "", cookies = {} } = {}) {
  const res = {
    statusCode: 0,
    body: null,
    status(s) { this.statusCode = s; return this; },
    json(b) { this.body = b; return this; },
  };
  const req = {
    get(h) {
      if (!h) return "";
      if (h.toLowerCase() === "authorization") return authHeader;
      return "";
    },
    cookies,
  };
  return { req, res };
}

async function runMw(mw, req, res) {
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { nextCalled };
}

describe("seeded admin → requireUser gates", () => {
  it("admin gate passes for seeded user after Google login", async () => {
    applySeedMigration(pool);
    stubGoogleClient({ sub: "g-m", email: DEFAULT_ADMIN_EMAIL, email_verified: true });
    const r = await verifyGoogleAndUpsert({ idToken: "fake" });

    const mw = requireUser({ role: "admin" });
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);

    assert.equal(nextCalled, true, "admin gate must allow superadmin");
    assert.equal(req.user.role, "superadmin");
  });

  it("superadmin gate passes for seeded user", async () => {
    applySeedMigration(pool);
    stubGoogleClient({ sub: "g-m", email: DEFAULT_ADMIN_EMAIL, email_verified: true });
    const r = await verifyGoogleAndUpsert({ idToken: "fake" });

    const mw = requireUser({ role: "superadmin" });
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);

    assert.equal(nextCalled, true, "superadmin gate must allow superadmin");
  });

  it("module gate (any module/admin level) passes via superadmin bypass", async () => {
    applySeedMigration(pool);
    stubGoogleClient({ sub: "g-m", email: DEFAULT_ADMIN_EMAIL, email_verified: true });
    const r = await verifyGoogleAndUpsert({ idToken: "fake" });

    for (const m of ["wa", "ml", "agent-admin", "crm-personal"]) {
      const mw = requireUser({ module: m, minLevel: "admin" });
      const { req, res } = makeReqRes({ authHeader: `Bearer ${r.accessToken}` });
      const { nextCalled } = await runMw(mw, req, res);
      assert.equal(nextCalled, true, `superadmin must bypass module=${m} admin check`);
    }
  });
});

describe("seeded admin → getModuleGrants", () => {
  it("superadmin gets admin level on every catalog module", async () => {
    applySeedMigration(pool);
    stubGoogleClient({ sub: "g-m", email: DEFAULT_ADMIN_EMAIL, email_verified: true });
    const r = await verifyGoogleAndUpsert({ idToken: "fake" });

    const grants = await getModuleGrants(r.user.id);
    for (const m of ["calc", "wa", "ml", "admin", "plan-import", "agent-admin", "canales", "crm-personal"]) {
      assert.equal(grants[m], "admin", `superadmin must have admin on module=${m}`);
    }
  });
});

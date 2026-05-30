// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-auth.test.js — unit tests for server/lib/identityAuth.js
// ───────────────────────────────────────────────────────────────────────────
// Mocks pg.Pool with an in-memory shim and Google verification with a stub
// so the lib's flow (verify→upsert→session create→refresh rotation→reuse
// detection→logout) is exercised without external dependencies.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

const mod = await import("../server/lib/identityAuth.js");
const { initIdentityAuth, verifyGoogleAndUpsert, refreshTokens, logout, requireUser, getModuleGrants, __test__ } = mod;

// ─── In-memory pg.Pool shim ────────────────────────────────────────────

function makeShim() {
  const tables = {
    users: [],          // {user_id, email, name, picture_url, plan_tier, status, jwt_revoked_at, ...}
    sessions: [],       // {session_id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, rotated_from_session_id}
    role_grants: [],    // {user_id, role}
    module_grants: [],  // {user_id, module, level}
    audit_log: [],
  };

  let nextUserId = 1;
  let nextSessionId = 1;

  function uuid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    // ── users upsert
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

    // ── role_grants insert (idempotent)
    if (norm.startsWith("insert into identity.role_grants")) {
      const [user_id, ...rest] = params; // signature: ($1, 'comprador') or ($1, $2, $3, $4)
      // detect 'comprador' literal
      const role = /'comprador'/i.test(sql) ? "comprador" : rest[0];
      if (!tables.role_grants.find((r) => r.user_id === user_id && r.role === role)) {
        tables.role_grants.push({ user_id, role });
      }
      return { rows: [] };
    }

    // ── role_grants select
    if (norm.startsWith("select role from identity.role_grants")) {
      const [user_id] = params;
      return { rows: tables.role_grants.filter((r) => r.user_id === user_id) };
    }

    // ── sessions insert
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

    // ── refresh-token lookup
    if (norm.startsWith("select s.session_id, s.user_id, s.refresh_expires_at, s.revoked_at,")) {
      const [hash] = params;
      const s = tables.sessions.find((x) => x.refresh_token_hash === hash);
      if (!s) return { rows: [] };
      const u = tables.users.find((x) => x.user_id === s.user_id);
      return {
        rows: [
          {
            session_id: s.session_id,
            user_id: s.user_id,
            refresh_expires_at: s.refresh_expires_at,
            revoked_at: s.revoked_at,
            status: u.status,
            email: u.email,
            name: u.name,
            picture_url: u.picture_url,
            avatar_preset: u.avatar_preset,
            plan_tier: u.plan_tier,
          },
        ],
      };
    }

    // ── CAS revoke (atomic rotate): UPDATE ... WHERE session_id=$1 AND revoked_at IS NULL RETURNING session_id
    if (norm.startsWith("update identity.sessions set revoked_at = now() where session_id = $1 and revoked_at is null returning session_id")) {
      const [session_id] = params;
      const s = tables.sessions.find((x) => x.session_id === session_id);
      if (!s || s.revoked_at) return { rows: [] };  // CAS lost
      s.revoked_at = new Date();
      return { rows: [{ session_id }] };
    }

    // ── revoke single session (logout / non-CAS path)
    if (norm.startsWith("update identity.sessions set revoked_at = now() where session_id")) {
      const [session_id] = params;
      const s = tables.sessions.find((x) => x.session_id === session_id);
      if (s && !s.revoked_at) s.revoked_at = new Date();
      return { rows: [] };
    }

    // ── revoke all sessions for user
    if (norm.includes("update identity.sessions") && norm.includes("revoked_at = coalesce(revoked_at, now())") && norm.includes("where user_id")) {
      const [user_id] = params;
      for (const s of tables.sessions) {
        if (s.user_id === user_id && !s.revoked_at) s.revoked_at = new Date();
      }
      return { rows: [] };
    }

    if (norm.includes("update identity.sessions") && norm.includes("revoked_at = coalesce(revoked_at, now())") && norm.includes("where session_id")) {
      const [session_id, user_id] = params;
      const s = tables.sessions.find((x) => x.session_id === session_id && x.user_id === user_id);
      if (s && !s.revoked_at) s.revoked_at = new Date();
      return { rows: [] };
    }

    // ── jwt_revoked_at bump
    if (norm.startsWith("update identity.users set jwt_revoked_at = now()")) {
      const [user_id] = params;
      const u = tables.users.find((x) => x.user_id === user_id);
      if (u) u.jwt_revoked_at = new Date();
      return { rows: [] };
    }

    // ── users last_active touch
    if (norm.startsWith("update identity.users set last_active_at = now()")) {
      return { rows: [] };
    }

    // ── select user for requireUser
    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const [user_id] = params;
      const u = tables.users.find((x) => x.user_id === user_id);
      return { rows: u ? [u] : [] };
    }

    // ── module_grants select
    if (norm.startsWith("select module, level from identity.module_grants")) {
      const [user_id] = params;
      return { rows: tables.module_grants.filter((r) => r.user_id === user_id) };
    }

    // ── module_grants insert (idempotent: ON CONFLICT DO NOTHING)
    // Literal module/level values are baked into the SQL string, not in params —
    // parse them directly from the SQL via regex.
    if (norm.startsWith("insert into identity.module_grants")) {
      const [user_id] = params;
      const tupleRe = /\(\$\d+,\s*'([^']+)',\s*'([^']+)'\)/g;
      let m;
      while ((m = tupleRe.exec(sql)) !== null) {
        const [, module, level] = m;
        if (!tables.module_grants.find((r) => r.user_id === user_id && r.module === module)) {
          tables.module_grants.push({ user_id, module, level });
        }
      }
      return { rows: [] };
    }

    // ── audit insert
    if (norm.startsWith("insert into identity.audit_log")) {
      tables.audit_log.push({ params });
      return { rows: [] };
    }

    throw new Error(`unhandled SQL in test shim: ${norm.slice(0, 120)}`);
  }

  return { query, _tables: tables };
}

// ─── Stub Google verifyIdToken ─────────────────────────────────────────

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

// ─── Tests ─────────────────────────────────────────────────────────────

let pool;

beforeEach(() => {
  __test__.reset();
  pool = makeShim();
  initIdentityAuth({ pool, logger: { warn: () => {}, error: () => {}, info: () => {} } });
  process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
});

describe("identityAuth.verifyGoogleAndUpsert", () => {
  it("creates a new user on first login and assigns 'comprador' role", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com", name: "Alice" });
    const r = await verifyGoogleAndUpsert({ idToken: "fake", ip: "1.2.3.4", userAgent: "ua" });
    assert.equal(r.ok, true);
    assert.equal(r.user.email, "alice@example.com");
    assert.equal(r.role, "comprador");
    assert.equal(r.plan_tier, "base");
    assert.ok(r.accessToken && typeof r.accessToken === "string");
    assert.ok(r.refreshToken && r.refreshToken.length >= 32);
    assert.equal(pool._tables.users.length, 1);
    assert.equal(pool._tables.sessions.length, 1);
    assert.equal(pool._tables.role_grants.length, 1);
  });

  it("idempotent on re-login: same email → same user, new session", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com", name: "Alice" });
    await verifyGoogleAndUpsert({ idToken: "fake1" });
    await verifyGoogleAndUpsert({ idToken: "fake2" });
    assert.equal(pool._tables.users.length, 1);
    assert.equal(pool._tables.sessions.length, 2);
  });
});

describe("identityAuth.refreshTokens", () => {
  it("rotates: new refresh issued, old session revoked", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    const r2 = await refreshTokens({ refreshToken: r1.refreshToken });
    assert.notEqual(r1.refreshToken, r2.refreshToken);
    assert.equal(pool._tables.sessions.length, 2);
    const oldSession = pool._tables.sessions[0];
    const newSession = pool._tables.sessions[1];
    assert.ok(oldSession.revoked_at, "old session should be revoked");
    assert.equal(newSession.rotated_from_session_id, oldSession.session_id);
  });

  it("reuse detection: replaying an already-rotated refresh kills all sessions and bumps jwt_revoked_at", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    await refreshTokens({ refreshToken: r1.refreshToken }); // rotate once

    // Now replay the original (now-revoked) refresh:
    await assert.rejects(
      () => refreshTokens({ refreshToken: r1.refreshToken }),
      (err) => err.status === 401 && /token_reuse_detected/.test(err.message),
    );
    // All sessions for that user should be revoked
    for (const s of pool._tables.sessions) {
      assert.ok(s.revoked_at, "session should be revoked after reuse detection");
    }
    // jwt_revoked_at should be set on the user
    assert.ok(pool._tables.users[0].jwt_revoked_at, "jwt_revoked_at should be bumped");
  });

  it("rejects an unknown refresh token", async () => {
    await assert.rejects(
      () => refreshTokens({ refreshToken: "deadbeef".repeat(8) }),
      (err) => err.status === 401 && /refresh_invalid/.test(err.message),
    );
  });

  // cursor[bot] round-6 MEDIUM: atomic CAS prevents double-rotation race.
  it("concurrent rotations of the same valid refresh: one wins, the other triggers reuse-detection", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });

    // Two simultaneous rotation attempts with the SAME valid refresh token.
    // Before the fix: both passed the SELECT-then-check, both got fresh
    // sessions. After the fix: only one wins the CAS UPDATE.
    const results = await Promise.allSettled([
      refreshTokens({ refreshToken: r1.refreshToken }),
      refreshTokens({ refreshToken: r1.refreshToken }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one concurrent rotation should win");
    assert.equal(rejected.length, 1, "the other must be rejected as reuse");
    assert.match(rejected[0].reason.message, /token_reuse_detected/);

    // Reuse-detection side effects: every session for the user revoked,
    // jwt_revoked_at bumped on the user row.
    for (const s of pool._tables.sessions) {
      assert.ok(s.revoked_at, "all sessions revoked after concurrent-rotate reuse");
    }
    assert.ok(pool._tables.users[0].jwt_revoked_at, "jwt_revoked_at bumped");
  });
});

describe("identityAuth.logout", () => {
  it("revokes a single session", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    await logout({ userId: r1.user.id, sessionId: r1.sessionId });
    assert.ok(pool._tables.sessions[0].revoked_at);
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

describe("identityAuth.requireUser middleware", () => {
  it("401 when no token presented", async () => {
    const mw = requireUser();
    const { req, res } = makeReqRes();
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "missing_credentials");
  });

  it("attaches req.user on a valid Bearer JWT", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com", name: "Alice" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    const mw = requireUser();
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r1.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, true, "next() should have been called");
    assert.equal(req.user.email, "alice@example.com");
    assert.equal(req.user.role, "comprador");
    assert.equal(req.user.subject_type, "user");
  });

  it("403 when role check fails", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    const mw = requireUser({ role: "admin" });
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r1.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "insufficient_role");
  });

  it("403 when module level check fails for a comprador on /api/wa", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    const mw = requireUser({ module: "wa", minLevel: "read" });
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r1.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "insufficient_module_grant");
  });
});

describe("identityAuth.getModuleGrants", () => {
  it("comprador defaults: calc=write only", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    const grants = await getModuleGrants(r1.user.id);
    assert.equal(grants.calc, "write");
    assert.equal(grants.wa || "none", "none");
  });
});

// ─── Hardening regression tests (Phase B of backend-auth plan) ─────────

describe("identityAuth hardening — email_verified guard", () => {
  it("rejects a brand-new user (no pre-seed) when Google reports email_verified=false", async () => {
    stubGoogleClient({
      sub: "g-attacker",
      email: "newcomer@example.com",
      email_verified: false,
      name: "Newcomer",
    });

    await assert.rejects(
      () => verifyGoogleAndUpsert({ idToken: "fake" }),
      (err) => err.status === 401 && /email_not_verified/.test(err.message),
    );

    // No user row, no session, no grant should have been created.
    assert.equal(pool._tables.users.length, 0, "users table must remain empty");
    assert.equal(pool._tables.sessions.length, 0, "sessions table must remain empty");
    assert.equal(pool._tables.role_grants.length, 0, "no comprador grant should leak");
  });
});

describe("identityAuth hardening — refresh preserves elevated role", () => {
  it("admin role survives refresh token rotation", async () => {
    // Pre-seed an admin grant so _resolveTopRole returns 'admin' after login.
    pool._tables.users.push({
      user_id: "user-pre-admin",
      google_sub: null,
      email: "admin-pre@example.com",
      email_verified: false,
      name: null,
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
    });
    pool._tables.role_grants.push({ user_id: "user-pre-admin", role: "admin" });

    stubGoogleClient({
      sub: "g-admin",
      email: "admin-pre@example.com",
      email_verified: true,
      name: "Admin Pre",
    });

    const r1 = await verifyGoogleAndUpsert({ idToken: "fake" });
    assert.equal(r1.role, "admin", "first login must resolve role=admin from pre-seed");

    const r2 = await refreshTokens({ refreshToken: r1.refreshToken });
    assert.notEqual(r1.accessToken, r2.accessToken, "refresh must mint a new access JWT");

    // The new access token must still pass requireUser({ role: 'admin' }).
    const mw = requireUser({ role: "admin" });
    const { req, res } = makeReqRes({ authHeader: `Bearer ${r2.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, true, "post-refresh JWT must keep admin gating");
    assert.equal(req.user.role, "admin", "role must remain admin after rotation");
  });
});

describe("identityAuth hardening — logout isolation across users", () => {
  it("logging out userA does not revoke userB's session or invalidate userB's access JWT", async () => {
    // userA logs in.
    stubGoogleClient({ sub: "g-A", email: "a@example.com", email_verified: true, name: "A" });
    const rA = await verifyGoogleAndUpsert({ idToken: "fakeA" });

    // userB logs in.
    stubGoogleClient({ sub: "g-B", email: "b@example.com", email_verified: true, name: "B" });
    const rB = await verifyGoogleAndUpsert({ idToken: "fakeB" });

    assert.notEqual(rA.user.id, rB.user.id, "users must be distinct");
    assert.equal(pool._tables.sessions.length, 2);

    await logout({ userId: rA.user.id, sessionId: rA.sessionId });

    const sA = pool._tables.sessions.find((s) => s.user_id === rA.user.id);
    const sB = pool._tables.sessions.find((s) => s.user_id === rB.user.id);
    assert.ok(sA.revoked_at, "userA session must be revoked");
    assert.equal(sB.revoked_at, null, "userB session must remain active");

    // userB's access JWT must still pass requireUser().
    const mw = requireUser();
    const { req, res } = makeReqRes({ authHeader: `Bearer ${rB.accessToken}` });
    const { nextCalled } = await runMw(mw, req, res);
    assert.equal(nextCalled, true, "userB access JWT must remain valid");
    assert.equal(req.user.email, "b@example.com");
  });
});

describe("identityAuth hardening — superadmin module bypass (general)", () => {
  it("any superadmin user (not just seeded admin) bypasses every module/admin-level check", async () => {
    // Pre-seed a user with ONLY 'superadmin' grant — verifies the bypass branch
    // in identityAuth.js (`if (userRole !== 'superadmin')`) for the general case,
    // not the seeded-admin-with-both-grants case covered by identity-default-admin.
    pool._tables.users.push({
      user_id: "user-pre-super",
      google_sub: null,
      email: "super@example.com",
      email_verified: false,
      name: null,
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
    });
    pool._tables.role_grants.push({ user_id: "user-pre-super", role: "superadmin" });

    stubGoogleClient({
      sub: "g-super",
      email: "super@example.com",
      email_verified: true,
      name: "Super",
    });

    const r = await verifyGoogleAndUpsert({ idToken: "fake" });
    assert.equal(r.role, "superadmin");

    const allModules = ["calc", "wa", "ml", "admin", "plan-import", "agent-admin", "canales", "crm-personal"];
    for (const m of allModules) {
      const mw = requireUser({ module: m, minLevel: "admin" });
      const { req, res } = makeReqRes({ authHeader: `Bearer ${r.accessToken}` });
      const { nextCalled } = await runMw(mw, req, res);
      assert.equal(
        nextCalled,
        true,
        `superadmin must bypass module=${m} minLevel=admin`,
      );
    }
  });
});


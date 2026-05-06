// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-security.test.js — regression tests for the high-severity
// findings raised on PR #137 by cursor[bot], chatgpt-codex-connector[bot],
// and Copilot:
//
//   1) requireAuth alias must remain token-only (no JWT widening on legacy
//      operator routes).
//   2) requireServiceOrUser({...}) is the explicit opt-in.
//   3) Access-token fallback rejects audience mismatch + unverified emails.
//   4) /auth/logout revokes session by refresh cookie even when no Bearer.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const reqShim = await import("../server/middleware/requireServiceOrUser.js");
const authGoogleModule = await import("../server/routes/authGoogle.js");
const authGoogleRouter = authGoogleModule.default;

// ─── In-memory pg shim (subset enough for these tests) ────────────────

function makeShim() {
  const tables = {
    users: [
      { user_id: "u-comprador", email: "comp@x.com", name: "Comp", picture_url: null, avatar_preset: null, plan_tier: "base", status: "active", jwt_revoked_at: null },
      { user_id: "u-operator",  email: "ops@x.com",  name: "Ops",  picture_url: null, avatar_preset: null, plan_tier: "plus", status: "active", jwt_revoked_at: null },
    ],
    role_grants: [
      { user_id: "u-comprador", role: "comprador" },
      { user_id: "u-operator",  role: "operator"  },
    ],
    sessions: [],
    audit_log: [],
  };
  let nextSeq = 1;
  function uuid(prefix) { return `${prefix}-${nextSeq++}`; }

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select module, level from identity.module_grants")) return { rows: [] };
    if (norm.startsWith("update identity.users set last_active_at = now()")) return { rows: [] };
    if (norm.startsWith("insert into identity.users")) {
      const [google_sub, email, ev, name, picture] = params;
      let u = tables.users.find((x) => x.email === email);
      if (!u) {
        u = { user_id: uuid("u"), google_sub, email, email_verified: !!ev, name, picture_url: picture, avatar_preset: null, plan_tier: "base", status: "active", jwt_revoked_at: null };
        tables.users.push(u);
      }
      return { rows: [u] };
    }
    if (norm.startsWith("insert into identity.role_grants")) {
      tables.role_grants.push({ user_id: params[0], role: "comprador" });
      return { rows: [] };
    }
    if (norm.startsWith("insert into identity.sessions")) {
      const [user_id, hash, exp] = params;
      const s = { session_id: uuid("s"), user_id, refresh_token_hash: hash, refresh_expires_at: exp, revoked_at: null };
      tables.sessions.push(s);
      return { rows: [{ session_id: s.session_id }] };
    }
    if (norm.startsWith("select session_id, user_id, revoked_at from identity.sessions")) {
      const [hash] = params;
      const s = tables.sessions.find((x) => x.refresh_token_hash === hash);
      return { rows: s ? [s] : [] };
    }
    if (norm.startsWith("update identity.sessions set revoked_at = now() where session_id = $1")) {
      const s = tables.sessions.find((x) => x.session_id === params[0]);
      if (s) s.revoked_at = new Date();
      return { rows: [] };
    }
    if (norm.startsWith("insert into identity.audit_log")) {
      tables.audit_log.push(params);
      return { rows: [] };
    }
    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }
  return { query, _tables: tables };
}

// ─── Auth helper ───────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
function bearerFor(userId) {
  const t = jwt.sign(
    { sub: userId, sid: "sess-test", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    { algorithm: "HS256", expiresIn: 60 * 15 },
  );
  return `Bearer ${t}`;
}

// ─── Mock global fetch for tokeninfo + userinfo ────────────────────────

let _fetchMock = null;
const _origFetch = globalThis.fetch;
function mockFetch(handler) { _fetchMock = handler; }
function clearFetchMock() { _fetchMock = null; }
beforeEach(() => clearFetchMock());

globalThis.fetch = async (url, init) => {
  if (_fetchMock) {
    const out = await _fetchMock(url, init);
    if (out) return out;
  }
  return _origFetch ? _origFetch(url, init) : new Response("", { status: 502 });
};

// ─── App boot ──────────────────────────────────────────────────────────

let server, port;
let pool;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mount the legacy requireAuth on a probe route (simulates /agent/feedback).
  app.get("/legacy/probe", reqShim.requireAuth, (req, res) => {
    res.json({ ok: true, principal: req.user });
  });

  // Mount requireServiceOrUser (no opts) on another probe — should ALSO be
  // service-token-only because no role/module/optional was set.
  app.get("/strict/probe", reqShim.default(), (req, res) => {
    res.json({ ok: true, principal: req.user });
  });

  // Mount opt-in operator-only probe.
  app.get("/operator/probe", reqShim.default({ role: "operator" }), (req, res) => {
    res.json({ ok: true, principal: req.user });
  });

  // /api/auth/* router for logout-by-cookie test.
  app.use("/api", authGoogleRouter);

  await new Promise((resolve) => {
    server = app.listen(0, () => { port = server.address().port; resolve(); });
  });
});

after(async () => { await new Promise((resolve) => server.close(resolve)); });

beforeEach(() => {
  identityAuth.__test__.reset();
  pool = makeShim();
  identityAuth.initIdentityAuth({ pool, logger: { warn() {}, error() {}, info() {} } });
});

function url(p) { return `http://127.0.0.1:${port}${p}`; }

// ─── Tests ─────────────────────────────────────────────────────────────

describe("requireAuth alias is token-only (regression for PR #137 audit gap)", () => {
  it("rejects a comprador JWT — was previously a privilege expansion", async () => {
    const r = await fetch(url("/legacy/probe"), {
      headers: { Authorization: bearerFor("u-comprador") },
    });
    assert.equal(r.status, 401);
  });

  it("rejects an operator JWT (no opt-in to user JWTs at this route)", async () => {
    const r = await fetch(url("/legacy/probe"), {
      headers: { Authorization: bearerFor("u-operator") },
    });
    assert.equal(r.status, 401);
  });

  it("accepts the static API_AUTH_TOKEN", async () => {
    const r = await fetch(url("/legacy/probe"), {
      headers: { Authorization: "Bearer static_service_token_xyz" },
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.principal.role, "service");
  });
});

describe("requireServiceOrUser without opts behaves as token-only", () => {
  it("401 on a comprador JWT", async () => {
    const r = await fetch(url("/strict/probe"), { headers: { Authorization: bearerFor("u-comprador") } });
    assert.equal(r.status, 401);
  });
  it("200 with the static token", async () => {
    const r = await fetch(url("/strict/probe"), { headers: { Authorization: "Bearer static_service_token_xyz" } });
    assert.equal(r.status, 200);
  });
});

describe("requireServiceOrUser({role:'operator'}) opt-in widens correctly", () => {
  it("200 with operator JWT", async () => {
    const r = await fetch(url("/operator/probe"), { headers: { Authorization: bearerFor("u-operator") } });
    assert.equal(r.status, 200);
  });
  it("403 with comprador JWT (insufficient role)", async () => {
    const r = await fetch(url("/operator/probe"), { headers: { Authorization: bearerFor("u-comprador") } });
    assert.equal(r.status, 403);
  });
  it("200 with the static token (service principal still passes)", async () => {
    const r = await fetch(url("/operator/probe"), { headers: { Authorization: "Bearer static_service_token_xyz" } });
    assert.equal(r.status, 200);
  });
});

describe("Access-token fallback validates aud + email_verified", () => {
  it("rejects when tokeninfo aud does not match GOOGLE_OAUTH_CLIENT_ID", async () => {
    mockFetch(async (u) => {
      if (String(u).startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response(JSON.stringify({ aud: "DIFFERENT-CLIENT.apps.googleusercontent.com", email_verified: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return null;
    });
    await assert.rejects(
      () => identityAuth.verifyGoogleAndUpsert({ accessToken: "fake-bad-aud" }),
      (e) => e.status === 401 && /tokeninfo_aud_mismatch/.test(e.message),
    );
  });

  it("rejects when email_verified is false", async () => {
    mockFetch(async (u) => {
      const url = String(u);
      if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response(JSON.stringify({ aud: process.env.GOOGLE_OAUTH_CLIENT_ID, email_verified: false }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
        return new Response(JSON.stringify({ sub: "g-1", email: "x@y.com", email_verified: false, name: "X" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return null;
    });
    await assert.rejects(
      () => identityAuth.verifyGoogleAndUpsert({ accessToken: "fake-unverified" }),
      (e) => e.status === 401 && /email_not_verified/.test(e.message),
    );
  });

  it("accepts when aud matches AND email_verified=true", async () => {
    mockFetch(async (u) => {
      const url = String(u);
      if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response(JSON.stringify({ aud: process.env.GOOGLE_OAUTH_CLIENT_ID, email_verified: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
        return new Response(JSON.stringify({ sub: "g-1", email: "alice@y.com", email_verified: true, name: "Alice" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return null;
    });
    const r = await identityAuth.verifyGoogleAndUpsert({ accessToken: "fake-good" });
    assert.equal(r.user.email, "alice@y.com");
  });
});

// ─── New regression tests (round 2) ───────────────────────────────────

describe("initIdentityAuth — C-1 cross-system token substitution guard", () => {
  it("throws when IDENTITY_JWT_SECRET === WA_JWT_SECRET", () => {
    const prevId = process.env.IDENTITY_JWT_SECRET;
    const prevWa = process.env.WA_JWT_SECRET;
    const shared = "x".repeat(40);
    process.env.IDENTITY_JWT_SECRET = shared;
    process.env.WA_JWT_SECRET = shared;
    try {
      identityAuth.__test__.reset();
      assert.throws(
        () => identityAuth.initIdentityAuth({ pool: makeShim(), logger: { warn() {}, error() {}, info() {} } }),
        /must differ from WA_JWT_SECRET/,
      );
    } finally {
      process.env.IDENTITY_JWT_SECRET = prevId;
      process.env.WA_JWT_SECRET = prevWa;
    }
  });

  it("throws in production when IDENTITY_JWT_SECRET is empty", () => {
    const prevId = process.env.IDENTITY_JWT_SECRET;
    const prevEnv = process.env.APP_ENV;
    delete process.env.IDENTITY_JWT_SECRET;
    process.env.APP_ENV = "production";
    try {
      identityAuth.__test__.reset();
      assert.throws(
        () => identityAuth.initIdentityAuth({ pool: makeShim(), logger: { warn() {}, error() {}, info() {} } }),
        /IDENTITY_JWT_SECRET is empty/,
      );
    } finally {
      process.env.IDENTITY_JWT_SECRET = prevId;
      process.env.APP_ENV = prevEnv;
    }
  });

  it("throws in production when GOOGLE_OAUTH_CLIENT_ID is unset", () => {
    const prevAud = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevEnv = process.env.APP_ENV;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    process.env.APP_ENV = "production";
    try {
      identityAuth.__test__.reset();
      assert.throws(
        () => identityAuth.initIdentityAuth({ pool: makeShim(), logger: { warn() {}, error() {}, info() {} } }),
        /GOOGLE_OAUTH_CLIENT_ID is unset/,
      );
    } finally {
      process.env.GOOGLE_OAUTH_CLIENT_ID = prevAud;
      process.env.APP_ENV = prevEnv;
    }
  });
});

describe("verifyGoogleAndUpsert — H-3 ID-token email_verified guard", () => {
  it("rejects an ID-token profile whose email_verified is false", async () => {
    identityAuth.__test__.injectGoogleAuthClient({
      verifyIdToken: async () => ({
        getPayload: () => ({
          sub: "g-evil",
          email: "matias@bmc.uy",          // email targets a seeded superadmin
          email_verified: false,            // attacker-supplied, unverified
          name: "Attacker",
        }),
      }),
    });
    await assert.rejects(
      () => identityAuth.verifyGoogleAndUpsert({ idToken: "fake.unverified" }),
      (e) => e.status === 401 && /email_not_verified/.test(e.message),
    );
  });
});

describe("F-1: /auth/google does not leak GOOGLE_OAUTH_CLIENT_ID in error responses", () => {
  it("audience mismatch returns generic error code, no detail field", async () => {
    mockFetch(async (u) => {
      if (String(u).startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response(JSON.stringify({ aud: "ATTACKER-CLIENT.apps.googleusercontent.com", email_verified: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return null;
    });
    const r = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "fake-bad-aud" }),
    });
    assert.equal(r.status, 401);
    const text = await r.text();
    const expected = process.env.GOOGLE_OAUTH_CLIENT_ID;
    assert.ok(expected && expected.length > 0, "test requires GOOGLE_OAUTH_CLIENT_ID set");
    assert.ok(!text.includes(expected), `response body must not include OAuth client ID; got: ${text}`);
    // Response body should not contain a `detail` key either.
    const body = JSON.parse(text);
    assert.equal(body.detail, undefined);
  });

  it("tokeninfo non-200 does not forward Google's error body", async () => {
    mockFetch(async (u) => {
      if (String(u).startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return new Response("INTERNAL_GOOGLE_ERROR_MESSAGE_SHOULD_NOT_LEAK", { status: 400 });
      }
      return null;
    });
    const r = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "fake-bad-token" }),
    });
    assert.equal(r.status, 401);
    const text = await r.text();
    assert.ok(!text.includes("INTERNAL_GOOGLE_ERROR_MESSAGE_SHOULD_NOT_LEAK"), `Google error body must not be forwarded; got: ${text}`);
  });
});

describe("W-1: bmc_access cookie is no longer accepted (Bearer-header-only)", () => {
  it("rejects a JWT planted in a bmc_access cookie", async () => {
    // Mint a syntactically valid JWT that would have authenticated under the
    // old fallback path. Our shim has u-comprador in identity.users, so a
    // properly-signed JWT for that subject would have been accepted.
    const validJwt = jwt.sign(
      { sub: "u-comprador", subject_type: "user" },
      process.env.IDENTITY_JWT_SECRET,
      { algorithm: "HS256", expiresIn: 60 * 15 },
    );
    const r = await fetch(url("/api/auth/me"), {
      headers: { Cookie: `bmc_access=${validJwt}` },
    });
    assert.equal(r.status, 401, "bmc_access cookie must NOT authenticate");
  });

  it("still accepts the same JWT in Authorization: Bearer", async () => {
    const validJwt = jwt.sign(
      { sub: "u-comprador", subject_type: "user" },
      process.env.IDENTITY_JWT_SECRET,
      { algorithm: "HS256", expiresIn: 60 * 15 },
    );
    const r = await fetch(url("/api/auth/me"), {
      headers: { Authorization: `Bearer ${validJwt}` },
    });
    assert.equal(r.status, 200);
  });
});

describe("/api/auth/logout revokes session by refresh cookie when no Bearer", () => {
  it("looks up the session by sha256(cookie) and revokes it", async () => {
    // Seed a session row that the cookie will match.
    const refreshToken = "refresh_secret_value_abc";
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    pool._tables.sessions.push({
      session_id: "sess-to-revoke",
      user_id: "u-comprador",
      refresh_token_hash: hash,
      refresh_expires_at: new Date(Date.now() + 1e9),
      revoked_at: null,
    });

    const r = await fetch(url("/api/auth/logout"), {
      method: "POST",
      headers: { Cookie: `bmc_sess=${refreshToken}` },
    });
    assert.equal(r.status, 200);
    const sess = pool._tables.sessions[0];
    assert.ok(sess.revoked_at, "session should be revoked after cookie-only logout");
  });

  it("is a no-op when cookie matches no session (already logged out)", async () => {
    const r = await fetch(url("/api/auth/logout"), {
      method: "POST",
      headers: { Cookie: `bmc_sess=fake_unmatched_cookie` },
    });
    assert.equal(r.status, 200);
  });
});

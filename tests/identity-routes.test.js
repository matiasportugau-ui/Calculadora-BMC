// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-routes.test.js — integration tests for /auth/* router
// ───────────────────────────────────────────────────────────────────────────
// Spins up an Express app with the real router from server/routes/authGoogle.js,
// wired against a stubbed identity pool. Exercises the full HTTP surface:
//   POST /auth/google → cookie + accessToken
//   GET  /auth/me     → 401 unauth, 200 with Bearer
//   GET  /auth/me/grants → role + plan_tier + modules
//   POST /auth/refresh → rotation
//   POST /auth/logout  → cookie cleared
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test"; // not "production" → cookies non-secure for test

const identityAuth = await import("../server/lib/identityAuth.js");
const authGoogleModule = await import("../server/routes/authGoogle.js");
const authGoogleRouter = authGoogleModule.default;

// In-memory pg shim copied from identity-auth.test.js (kept self-contained).
function makeShim() {
  const tables = { users: [], sessions: [], role_grants: [], module_grants: [], audit_log: [] };
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
          google_sub, email,
          email_verified: !!email_verified,
          name, picture_url: picture, avatar_preset: null,
          plan_tier: "base", status: "active", jwt_revoked_at: null,
        };
        tables.users.push(u);
      }
      return { rows: [u] };
    }
    if (norm.startsWith("insert into identity.role_grants")) {
      const [user_id] = params;
      const role = "comprador";
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
      const [user_id, refresh_token_hash, refresh_expires_at, ip, user_agent, rotated_from] = params;
      const session_id = `sess-${nextSessionId++}`;
      tables.sessions.push({ session_id, user_id, refresh_token_hash, refresh_expires_at, ip, user_agent, rotated_from_session_id: rotated_from, revoked_at: null });
      return { rows: [{ session_id }] };
    }
    if (norm.startsWith("select s.session_id, s.user_id, s.refresh_expires_at, s.revoked_at,")) {
      const [hash] = params;
      const s = tables.sessions.find((x) => x.refresh_token_hash === hash);
      if (!s) return { rows: [] };
      const u = tables.users.find((x) => x.user_id === s.user_id);
      return { rows: [{ ...s, status: u.status, email: u.email, name: u.name, picture_url: u.picture_url, avatar_preset: u.avatar_preset, plan_tier: u.plan_tier }] };
    }
    // CAS revoke (atomic rotate) — must come before the looser catch-all
    if (norm.startsWith("update identity.sessions set revoked_at = now() where session_id = $1 and revoked_at is null returning session_id")) {
      const [session_id] = params;
      const s = tables.sessions.find((x) => x.session_id === session_id);
      if (!s || s.revoked_at) return { rows: [] };  // CAS lost
      s.revoked_at = new Date();
      return { rows: [{ session_id }] };
    }
    if (norm.startsWith("update identity.sessions set revoked_at = now()") || (norm.includes("update identity.sessions") && norm.includes("revoked_at = coalesce(revoked_at, now())"))) {
      // catch-all session revoke
      const idMatch = sql.match(/where (\w+) = \$1/);
      if (idMatch && idMatch[1] === "session_id") {
        const s = tables.sessions.find((x) => x.session_id === params[0]);
        if (s && !s.revoked_at) s.revoked_at = new Date();
      } else {
        // by user_id
        for (const s of tables.sessions) {
          if (s.user_id === params[0] && !s.revoked_at) s.revoked_at = new Date();
        }
      }
      return { rows: [] };
    }
    if (norm.startsWith("update identity.users set jwt_revoked_at = now()")) {
      const [user_id] = params;
      const u = tables.users.find((x) => x.user_id === user_id);
      if (u) u.jwt_revoked_at = new Date();
      return { rows: [] };
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
    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }
  return { query, _tables: tables };
}

function stubGoogleClient(profile) {
  identityAuth.__test__.injectGoogleAuthClient({
    verifyIdToken: async () => ({
      getPayload: () => ({
        sub: profile.sub,
        email: profile.email,
        email_verified: profile.email_verified ?? true,
        name: profile.name,
        picture: profile.picture,
      }),
    }),
  });
}

let server;
let port;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", authGoogleRouter);
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
  identityAuth.initIdentityAuth({ pool: makeShim(), logger: { warn() {}, error() {}, info() {} } });
});

function url(p) {
  return `http://127.0.0.1:${port}${p}`;
}

function parseSetCookie(headers) {
  const out = {};
  // Node fetch returns a single concatenated header string; getSetCookie() works on Headers when available.
  let raw;
  if (typeof headers.getSetCookie === "function") {
    raw = headers.getSetCookie();
  } else {
    const v = headers.get("set-cookie");
    raw = v ? [v] : [];
  }
  for (const line of raw) {
    const [pair] = line.split(";");
    const [k, ...rest] = pair.split("=");
    out[k.trim()] = rest.join("=").trim();
  }
  return { _raw: raw, ...out };
}

describe("POST /api/auth/google", () => {
  it("400 when neither idToken nor accessToken provided", async () => {
    const r = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 400);
  });

  it("issues access token + refresh cookie on valid idToken", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com", name: "Alice" });
    const r = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "fake.id.token" }),
    });
    assert.equal(r.status, 200);
    const cookies = parseSetCookie(r.headers);
    assert.ok(cookies.bmc_sess, "Set-Cookie bmc_sess expected");
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.email, "alice@example.com");
    assert.equal(body.role, "comprador");
    assert.equal(body.plan_tier, "base");
    assert.ok(body.accessToken && typeof body.accessToken === "string");
    assert.equal(body.modules.calc, "write");
  });
});

describe("GET /api/auth/me", () => {
  it("401 without Bearer", async () => {
    const r = await fetch(url("/api/auth/me"));
    assert.equal(r.status, 401);
  });

  it("200 with valid Bearer", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com", name: "Alice" });
    const login = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "fake.id.token" }),
    });
    const { accessToken } = await login.json();
    const r = await fetch(url("/api/auth/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.user.email, "alice@example.com");
  });
});

describe("GET /api/auth/me/grants", () => {
  it("returns role + plan_tier + modules", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const login = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "fake" }),
    });
    const { accessToken } = await login.json();
    const r = await fetch(url("/api/auth/me/grants"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await r.json();
    assert.equal(body.role, "comprador");
    assert.equal(body.plan_tier, "base");
    assert.equal(body.modules.calc, "write");
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates with the cookie and returns a fresh access token", async () => {
    stubGoogleClient({ sub: "g-1", email: "alice@example.com" });
    const login = await fetch(url("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "fake" }),
    });
    const cookies = parseSetCookie(login.headers);
    const r = await fetch(url("/api/auth/refresh"), {
      method: "POST",
      headers: { Cookie: `bmc_sess=${cookies.bmc_sess}` },
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(body.accessToken);
    const newCookies = parseSetCookie(r.headers);
    assert.notEqual(newCookies.bmc_sess, cookies.bmc_sess, "cookie should rotate");
  });

  it("401 without cookie", async () => {
    const r = await fetch(url("/api/auth/refresh"), { method: "POST" });
    assert.equal(r.status, 401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookie even without auth", async () => {
    const r = await fetch(url("/api/auth/logout"), { method: "POST" });
    assert.equal(r.status, 200);
    const cookies = parseSetCookie(r.headers);
    // Set-Cookie should be present (clearing it). Either bmc_sess="" or expires in past.
    assert.ok(cookies.bmc_sess !== undefined, "Set-Cookie should be issued to clear");
  });
});

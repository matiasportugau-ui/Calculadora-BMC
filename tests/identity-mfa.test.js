// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-mfa.test.js
// ───────────────────────────────────────────────────────────────────────────
// Covers (a) the mfaTotp library (encrypt/decrypt round-trip, code verify
// happy path and rejections, KEK validation) and (b) the authMfa router end
// to end via a real Express app + fetch (enroll → verify → disable, with
// 401/404/409/400 negative cases).
//
// Uses an in-memory pg.Pool shim styled like tests/identity-auth.test.js so
// the suite runs without Postgres. Boots identityAuth + authMfa pointing at
// the shim, drives Google login through a stubbed verifier to mint a real
// access JWT, and exercises HTTP routes with that JWT.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { generateSync as totpGenerateSync } from "otplib";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test";
// 32-byte hex KEK for AES-256-GCM in tests.
process.env.MFA_KEK_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const identityAuth = await import("../server/lib/identityAuth.js");
const mfaTotp = await import("../server/lib/mfaTotp.js");
const authMfaModule = await import("../server/routes/authMfa.js");
const authMfaRouter = authMfaModule.default;

// ─── Pure unit tests for mfaTotp ───────────────────────────────────────

describe("mfaTotp.encryptSecret / decryptSecret", () => {
  it("round-trips a base32 secret", () => {
    const secret = mfaTotp.generateSecret();
    const enc = mfaTotp.encryptSecret(secret);
    assert.ok(Buffer.isBuffer(enc));
    assert.ok(enc.length > 12 + 16, "must include IV + tag overhead");
    const dec = mfaTotp.decryptSecret(enc);
    assert.equal(dec, secret);
  });

  it("rejects malformed payload", () => {
    assert.throws(() => mfaTotp.decryptSecret(Buffer.alloc(8)), /malformed/);
  });

  it("rejects tampered ciphertext (GCM tag mismatch)", () => {
    const secret = mfaTotp.generateSecret();
    const enc = mfaTotp.encryptSecret(secret);
    enc[20] ^= 0xff;
    assert.throws(() => mfaTotp.decryptSecret(enc));
  });

  it("rejects an empty plaintext", () => {
    assert.throws(() => mfaTotp.encryptSecret(""), /non-empty/);
  });
});

describe("mfaTotp.verifyCode", () => {
  it("accepts the current TOTP code for a secret", () => {
    const secret = mfaTotp.generateSecret();
    const code = totpGenerateSync({ secret });
    assert.equal(mfaTotp.verifyCode({ secret, code }), true);
  });

  it("rejects a wrong code", () => {
    const secret = mfaTotp.generateSecret();
    assert.equal(mfaTotp.verifyCode({ secret, code: "000000" }), false);
  });

  it("rejects non-6-digit input", () => {
    const secret = mfaTotp.generateSecret();
    assert.equal(mfaTotp.verifyCode({ secret, code: "abc" }), false);
    assert.equal(mfaTotp.verifyCode({ secret, code: "12345" }), false);
    assert.equal(mfaTotp.verifyCode({ secret, code: "1234567" }), false);
    assert.equal(mfaTotp.verifyCode({ secret, code: "" }), false);
  });

  it("returns false on missing args without throwing", () => {
    assert.equal(mfaTotp.verifyCode({}), false);
    assert.equal(mfaTotp.verifyCode({ secret: "abc" }), false);
    assert.equal(mfaTotp.verifyCode({ code: "123456" }), false);
  });
});

describe("mfaTotp KEK validation", () => {
  it("throws when MFA_KEK_HEX is missing or wrong length", () => {
    const orig = process.env.MFA_KEK_HEX;
    process.env.MFA_KEK_HEX = "";
    assert.throws(() => mfaTotp.encryptSecret("any"), /MFA_KEK_HEX/);
    process.env.MFA_KEK_HEX = "tooshort";
    assert.throws(() => mfaTotp.encryptSecret("any"), /MFA_KEK_HEX/);
    process.env.MFA_KEK_HEX = orig;
  });
});

// ─── Integration: HTTP through real Express + fetch ────────────────────

function makeShim() {
  const tables = {
    users: [],
    sessions: [],
    role_grants: [],
    module_grants: [],
    mfa_secrets: [],
    audit_log: [],
  };
  let nextUserId = 1;
  let nextSessionId = 1;

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (norm === "begin" || norm === "commit" || norm === "rollback") {
      return { rows: [] };
    }

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
          mfa_required: false,
          last_login_at: new Date(),
          last_active_at: new Date(),
        };
        tables.users.push(u);
      } else {
        u.google_sub = u.google_sub || google_sub;
        u.email_verified = u.email_verified || !!email_verified;
        u.last_login_at = new Date();
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

    if (norm.startsWith("update identity.users set mfa_required")) {
      const [val, user_id] = [params[0], params[1]];
      // Signature is: set mfa_required = true/false where user_id = $1.
      // Some calls inline the boolean → params[0] is user_id directly.
      let target_user_id = user_id;
      let target_val = val;
      if (params.length === 1) {
        target_user_id = params[0];
        target_val = /mfa_required = true/.test(sql);
      }
      const u = tables.users.find((x) => x.user_id === target_user_id);
      if (u) u.mfa_required = !!target_val;
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
      tables.audit_log.push({ sql, params });
      return { rows: [] };
    }

    // ── mfa_secrets handling
    if (norm.startsWith("select user_id, enabled_at from identity.mfa_secrets")) {
      const [user_id] = params;
      const r = tables.mfa_secrets.find((x) => x.user_id === user_id);
      return { rows: r ? [{ user_id: r.user_id, enabled_at: r.enabled_at }] : [] };
    }

    if (norm.startsWith("insert into identity.mfa_secrets")) {
      const [user_id, totp_secret_encrypted] = params;
      const existing = tables.mfa_secrets.find((x) => x.user_id === user_id);
      if (existing) {
        existing.totp_secret_encrypted = totp_secret_encrypted;
        existing.enabled_at = null;
        existing.updated_at = new Date();
      } else {
        tables.mfa_secrets.push({
          user_id,
          totp_secret_encrypted,
          enabled_at: null,
          last_used_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
      return { rows: [] };
    }

    if (norm.startsWith("select totp_secret_encrypted, enabled_at")) {
      const [user_id] = params;
      const r = tables.mfa_secrets.find((x) => x.user_id === user_id);
      return { rows: r ? [{ totp_secret_encrypted: r.totp_secret_encrypted, enabled_at: r.enabled_at }] : [] };
    }

    if (norm.startsWith("update identity.mfa_secrets") && norm.includes("enabled_at = now()")) {
      const [user_id] = params;
      const r = tables.mfa_secrets.find((x) => x.user_id === user_id);
      if (r) {
        r.enabled_at = new Date();
        r.last_used_at = new Date();
      }
      return { rows: [] };
    }

    if (norm.startsWith("update identity.mfa_secrets set last_used_at")) {
      const [user_id] = params;
      const r = tables.mfa_secrets.find((x) => x.user_id === user_id);
      if (r) r.last_used_at = new Date();
      return { rows: [] };
    }

    if (norm.startsWith("delete from identity.mfa_secrets")) {
      const [user_id] = params;
      const idx = tables.mfa_secrets.findIndex((x) => x.user_id === user_id);
      if (idx >= 0) tables.mfa_secrets.splice(idx, 1);
      return { rows: [] };
    }

    throw new Error(`unhandled SQL in mfa test shim: ${norm.slice(0, 140)}`);
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

let pool;
let server;
let port;

before(async () => {
  pool = makeShim();
  identityAuth.initIdentityAuth({ pool, logger: { warn() {}, error() {}, info() {} } });
  authMfaModule.initAuthMfa({ pool, logger: { warn() {}, error() {}, info() {} } });

  const app = express();
  app.use(express.json());
  app.use("/api", authMfaRouter);

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
});

beforeEach(() => {
  identityAuth.__test__.reset();
  // Re-init after reset (reset() clears the pool reference).
  identityAuth.initIdentityAuth({ pool, logger: { warn() {}, error() {}, info() {} } });
  authMfaModule.initAuthMfa({ pool, logger: { warn() {}, error() {}, info() {} } });
  // The shared mfaLimiter would otherwise return 429 after ~10 requests
  // across describe blocks (all coming from 127.0.0.1).
  authMfaModule.__test__?.resetMfaRateLimit();
  pool._tables.users.length = 0;
  pool._tables.sessions.length = 0;
  pool._tables.role_grants.length = 0;
  pool._tables.module_grants.length = 0;
  pool._tables.mfa_secrets.length = 0;
  pool._tables.audit_log.length = 0;
});

const url = (path) => `http://127.0.0.1:${port}${path}`;

async function loginAndGetJwt(email = "admin@example.com") {
  stubGoogleClient({ sub: `g-${email}`, email, email_verified: true, name: email });
  const r = await identityAuth.verifyGoogleAndUpsert({ idToken: "fake" });
  return { jwt: r.accessToken, userId: r.user.id, email };
}

describe("POST /api/auth/mfa/enroll", () => {
  it("requires authentication (401 without Bearer)", async () => {
    const r = await fetch(url("/api/auth/mfa/enroll"), { method: "POST" });
    assert.equal(r.status, 401);
  });

  it("creates a fresh secret for an authenticated user", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const r = await fetch(url("/api/auth/mfa/enroll"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.match(body.secret, /^[A-Z2-7]+$/, "secret must be base32");
    assert.match(body.provisioning_uri, /^otpauth:\/\/totp\//);
    const stored = pool._tables.mfa_secrets.find((x) => x.user_id === userId);
    assert.ok(stored, "secret row must be persisted");
    assert.equal(stored.enabled_at, null, "newly enrolled secret must be pending");
  });

  it("rotates a pending secret on re-enroll without 409", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const r1 = await fetch(url("/api/auth/mfa/enroll"), {
      method: "POST", headers: { Authorization: `Bearer ${jwt}` },
    });
    const b1 = await r1.json();
    const r2 = await fetch(url("/api/auth/mfa/enroll"), {
      method: "POST", headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r2.status, 200);
    const b2 = await r2.json();
    assert.notEqual(b1.secret, b2.secret, "re-enroll must rotate secret");
    assert.equal(pool._tables.mfa_secrets.filter((x) => x.user_id === userId).length, 1);
  });

  it("returns 409 when MFA is already verified", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    // Pre-populate an enabled secret.
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(mfaTotp.generateSecret()),
      enabled_at: new Date(),
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const r = await fetch(url("/api/auth/mfa/enroll"), {
      method: "POST", headers: { Authorization: `Bearer ${jwt}` },
    });
    assert.equal(r.status, 409);
    const body = await r.json();
    assert.equal(body.error, "mfa_already_enrolled");
  });
});

describe("POST /api/auth/mfa/verify", () => {
  it("rejects non-6-digit code with 400", async () => {
    const { jwt } = await loginAndGetJwt();
    const r = await fetch(url("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "abc" }),
    });
    assert.equal(r.status, 400);
  });

  it("returns 404 when user has no enrollment", async () => {
    const { jwt } = await loginAndGetJwt();
    const r = await fetch(url("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    assert.equal(r.status, 404);
  });

  it("returns 401 on a wrong code", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(mfaTotp.generateSecret()),
      enabled_at: null,
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const r = await fetch(url("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });
    assert.equal(r.status, 401);
  });

  it("activates a pending enrollment on a valid code (mfa_required flips to true)", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const secret = mfaTotp.generateSecret();
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(secret),
      enabled_at: null,
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const code = totpGenerateSync({ secret });
    const r = await fetch(url("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
    assert.equal(body.was_pending, true);

    const row = pool._tables.mfa_secrets.find((x) => x.user_id === userId);
    assert.ok(row.enabled_at, "enabled_at must be set");

    const u = pool._tables.users.find((x) => x.user_id === userId);
    assert.equal(u.mfa_required, true, "mfa_required must flip on first verify");

    const audit = pool._tables.audit_log.find((e) => e.sql.includes("mfa.enabled"));
    assert.ok(audit, "audit_log must record mfa.enabled");
  });

  it("idempotent re-verify on already-enabled MFA returns was_pending=false", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const secret = mfaTotp.generateSecret();
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(secret),
      enabled_at: new Date(Date.now() - 60_000),
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const code = totpGenerateSync({ secret });
    const r = await fetch(url("/api/auth/mfa/verify"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.was_pending, false);
  });
});

describe("POST /api/auth/mfa/disable", () => {
  it("returns 404 when user has no enrolled MFA", async () => {
    const { jwt } = await loginAndGetJwt();
    const r = await fetch(url("/api/auth/mfa/disable"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });
    assert.equal(r.status, 404);
  });

  it("returns 401 on a wrong code (does NOT delete)", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const secret = mfaTotp.generateSecret();
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(secret),
      enabled_at: new Date(),
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const r = await fetch(url("/api/auth/mfa/disable"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });
    assert.equal(r.status, 401);
    assert.equal(pool._tables.mfa_secrets.length, 1, "row must remain on bad code");
  });

  it("deletes the secret and clears mfa_required on a valid code", async () => {
    const { jwt, userId } = await loginAndGetJwt();
    const secret = mfaTotp.generateSecret();
    pool._tables.mfa_secrets.push({
      user_id: userId,
      totp_secret_encrypted: mfaTotp.encryptSecret(secret),
      enabled_at: new Date(),
      last_used_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const u = pool._tables.users.find((x) => x.user_id === userId);
    u.mfa_required = true;

    const code = totpGenerateSync({ secret });
    const r = await fetch(url("/api/auth/mfa/disable"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    assert.equal(r.status, 200);

    assert.equal(pool._tables.mfa_secrets.length, 0, "secret row must be deleted");
    const u2 = pool._tables.users.find((x) => x.user_id === userId);
    assert.equal(u2.mfa_required, false, "mfa_required must clear");

    const audit = pool._tables.audit_log.find((e) => e.sql.includes("mfa.disabled"));
    assert.ok(audit, "audit_log must record mfa.disabled");
  });
});

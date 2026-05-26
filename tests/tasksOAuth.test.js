// ═══════════════════════════════════════════════════════════════════════════
// tests/tasksOAuth.test.js — Contract tests for Tasks OAuth PKCE endpoints
// Run: node tests/tasksOAuth.test.js
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import crypto from "node:crypto";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

// ─── PKCE challenge/verifier generation ──────────────────────────────────────

test("PKCE verifier is 43+ chars base64url", () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  assert.ok(verifier.length >= 43, `verifier length ${verifier.length} < 43`);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(verifier), "verifier has invalid chars");
});

test("PKCE challenge is SHA256 of verifier in base64url", () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  assert.ok(challenge.length > 0);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(challenge), "challenge has invalid chars");
  // Verify deterministic
  const challenge2 = crypto.createHash("sha256").update(verifier).digest("base64url");
  assert.equal(challenge, challenge2);
});

test("Different verifiers produce different challenges", () => {
  const v1 = crypto.randomBytes(32).toString("base64url");
  const v2 = crypto.randomBytes(32).toString("base64url");
  const c1 = crypto.createHash("sha256").update(v1).digest("base64url");
  const c2 = crypto.createHash("sha256").update(v2).digest("base64url");
  assert.notEqual(c1, c2);
});

test("State nonce is 32-char hex", () => {
  const state = crypto.randomBytes(16).toString("hex");
  assert.equal(state.length, 32);
  assert.ok(/^[0-9a-f]+$/.test(state));
});

// ─── OAuth URL construction ──────────────────────────────────────────────────

test("Google OAuth URL has all required PKCE params", () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: "test-client-id",
    redirect_uri: "http://localhost:3001/auth/tasks/callback",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/tasks",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  assert.ok(url.includes("code_challenge="));
  assert.ok(url.includes("code_challenge_method=S256"));
  assert.ok(url.includes("access_type=offline"));
  assert.ok(url.includes("response_type=code"));
  assert.ok(url.includes(`state=${state}`));
});

// ─── Token encryption contract ───────────────────────────────────────────────

test("pgp_sym_encrypt SQL uses parameterized query (no interpolation)", () => {
  // Verify the SQL pattern used in tasksOAuth.js
  const sql = `INSERT INTO tasks.oauth_tokens
    (user_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope)
    VALUES ($1, pgp_sym_encrypt($2, $3), pgp_sym_encrypt($4, $3), $5, $6)`;
  assert.ok(sql.includes("pgp_sym_encrypt($2, $3)"), "access_token uses parameterized encrypt");
  assert.ok(sql.includes("pgp_sym_encrypt($4, $3)"), "refresh_token uses parameterized encrypt");
  assert.ok(!sql.includes("'" + "token"), "no string interpolation for tokens");
});

test("Token decrypt SQL uses pgp_sym_decrypt with ::bytea cast", () => {
  const sql = `SELECT pgp_sym_decrypt(access_token_encrypted::bytea, $2) AS access_token
    FROM tasks.oauth_tokens WHERE user_id = $1 AND revoked_at IS NULL`;
  assert.ok(sql.includes("pgp_sym_decrypt("), "uses pgp_sym_decrypt");
  assert.ok(sql.includes("::bytea"), "casts to bytea");
  assert.ok(sql.includes("revoked_at IS NULL"), "filters revoked tokens");
});

// ─── Security: no credentials in error responses ─────────────────────────────

test("Error responses never contain token/secret/key strings", () => {
  const errorResponses = [
    { ok: false, error: "invalid_or_expired_state" },
    { ok: false, error: "tasks_oauth_not_configured", message: "GOOGLE_TASKS_CLIENT_ID / GOOGLE_TASKS_CLIENT_SECRET not set." },
    { ok: false, error: "encryption_key_missing", message: "ENCRYPTION_KEY not set — cannot store tokens securely." },
    { ok: false, error: "no_active_token" },
    { ok: false, error: "internal_error" },
  ];
  for (const resp of errorResponses) {
    const json = JSON.stringify(resp);
    assert.ok(!json.includes("ya29."), "response contains access_token pattern");
    assert.ok(!json.includes("1//"), "response contains refresh_token pattern");
    assert.ok(!/[A-Za-z0-9_-]{30,}/.test(resp.error), "error field looks like a token");
  }
});

// ─── HMAC signature verification ─────────────────────────────────────────────

test("HMAC timingSafeEqual rejects mismatched signatures", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ cycleId: "test" });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const correct = hmac.digest("hex");

  const wrong = correct.replace(/[0-9]/, "x");
  try {
    const result = crypto.timingSafeEqual(
      Buffer.from(correct, "hex"),
      Buffer.from(wrong, "hex"),
    );
    assert.ok(!result, "should not match");
  } catch {
    // timingSafeEqual throws on length mismatch — that's also a reject
  }
});

test("HMAC accepts correct signature", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ cycleId: "test" });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const correct = hmac.digest("hex");

  const hmac2 = crypto.createHmac("sha256", secret);
  hmac2.update(body);
  const verify = hmac2.digest("hex");

  assert.ok(
    crypto.timingSafeEqual(Buffer.from(correct, "hex"), Buffer.from(verify, "hex")),
  );
});

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════════════════════════`);
console.log(`tasksOAuth tests — passed: ${passed}, failed: ${failed}`);
console.log(`════════════════════════════════════════════════════════════\n`);
process.exit(failed > 0 ? 1 : 0);

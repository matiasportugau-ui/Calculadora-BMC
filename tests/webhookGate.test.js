import assert from "node:assert/strict";
import { shouldRejectWebhook, shouldRejectVerifyToken } from "../server/lib/webhookGate.js";

// ── shouldRejectWebhook (Gate 0: HMAC mandatory / fail-closed) ──────────────

// 1. Valid signature in production → allowed
assert.equal(
  shouldRejectWebhook({ verified: { ok: true }, appEnv: "production" }),
  false,
  "valid signature must be allowed",
);

// 2. Invalid signature in production → rejected
assert.equal(
  shouldRejectWebhook({ verified: { ok: false, reason: "length" }, appEnv: "production" }),
  true,
  "invalid signature must be rejected",
);

// 3. Missing secret (skipped) in production → rejected (fail-closed, mandatory)
assert.equal(
  shouldRejectWebhook({ verified: { ok: true, skipped: true }, appEnv: "production" }),
  true,
  "missing secret must fail closed in production",
);

// 4. Missing secret (skipped) in development → rejected (any non-test env)
assert.equal(
  shouldRejectWebhook({ verified: { ok: true, skipped: true }, appEnv: "development" }),
  true,
  "missing secret must fail closed in development",
);

// 5. Missing secret (skipped) in test env → allowed (offline suite bypass)
assert.equal(
  shouldRejectWebhook({ verified: { ok: true, skipped: true }, appEnv: "test" }),
  false,
  "test env bypasses signature enforcement",
);

// 6. Invalid signature in test env → still allowed (offline suite bypass)
assert.equal(
  shouldRejectWebhook({ verified: { ok: false }, appEnv: "test" }),
  false,
  "test env bypasses even invalid signatures",
);

// 7. Missing verified object in production → rejected (defensive)
assert.equal(
  shouldRejectWebhook({ verified: undefined, appEnv: "production" }),
  true,
  "absent verification result must fail closed",
);

// ── shouldRejectVerifyToken (Gate 0: verify token required) ─────────────────

// 8. Token configured + matching → allowed
assert.equal(
  shouldRejectVerifyToken({ expectedToken: "tok", receivedToken: "tok", appEnv: "production" }),
  false,
  "matching verify token must be allowed",
);

// 9. Token configured + mismatch → rejected
assert.equal(
  shouldRejectVerifyToken({ expectedToken: "tok", receivedToken: "nope", appEnv: "production" }),
  true,
  "mismatched verify token must be rejected",
);

// 10. Token NOT configured in production → rejected (fail-closed, mandatory)
assert.equal(
  shouldRejectVerifyToken({ expectedToken: "", receivedToken: "anything", appEnv: "production" }),
  true,
  "missing verify token must fail closed in production",
);

// 11. Token NOT configured in test env → allowed (offline suite bypass)
assert.equal(
  shouldRejectVerifyToken({ expectedToken: "", receivedToken: undefined, appEnv: "test" }),
  false,
  "test env bypasses verify token enforcement",
);

console.log("webhookGate tests OK (11/11)");

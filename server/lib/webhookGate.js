// ═══════════════════════════════════════════════════════════════════════════
// server/lib/webhookGate.js — Fail-closed webhook admission decisions (Gate 0)
// ───────────────────────────────────────────────────────────────────────────
// Pure decision helpers shared by the inbound webhook handlers in index.js.
// Gate 0 (Documento Maestro SDD §3) makes HMAC signature verification MANDATORY
// instead of optional: a missing secret must FAIL CLOSED in any non-test env,
// not silently skip. Kept as pure functions so they are unit-testable without
// booting the Express app (matches the mlSignature.js / whatsappSignature.js
// pattern). The `test` env bypass lets the offline suites run without secrets.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decide whether an inbound webhook must be rejected based on the result of a
 * signature verification helper (verifyMLSignature / verifyWhatsAppSignature).
 *
 *  - invalid / missing signature      → reject
 *  - secret not configured (skipped)  → reject (fail-closed) in any non-test env
 *  - test env                          → never reject (offline suites run sin secretos)
 *
 * @param {{ verified?: { ok?: boolean, skipped?: boolean, reason?: string }, appEnv?: string }} opts
 * @returns {boolean} true → the request must be rejected (401)
 */
export function shouldRejectWebhook({ verified, appEnv } = {}) {
  if (appEnv === "test") return false;
  if (!verified) return true;
  if (verified.skipped) return true; // mandatory: a missing secret is not a pass
  return verified.ok !== true;
}

/**
 * Decide whether an inbound webhook must be rejected for a missing/invalid
 * verify token (defence-in-depth Layer 2). Gate 0 makes the verify token
 * REQUIRED outside the test env.
 *
 *  - test env                  → never reject
 *  - token not configured      → reject (fail-closed: the secret must exist in prod)
 *  - configured but mismatched → reject
 *
 * @param {{ expectedToken?: string, receivedToken?: unknown, appEnv?: string }} opts
 * @returns {boolean} true → the request must be rejected (401)
 */
export function shouldRejectVerifyToken({ expectedToken, receivedToken, appEnv } = {}) {
  if (appEnv === "test") return false;
  if (!expectedToken) return true; // mandatory: token must be provisioned
  return String(receivedToken ?? "") !== String(expectedToken);
}

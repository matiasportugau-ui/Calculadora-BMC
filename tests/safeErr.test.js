/**
 * Identity/quote wire-error scrubber.
 * Run: node tests/safeErr.test.js
 *
 * Dedicated pin so we do not depend on the flaky identity-security suite.
 * A regression here leaks pg constraint / host details to authenticated callers.
 */
import { safeErr, isKnownErr } from "../server/lib/safeErr.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— known sentinels pass through");
for (const code of [
  "db_unavailable",
  "not_found",
  "missing_payload",
  "invalid_pdf_url",
  "invalid_gcs_uri",
  "userId_or_clientQuoteId_required",
  "quote_not_eligible",
  "rate_limited",
]) {
  assert(safeErr({ message: code }) === code, code);
  assert(isKnownErr(code) === true, `isKnownErr(${code})`);
}

console.log("\n— unexpected / pg messages are masked");
assert(
  safeErr({ message: 'duplicate key value violates unique constraint "identity.users_email_key"' }) === "internal_error",
  "pg unique constraint",
);
assert(safeErr({ message: "ECONNREFUSED 127.0.0.1:5432" }) === "internal_error", "ECONNREFUSED host:port");
assert(safeErr(new Error('relation "identity.quotes" does not exist')) === "internal_error", "missing relation");
assert(safeErr({}) === "internal_error", "empty object");
assert(safeErr(undefined) === "internal_error", "undefined");
assert(safeErr(null) === "internal_error", "null");
assert(isKnownErr("duplicate key value") === false, "raw pg text is not a known code");

console.log(`\nsafeErr: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

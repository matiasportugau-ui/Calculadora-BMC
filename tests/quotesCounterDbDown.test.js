// ═══════════════════════════════════════════════════════════════════════════
// tests/quotesCounterDbDown.test.js — quote counter must degrade to 503, not 500
//
// Regression: GET/POST /api/quotes/counter threw 500 when Postgres was
// unreachable (ECONNREFUSED). Project convention: backend-store unavailable
// is 503, never 500. We unit-test the error classifier that drives that.
//
// Run: node tests/quotesCounterDbDown.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { isDbUnavailable } from "../server/routes/quotes.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

// ── connectivity errors → treated as DB-down (caller returns 503) ───────────
assert(isDbUnavailable({ code: "ECONNREFUSED" }), "ECONNREFUSED code → unavailable");
assert(isDbUnavailable({ code: "ETIMEDOUT" }), "ETIMEDOUT code → unavailable");
assert(isDbUnavailable({ code: "ENOTFOUND" }), "ENOTFOUND code → unavailable");
assert(isDbUnavailable({ code: "57P03" }), "57P03 cannot_connect_now → unavailable");
assert(isDbUnavailable({ code: "08006" }), "08006 connection_failure → unavailable");
assert(
  isDbUnavailable({ message: "connect ECONNREFUSED 127.0.0.1:5432" }),
  "ECONNREFUSED in message → unavailable",
);
assert(
  isDbUnavailable({ message: "Connection terminated unexpectedly" }),
  "Connection terminated → unavailable",
);

// ── genuine query errors → NOT db-down (caller returns 500) ─────────────────
assert(!isDbUnavailable({ code: "42601", message: "syntax error at or near" }), "SQL syntax error → not unavailable");
assert(!isDbUnavailable({ code: "23505", message: "duplicate key value" }), "unique violation → not unavailable");
assert(!isDbUnavailable(null), "null err → not unavailable");
assert(!isDbUnavailable({}), "empty err → not unavailable");

console.log(`\n${failed === 0 ? "✅" : "❌"} quotesCounterDbDown: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

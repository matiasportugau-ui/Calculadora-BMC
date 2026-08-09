// Finanzas module password gate — unit tests (no DB, no network).
// Run: node tests/finanzas-unlock.test.js

import {
  isFinanzasGateEnabled,
  shouldBypassFinanzasUnlock,
  verifyFinanzasPassword,
} from "../server/lib/finanzasUnlock.js";

let passed = 0;
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
    failed++;
  }
}

const testSecret = process.env.FINANZAS_MODULE_PASSWORD_TEST || "test-secret-only";

assert("verifyFinanzasPassword: correct", verifyFinanzasPassword(testSecret, testSecret));
assert("verifyFinanzasPassword: wrong", !verifyFinanzasPassword("wrong", testSecret));
assert("verifyFinanzasPassword: empty input", !verifyFinanzasPassword("", testSecret));
assert("verifyFinanzasPassword: empty secret", !verifyFinanzasPassword(testSecret, ""));

assert(
  "gate disabled in development",
  !isFinanzasGateEnabled({ appEnv: "development" }),
);
assert(
  "gate enabled in production",
  isFinanzasGateEnabled({ appEnv: "production" }),
);

assert(
  "dev bypasses unlock",
  shouldBypassFinanzasUnlock({ user: { role: "operator" } }, { appEnv: "development" }),
);
assert(
  "superadmin bypasses in prod",
  shouldBypassFinanzasUnlock({ user: { role: "superadmin" } }, { appEnv: "production" }),
);
assert(
  "operator does not bypass in prod",
  !shouldBypassFinanzasUnlock({ user: { role: "operator" } }, { appEnv: "production" }),
);

console.log(`\nfinanzas-unlock: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

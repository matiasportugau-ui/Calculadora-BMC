// Offline unit tests for operator API client helpers.
// Run: node tests/operatorApiClient.test.js
import assert from "node:assert/strict";
import {
  resolveApiKeyFromEnv,
  resolveApiKeyFromStorage,
  COCKPIT_TOKEN_KEY,
  setOperatorJwtGetter,
  setOperatorJwtRefresh,
  ensureOperatorToken,
  ensureIdentityJwt,
  refreshIdentityJwt,
  _resetRefreshInFlightForTests,
} from "../src/utils/operatorApiClient.js";

let pass = 0;
let fail = 0;
async function t(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("operatorApiClient — pure helpers");

await t("resolveApiKeyFromEnv prefers VITE_API_AUTH_TOKEN then VITE_BMC_API_AUTH_TOKEN", () => {
  assert.equal(resolveApiKeyFromEnv({}), "");
  assert.equal(resolveApiKeyFromEnv({ VITE_BMC_API_AUTH_TOKEN: "bmc" }), "bmc");
  assert.equal(
    resolveApiKeyFromEnv({ VITE_API_AUTH_TOKEN: "api", VITE_BMC_API_AUTH_TOKEN: "bmc" }),
    "api"
  );
});

await t("resolveApiKeyFromStorage reads bmc_cockpit_token", () => {
  const bag = new Map();
  bag.set(COCKPIT_TOKEN_KEY, "stored-token");
  assert.equal(resolveApiKeyFromStorage((k) => bag.get(k)), "stored-token");
  assert.equal(resolveApiKeyFromStorage(() => { throw new Error("no storage"); }), "");
});

await t("ensureOperatorToken prefers JWT getter over storage", async () => {
  setOperatorJwtGetter(() => "jwt-from-auth");
  assert.equal(await ensureOperatorToken(), "jwt-from-auth");
  setOperatorJwtGetter(() => "");
});

await t("ensureIdentityJwt uses JWT getter only (no cockpit fallback)", async () => {
  setOperatorJwtGetter(() => "jwt-only");
  assert.equal(await ensureIdentityJwt(), "jwt-only");
  setOperatorJwtGetter(() => "");
  assert.equal(await ensureIdentityJwt(), "");
});

await t("refreshIdentityJwt single-flights concurrent callers", async () => {
  _resetRefreshInFlightForTests();
  let calls = 0;
  setOperatorJwtRefresh(async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 30));
    return "fresh-jwt";
  });
  const [a, b, c] = await Promise.all([
    refreshIdentityJwt(),
    refreshIdentityJwt(),
    refreshIdentityJwt(),
  ]);
  assert.equal(calls, 1, "expected one refresh call for three waiters");
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(c, true);
  assert.equal(await ensureIdentityJwt(), "fresh-jwt");
  setOperatorJwtRefresh(async () => false);
  setOperatorJwtGetter(() => "");
  _resetRefreshInFlightForTests();
});

await t("refreshIdentityJwt sequential after in-flight clears", async () => {
  _resetRefreshInFlightForTests();
  let calls = 0;
  setOperatorJwtRefresh(async () => {
    calls += 1;
    return true;
  });
  assert.equal(await refreshIdentityJwt(), true);
  assert.equal(await refreshIdentityJwt(), true);
  assert.equal(calls, 2);
  setOperatorJwtRefresh(async () => false);
  _resetRefreshInFlightForTests();
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);
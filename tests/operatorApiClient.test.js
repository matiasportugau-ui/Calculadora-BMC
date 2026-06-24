// Offline unit tests for operator API client helpers.
// Run: node tests/operatorApiClient.test.js
import assert from "node:assert/strict";
import {
  resolveApiKeyFromEnv,
  resolveApiKeyFromStorage,
  resolveCockpitToken,
  mapCockpitAuthError,
  COCKPIT_TOKEN_KEY,
  setOperatorJwtGetter,
  ensureOperatorToken,
} from "../src/utils/operatorApiClient.js";

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("operatorApiClient — pure helpers");

t("resolveApiKeyFromEnv prefers VITE_API_AUTH_TOKEN then VITE_BMC_API_AUTH_TOKEN", () => {
  assert.equal(resolveApiKeyFromEnv({}), "");
  assert.equal(resolveApiKeyFromEnv({ VITE_BMC_API_AUTH_TOKEN: "bmc" }), "bmc");
  assert.equal(
    resolveApiKeyFromEnv({ VITE_API_AUTH_TOKEN: "api", VITE_BMC_API_AUTH_TOKEN: "bmc" }),
    "api"
  );
});

t("resolveApiKeyFromStorage reads bmc_cockpit_token", () => {
  const bag = new Map();
  bag.set(COCKPIT_TOKEN_KEY, "stored-token");
  assert.equal(resolveApiKeyFromStorage((k) => bag.get(k)), "stored-token");
  assert.equal(resolveApiKeyFromStorage(() => { throw new Error("no storage"); }), "");
});

t("ensureOperatorToken prefers JWT getter over storage", async () => {
  setOperatorJwtGetter(() => "jwt-from-auth");
  assert.equal(await ensureOperatorToken(), "jwt-from-auth");
  setOperatorJwtGetter(() => "");
});

t("resolveCockpitToken prefers identity JWT when authenticated with grant", () => {
  assert.equal(
    resolveCockpitToken({
      isAuthenticated: true,
      hasGrant: true,
      jwtToken: "jwt-live",
      envToken: "stale-env",
      overrideToken: "stale-override",
    }),
    "jwt-live",
  );
  assert.equal(
    resolveCockpitToken({
      isAuthenticated: true,
      hasGrant: true,
      jwtToken: "",
      envToken: "stale-env",
    }),
    "",
  );
});

t("resolveCockpitToken falls back to env when anonymous", () => {
  assert.equal(
    resolveCockpitToken({ isAuthenticated: false, envToken: "dev-key" }),
    "dev-key",
  );
});

t("mapCockpitAuthError maps missing_credentials to Spanish guidance", () => {
  const msg = mapCockpitAuthError("missing_credentials", 401);
  assert.match(msg, /Sesión expirada/i);
  assert.doesNotMatch(msg, /missing_credentials/);
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);
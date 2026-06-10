// Offline unit tests for the central API client pure helpers.
// Run: node tests/apiClient.test.js
import assert from "node:assert/strict";
import {
  apiGet,
  apiPost,
  apiUrl,
  isEmptyPayload,
  ApiError,
  resolveApiKeyFromEnv,
  resolveApiKeyFromStorage,
  COCKPIT_TOKEN_KEY,
} from "../src/utils/apiClient.js";

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

async function ta(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("apiClient — pure helpers");

// apiUrl: absolute URLs pass through unchanged
t("apiUrl passes absolute http(s) URLs through", () => {
  assert.equal(apiUrl("https://example.com/x"), "https://example.com/x");
  assert.equal(apiUrl("http://api.test/y"), "http://api.test/y");
});

// apiUrl: relative paths get a leading slash and base prefix (base is "" or localhost in node)
t("apiUrl prefixes relative paths with a single leading slash", () => {
  const withSlash = apiUrl("/api/foo");
  const withoutSlash = apiUrl("api/foo");
  assert.ok(withSlash.endsWith("/api/foo"), `got ${withSlash}`);
  assert.ok(withoutSlash.endsWith("/api/foo"), `got ${withoutSlash}`);
  // no double slash introduced before the path
  assert.ok(!/[^:]\/\/api\/foo$/.test(withSlash), `double slash in ${withSlash}`);
});

// isEmptyPayload: the 200-empty contract
t("isEmptyPayload treats null/empty string/[]/{} as empty", () => {
  assert.equal(isEmptyPayload(null), true);
  assert.equal(isEmptyPayload(undefined), true);
  assert.equal(isEmptyPayload(""), true);
  assert.equal(isEmptyPayload("   "), true);
  assert.equal(isEmptyPayload([]), true);
  assert.equal(isEmptyPayload({}), true);
});

t("isEmptyPayload treats real data as non-empty", () => {
  assert.equal(isEmptyPayload([1]), false);
  assert.equal(isEmptyPayload({ a: 1 }), false);
  assert.equal(isEmptyPayload("data"), false);
  assert.equal(isEmptyPayload(0), false);
  assert.equal(isEmptyPayload(false), false);
});

// ApiError: 503 → service unavailable contract
t("ApiError flags 503 as service unavailable", () => {
  const e = new ApiError("down", { status: 503 });
  assert.equal(e.isServiceUnavailable, true);
  assert.equal(e.isTimeout, false);
  assert.equal(e.isNetwork, false);
  assert.equal(e.name, "ApiError");
});

t("ApiError distinguishes timeout and network kinds", () => {
  const timeout = new ApiError("slow", { kind: "timeout" });
  const network = new ApiError("offline", { kind: "network" });
  assert.equal(timeout.isTimeout, true);
  assert.equal(network.isNetwork, true);
  assert.equal(timeout.isServiceUnavailable, false);
});

t("ApiError carries status and data payload", () => {
  const e = new ApiError("bad", { status: 422, data: { error: "invalid" } });
  assert.equal(e.status, 422);
  assert.deepEqual(e.data, { error: "invalid" });
});

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

function installBrowserAuthMocks({ token = "runtime-token" } = {}) {
  const hadFetch = "fetch" in globalThis;
  const previousFetch = globalThis.fetch;
  const hadLocalStorage = "localStorage" in globalThis;
  const previousLocalStorage = globalThis.localStorage;
  const writes = [];
  const calls = [];

  globalThis.localStorage = {
    getItem: () => "",
    setItem: (key, value) => writes.push({ key, value }),
  };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const body = String(url).includes("/api/crm/cockpit-token")
      ? { ok: true, token }
      : { ok: true, path: String(url), headers: init.headers || {} };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    calls,
    writes,
    restore() {
      if (hadFetch) globalThis.fetch = previousFetch;
      else delete globalThis.fetch;
      if (hadLocalStorage) globalThis.localStorage = previousLocalStorage;
      else delete globalThis.localStorage;
    },
  };
}

await ta("public apiGet does not fetch or store the cockpit token", async () => {
  const mock = installBrowserAuthMocks();
  try {
    const { data } = await apiGet("/capabilities");
    assert.equal(data.ok, true);
    assert.equal(mock.calls.length, 1);
    assert.ok(!mock.calls[0].url.includes("/api/crm/cockpit-token"), mock.calls[0].url);
    assert.equal(mock.calls[0].init.headers?.["x-api-key"], undefined);
    assert.equal(mock.calls[0].init.headers?.Authorization, undefined);
    assert.deepEqual(mock.writes, []);
  } finally {
    mock.restore();
  }
});

await ta("requireApiKey requests fetch, store, and attach the cockpit token", async () => {
  const mock = installBrowserAuthMocks({ token: "runtime-token" });
  try {
    const { data } = await apiPost("/api/team-assist/chat", { messages: [] }, { requireApiKey: true });
    assert.equal(data.ok, true);
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls[0].url.includes("/api/crm/cockpit-token"), mock.calls[0].url);
    assert.ok(mock.calls[1].url.endsWith("/api/team-assist/chat"), mock.calls[1].url);
    assert.equal(mock.calls[1].init.headers["x-api-key"], "runtime-token");
    assert.equal(mock.calls[1].init.headers.Authorization, "Bearer runtime-token");
    assert.deepEqual(mock.writes, [{ key: COCKPIT_TOKEN_KEY, value: "runtime-token" }]);
  } finally {
    mock.restore();
  }
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);

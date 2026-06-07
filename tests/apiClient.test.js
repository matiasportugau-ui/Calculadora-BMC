// Offline unit tests for the central API client pure helpers.
// Run: node tests/apiClient.test.js
import assert from "node:assert/strict";
import { apiUrl, isEmptyPayload, ApiError } from "../src/utils/apiClient.js";
import {
  fetchTeamAssistChat,
  TEAM_ASSIST_CHAT_TIMEOUT_MS,
} from "../src/utils/teamAssistApi.js";

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

async function tAsync(name, fn) {
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

await tAsync("fetchTeamAssistChat waits beyond the server OpenAI timeout", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const captured = {};

  globalThis.setTimeout = (_fn, ms) => {
    captured.timeoutMs = ms;
    return { mockedTimer: true };
  };
  globalThis.clearTimeout = (timer) => {
    captured.clearedTimer = timer;
  };
  globalThis.fetch = async (url, init) => {
    captured.url = String(url);
    captured.init = init;
    return new Response(JSON.stringify({ ok: true, reply: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const data = await fetchTeamAssistChat({
      agentId: "orchestrator",
      messages: [{ role: "user", content: "hola" }],
    });

    assert.equal(data.reply, "ok");
    assert.ok(TEAM_ASSIST_CHAT_TIMEOUT_MS > 30_000);
    assert.equal(captured.timeoutMs, TEAM_ASSIST_CHAT_TIMEOUT_MS);
    assert.ok(captured.url.endsWith("/api/team-assist/chat"), `got ${captured.url}`);
    assert.equal(captured.init.method, "POST");
    assert.ok(captured.init.signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);

// ═══════════════════════════════════════════════════════════════════════════
// API tests for /api/agent/speak* (local Apple TTS — Diego es-AR)
//
// Run: node tests/agentSpeak.test.js
//
// Strategy:
// - Mount only the agentSpeak router on an ephemeral Express app
// - BMC_APPLE_TTS=0 → no binary is ever compiled/spawned (offline-safe)
// - BMC_APPLE_TTS_PLATFORM overrides the darwin guard so both sides of the
//   platform check are testable on any OS
// - config.apiAuthToken mutation for the static-token auth path
//   (identity-JWT path is covered by tests/identity-auth.test.js)
// ═══════════════════════════════════════════════════════════════════════════

import http from "node:http";
import express from "express";

process.env.BMC_APPLE_TTS = "0";
process.env.BMC_APPLE_TTS_PLATFORM = "darwin";

const { default: agentSpeakRouter } = await import("../server/routes/agentSpeak.js");
const { config: testConfig } = await import("../server/config.js");

const TEST_TOKEN = "test-static-token-" + "A".repeat(24);
testConfig.apiAuthToken = TEST_TOKEN;

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const app = express();
app.use("/api", agentSpeakRouter);

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

const authHeaders = { Authorization: `Bearer ${TEST_TOKEN}` };

await group("auth required (401 without credentials)", async () => {
  const st = await fetch(`${BASE}/api/agent/speak/status`);
  assert(st.status === 401, `status GET is 401 without creds (got ${st.status})`);

  const speak = await fetch(`${BASE}/api/agent/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hola" }),
  });
  assert(speak.status === 401, `speak POST is 401 without creds (got ${speak.status})`);

  const install = await fetch(`${BASE}/api/agent/speak/install`, { method: "POST" });
  assert(install.status === 401, `install POST is 401 without creds (got ${install.status})`);
});

await group("static token accepted", async () => {
  const st = await fetch(`${BASE}/api/agent/speak/status`, { headers: authHeaders });
  const body = await st.json();
  assert(st.status === 200, `status GET is 200 with Bearer token (got ${st.status})`);
  assert(body.ok === true, "status body ok:true");
  assert(body.argentina_installed === false, "argentina_installed false with BMC_APPLE_TTS=0");

  const stKey = await fetch(`${BASE}/api/agent/speak/status`, {
    headers: { "X-Api-Key": TEST_TOKEN },
  });
  assert(stKey.status === 200, `status GET accepts X-Api-Key (got ${stKey.status})`);
});

await group("speak validation + disabled binary", async () => {
  const empty = await fetch(`${BASE}/api/agent/speak`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });
  assert(empty.status === 400, `empty text is 400 (got ${empty.status})`);

  const off = await fetch(`${BASE}/api/agent/speak`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hola Diego" }),
  });
  assert(off.status === 503, `BMC_APPLE_TTS=0 speak is 503 (got ${off.status})`);
});

await group("darwin guard (404 on non-macOS even with token)", async () => {
  process.env.BMC_APPLE_TTS_PLATFORM = "linux";
  try {
    const st = await fetch(`${BASE}/api/agent/speak/status`, { headers: authHeaders });
    assert(st.status === 404, `status GET is 404 off-darwin (got ${st.status})`);

    const speak = await fetch(`${BASE}/api/agent/speak`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hola" }),
    });
    assert(speak.status === 404, `speak POST is 404 off-darwin (got ${speak.status})`);

    const install = await fetch(`${BASE}/api/agent/speak/install`, {
      method: "POST",
      headers: authHeaders,
    });
    assert(install.status === 404, `install POST is 404 off-darwin (got ${install.status})`);
  } finally {
    process.env.BMC_APPLE_TTS_PLATFORM = "darwin";
  }
});

server.close();

console.log(`\n${failed === 0 ? "✅" : "❌"} agentSpeak routes: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

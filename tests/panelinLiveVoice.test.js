// Offline API tests for /api/agent/voice/* (Panelin Live backend path)
// Run: node tests/panelinLiveVoice.test.js

import http from "node:http";
import express from "express";

process.env.PUBLIC_BASE_URL = "http://localhost:3001";
process.env.API_AUTH_TOKEN = "panelin-live-test-token";
process.env.OPENAI_API_KEY = "sk-test-" + "x".repeat(40);

const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { config } = await import("../server/config.js");

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

const app = express();
app.use(express.json());
app.use("/api", agentVoiceRouter);

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.openai.com/v1/realtime/client_secrets")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "ek_test_secret",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        session: {
          id: "sess_test_123",
          model: config.openaiRealtimeModel,
        },
      }),
    };
  }
  if (String(url).includes("api.openai.com/v1/models")) {
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  }
  return realFetch(url, init);
};

async function req(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer panelin-live-test-token",
      ...(init.headers || {}),
    },
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json };
}

console.log("\n— panelinLiveVoice");

const health = await req("/api/agent/voice/health");
assert(health.status === 200 && health.json?.ok === true, "GET voice/health → 200 ok");

const noKey = config.openaiApiKey;
config.openaiApiKey = "";
const noKeySess = await req("/api/agent/voice/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
config.openaiApiKey = noKey;
assert(noKeySess.status === 503, "POST voice/session without OpenAI key → 503");

const sess = await req("/api/agent/voice/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ calcState: { scenario: "techo" } }),
});
assert(
  sess.status === 200 && sess.json?.client_secret?.value === "ek_test_secret",
  "POST voice/session → client_secret.value",
);

const unauth = await fetch(`${BASE}/api/agent/voice/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert(unauth.status === 401, "POST voice/session without token → 401");

server.close();
globalThis.fetch = realFetch;

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
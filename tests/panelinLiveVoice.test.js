// Offline API tests for /api/agent/voice/* (Panelin Live backend path)
// Run: node tests/panelinLiveVoice.test.js

import http from "node:http";
import express from "express";

process.env.PUBLIC_BASE_URL = "http://localhost:3001";
process.env.API_AUTH_TOKEN = "panelin-live-test-token";
// Avoid isUsableApiKey placeholder patterns (…-test-… is rejected)
process.env.OPENAI_API_KEY = "sk-proj-" + "x".repeat(40);
process.env.GROK_API_KEY = "xai-" + "y".repeat(48);

const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { config } = await import("../server/config.js");
const { buildVoiceSystemPrompt } = await import("../server/lib/chatPrompts.js");

// Ensure config sees Grok key (config may have been loaded before env set in other runs)
if (!config.grokApiKey) config.grokApiKey = process.env.GROK_API_KEY;

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

let lastMintInstructions = null;
let lastMintUrl = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  lastMintUrl = u;
  if (u.includes("api.openai.com/v1/realtime/client_secrets")) {
    try {
      lastMintInstructions = JSON.parse(init?.body || "{}")?.session?.instructions ?? null;
    } catch {
      lastMintInstructions = null;
    }
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
  if (u.includes("api.x.ai/v1/realtime/client_secrets")) {
    try {
      const body = JSON.parse(init?.body || "{}");
      // Grok mint must be expires_after only (no nested session)
      lastMintInstructions = body?.session?.instructions ?? null;
    } catch {
      lastMintInstructions = null;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "xai-ek_test_secret",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        id: "grok_sess_test",
        model: "grok-voice-latest",
      }),
    };
  }
  if (u.includes("api.openai.com/v1/models")) {
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
assert(sess.json?.provider === "openai" || sess.json?.voice_provider === "openai", "default provider openai");
assert(
  typeof sess.json?.realtime_base === "string" &&
    new URL(sess.json.realtime_base).hostname === "api.openai.com",
  "default realtime_base is OpenAI",
);
assert(sess.json?.session_bootstrap == null, "OpenAI path has no session_bootstrap");

// Grok Voice Agent mint
const grokSess = await req("/api/agent/voice/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ calcState: { scenario: "techo" }, aiProvider: "grok" }),
});
assert(
  grokSess.status === 200 && grokSess.json?.client_secret?.value === "xai-ek_test_secret",
  "POST voice/session aiProvider=grok → xAI client_secret",
);
assert(
  grokSess.json?.provider === "grok" &&
    new URL(String(grokSess.json?.realtime_base || "")).hostname === "api.x.ai",
  "Grok response has provider + xAI realtime_base",
);
assert(
  grokSess.json?.session_bootstrap?.instructions &&
    Array.isArray(grokSess.json?.session_bootstrap?.tools),
  "Grok response includes session_bootstrap (instructions + tools)",
);
assert(
  new URL(String(lastMintUrl || "http://invalid.local")).hostname === "api.x.ai",
  "Grok mint hits api.x.ai client_secrets",
);

const noGrokKey = config.grokApiKey;
config.grokApiKey = "";
const noGrokSess = await req("/api/agent/voice/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ aiProvider: "grok" }),
});
config.grokApiKey = noGrokKey;
assert(noGrokSess.status === 503, "POST voice/session grok without GROK key → 503");

const unauth = await fetch(`${BASE}/api/agent/voice/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert(unauth.status === 401, "POST voice/session without token → 401");

// leadContext (CRM sheet hyperlink) is threaded into the minted instructions.
const leadSess = await req("/api/agent/voice/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    calcState: { scenario: "techo" },
    leadContext: { quoteId: "BMC-2026-0007", cliente: "Ferretería Sur", consulta: "Necesito techo 10x20 con aislación" },
  }),
});
assert(leadSess.status === 200, "POST voice/session with leadContext → 200");
assert(
  typeof lastMintInstructions === "string" && lastMintInstructions.includes("CONTEXTO DEL LEAD"),
  "leadContext → instructions include 'CONTEXTO DEL LEAD'",
);
assert(
  lastMintInstructions.includes("Ferretería Sur") && lastMintInstructions.includes("techo 10x20"),
  "leadContext → instructions include cliente + consulta text",
);

// Unit: buildVoiceSystemPrompt lead block present + 800-char cap.
const cappedPrompt = buildVoiceSystemPrompt(
  {},
  { leadContext: { cliente: "X", consulta: "A".repeat(1200) } },
);
assert(cappedPrompt.includes("CONTEXTO DEL LEAD"), "buildVoiceSystemPrompt → lead block present");
assert(!cappedPrompt.includes("A".repeat(801)), "buildVoiceSystemPrompt → consulta capped ≤ 800 chars");

// Unit: injection neutralization (short consulta so it survives the cap).
const injPrompt = buildVoiceSystemPrompt(
  {},
  { leadContext: { cliente: "X", consulta: "hola ${process.env.SECRET} texto" } },
);
assert(!injPrompt.includes("${process.env.SECRET}"), "buildVoiceSystemPrompt → template-injection neutralized");

assert(
  buildVoiceSystemPrompt({}, {}).indexOf("CONTEXTO DEL LEAD") === -1,
  "buildVoiceSystemPrompt → no lead block when leadContext absent",
);

server.close();
globalThis.fetch = realFetch;

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
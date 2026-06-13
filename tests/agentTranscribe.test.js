// ═══════════════════════════════════════════════════════════════════════════
// API tests for POST /api/agent/transcribe (Whisper-backed dictation)
//
// Run: node tests/agentTranscribe.test.js
//
// Strategy:
// - Mount only the transcribe router on an ephemeral Express app
// - Stub global fetch to mock the OpenAI Whisper API
// - Mutate config.openaiApiKey to control the no-key error path
// - Send raw audio bodies (Buffer) with audio/* Content-Type
// ═══════════════════════════════════════════════════════════════════════════

import http from "node:http";
import express from "express";

process.env.PUBLIC_BASE_URL = "http://localhost:3001";
const MOCK_KEY = "secret-prefix-" + "A".repeat(40);

// Ensure OPENAI_API_KEY is set so we can also test no-key path by mutation
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || MOCK_KEY;

const { default: agentTranscribeRouter } = await import("../server/routes/agentTranscribe.js");
const { config: testConfig } = await import("../server/config.js");
testConfig.openaiApiKey = MOCK_KEY;

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const app = express();
app.use("/api", agentTranscribeRouter);

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

// ── fetch stub for OpenAI Whisper API ────────────────────────────────────────

const realFetch = globalThis.fetch;
let upstreamHandler = async (_url, _init) => ({
  status: 200,
  body: { text: "Hola Panelin", duration: 1.5 },
});
function setUpstream(handler) { upstreamHandler = handler; }
globalThis.fetch = async (url, init) => {
  if (String(url).includes("api.openai.com/v1/audio/transcriptions")) {
    const r = await upstreamHandler(String(url), init || {});
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: () => "application/json" },
      json: async () => r.body,
      text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    };
  }
  return realFetch(url, init);
};

async function postAudio(path, audioBytes, headers = {}) {
  const body = audioBytes instanceof Buffer ? audioBytes : Buffer.from(audioBytes || []);
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/webm",
      "Content-Length": String(body.length),
      ...headers,
    },
    body,
  });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

await group("happy path — webm → Whisper → text", async () => {
  setUpstream(async (_url, init) => {
    // Verify multipart body forwards correctly: looking for the model field
    // Multipart bodies are opaque here (FormData → fetch builds the boundary).
    // We just assert authorization header is present.
    const auth = init?.headers?.Authorization || init?.headers?.authorization;
    assert(typeof auth === "string" && auth.startsWith("Bearer "), "forwards Bearer authorization to Whisper");
    return { status: 200, body: { text: "Cotizame doscientos metros de techo", duration: 2.3 } };
  });
  // 2 KB of zero bytes is enough to pass our >=1024 byte guard
  const audio = Buffer.alloc(2048);
  const { status, body } = await postAudio("/api/agent/transcribe", audio);
  assert(status === 200, `200 OK (got ${status})`);
  assert(body?.ok === true, "ok true");
  assert(body?.text === "Cotizame doscientos metros de techo", "text returned");
  assert(body?.language === "es", "default language es");
  assert(body?.duration_ms === 2300, "duration_ms = round(duration*1000)");
});

await group("respects ?language query param", async () => {
  setUpstream(async () => ({ status: 200, body: { text: "Quote me 200 m² of roof", duration: 1.8 } }));
  const audio = Buffer.alloc(2048);
  const resp = await fetch(`${BASE}/api/agent/transcribe?language=en`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: audio,
  });
  const body = await resp.json();
  assert(resp.status === 200, "200 OK");
  assert(body.language === "en", "language echoed as en");
});

await group("rejects too-short audio", async () => {
  const tiny = Buffer.alloc(500); // < 1024 byte guard
  const { status, body } = await postAudio("/api/agent/transcribe", tiny);
  assert(status === 400, `400 (got ${status})`);
  assert(typeof body.error === "string" && body.error.includes("corto"), "error mentions length");
});

await group("rejects empty body", async () => {
  const { status, body } = await postAudio("/api/agent/transcribe", Buffer.alloc(0));
  assert(status === 400, `400 (got ${status})`);
  assert(typeof body.error === "string", "error string present");
});

await group("rejects unsupported Content-Type", async () => {
  const audio = Buffer.alloc(2048);
  const resp = await fetch(`${BASE}/api/agent/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: audio,
  });
  // Note: express.raw type filter rejects non-audio; body comes through as undefined.
  // The route's "Audio body requerido" guard fires.
  assert(resp.status === 400 || resp.status === 415, `400/415 (got ${resp.status})`);
});

await group("rejects malformed language code", async () => {
  const audio = Buffer.alloc(2048);
  const resp = await fetch(`${BASE}/api/agent/transcribe?language=español`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: audio,
  });
  assert(resp.status === 400, `400 (got ${resp.status})`);
});

await group("Whisper API error → 502", async () => {
  setUpstream(async () => ({ status: 500, body: "internal server error" }));
  const audio = Buffer.alloc(2048);
  const { status, body } = await postAudio("/api/agent/transcribe", audio);
  assert(status === 502, `502 (got ${status})`);
  assert(typeof body.error === "string" && body.error.includes("500"), "error mentions upstream status");
});

await group("Whisper 401 (key invalid) → 503 (config error)", async () => {
  setUpstream(async () => ({ status: 401, body: "invalid api key" }));
  const audio = Buffer.alloc(2048);
  const { status } = await postAudio("/api/agent/transcribe", audio);
  assert(status === 503, `503 (got ${status})`);
});

await group("no API key configured → 503", async () => {
  testConfig.openaiApiKey = "";
  const audio = Buffer.alloc(2048);
  const { status, body } = await postAudio("/api/agent/transcribe", audio);
  assert(status === 503, `503 (got ${status})`);
  assert(typeof body.error === "string" && body.error.includes("OPENAI_API_KEY"), "error mentions OPENAI_API_KEY");
  testConfig.openaiApiKey = MOCK_KEY; // restore
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

server.close();
globalThis.fetch = realFetch;

console.log(`\n${"═".repeat(60)}`);
console.log(`agentTranscribe tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);

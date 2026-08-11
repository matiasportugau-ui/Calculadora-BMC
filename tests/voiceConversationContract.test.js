// tests/voiceConversationContract.test.js
// Contract for "operator can hold a voice conversation with Panelin":
// dual mint shape, SDP URL from server realtime_base, shell/CSP wiring,
// voice/action relay. Drives real modules — no hardcoded expected mint secrets.
//
// Run: node tests/voiceConversationContract.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";

import {
  resolveVoiceProvider,
  mintRealtimeClientSecret,
  XAI_REALTIME_BASE,
  OPENAI_REALTIME_BASE,
} from "../server/lib/voiceRealtimeProviders.js";
import {
  resolveSdpEndpoint,
  resolveLiveVoiceEngine,
  DEFAULT_REALTIME_SDP_BASE,
} from "../src/utils/resolveSdpEndpoint.js";
import {
  buildGrokRealtimeWsUrl,
  usesGrokWebSocketTransport,
} from "../src/utils/grokRealtimeTransport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— voiceConversationContract\n");

// ── 1. Engine mapping (chat selector → Live duplex) ───────────────────────
ok(resolveVoiceProvider("grok") === "grok", "resolveVoiceProvider(grok) → grok");
ok(resolveVoiceProvider("auto") === "openai", "resolveVoiceProvider(auto) → openai");
ok(resolveLiveVoiceEngine("grok") === "grok", "resolveLiveVoiceEngine(grok) → grok");
ok(resolveLiveVoiceEngine("claude") === "openai", "claude Live defaults openai");

// ── 2. OpenAI SDP URL + Grok WebSocket URL (Grok does NOT use SDP POST) ─────
const openaiSdp = resolveSdpEndpoint({
  realtime_base: OPENAI_REALTIME_BASE,
  model: "gpt-4o-realtime-preview",
});
ok(openaiSdp.startsWith("https://api.openai.com/v1/realtime?"), "OpenAI SDP targets openai.com");

const fallbackSdp = resolveSdpEndpoint({ model: "x" });
ok(
  fallbackSdp.startsWith(DEFAULT_REALTIME_SDP_BASE),
  "missing realtime_base falls back to OpenAI default",
);

let threw = false;
try {
  resolveSdpEndpoint({ realtime_base: "wss://evil.example/v1" });
} catch {
  threw = true;
}
ok(threw, "non-https realtime_base rejected for SDP helper");

const grokWs = buildGrokRealtimeWsUrl({
  realtime_base: XAI_REALTIME_BASE,
  model: "grok-voice-latest",
});
ok(grokWs.startsWith("wss://api.x.ai/v1/realtime?"), "Grok duplex uses wss WebSocket URL");
ok(grokWs.includes("model=grok-voice-latest"), "Grok WS includes model");
ok(usesGrokWebSocketTransport("grok"), "Grok provider → WebSocket transport");
ok(!usesGrokWebSocketTransport("openai"), "OpenAI provider → not WebSocket transport");
// ── 3. Mint shape via real mintRealtimeClientSecret (mocked fetch) ────────
const realFetch = globalThis.fetch;
let lastMintUrl = "";
globalThis.fetch = async (url, init) => {
  lastMintUrl = String(url);
  const u = lastMintUrl;
  if (u.includes("api.x.ai") && u.includes("client_secrets")) {
    const body = JSON.parse(init?.body || "{}");
    // Grok mint must not embed OpenAI nested session
    if (body.session) {
      return { ok: false, status: 400, text: async () => "unexpected session body" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "xai-ek_contract_secret",
        expires_at: Math.floor(Date.now() / 1000) + 120,
        model: "grok-voice-latest",
      }),
    };
  }
  if (u.includes("api.openai.com") && u.includes("client_secrets")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "ek_contract_secret",
        expires_at: Math.floor(Date.now() / 1000) + 120,
        session: { id: "sess_contract", model: "gpt-4o-realtime-preview" },
      }),
    };
  }
  return realFetch(url, init);
};

// Force usable keys for mint (isUsableApiKey rejects …-test-… placeholders)
const FORCE_GROK = "xai-" + "z".repeat(48);
const FORCE_OPENAI = "sk-proj-" + "z".repeat(40);
process.env.GROK_API_KEY = FORCE_GROK;
process.env.OPENAI_API_KEY = FORCE_OPENAI;

const { config } = await import("../server/config.js");
config.grokApiKey = FORCE_GROK;
config.openaiApiKey = FORCE_OPENAI;

const grokMint = await mintRealtimeClientSecret({
  voiceProvider: "grok",
  sessionModel: "grok-voice-latest",
  systemPrompt: "test",
  tools: [],
});
ok(!!grokMint.client_secret?.value, "Grok mint returns client_secret.value");
ok(grokMint.realtime_base.includes("api.x.ai"), "Grok mint realtime_base is xAI");
ok(grokMint.voiceProvider === "grok", "Grok mint voiceProvider=grok");
ok(lastMintUrl.includes("api.x.ai"), "Grok mint hits xAI client_secrets");

const openaiMint = await mintRealtimeClientSecret({
  voiceProvider: "openai",
  sessionModel: "gpt-4o-realtime-preview",
  systemPrompt: "test",
  tools: [{ type: "function", name: "setScenario", parameters: { type: "object" } }],
});
ok(!!openaiMint.client_secret?.value, "OpenAI mint returns client_secret.value");
ok(openaiMint.realtime_base.includes("openai.com"), "OpenAI mint realtime_base is openai.com");
ok(
  resolveSdpEndpoint(openaiMint).includes("api.openai.com"),
  "SDP from OpenAI mint session targets openai.com",
);
ok(
  buildGrokRealtimeWsUrl(grokMint).includes("wss://api.x.ai"),
  "Grok mint session maps to wss://api.x.ai (not SDP POST)",
);
globalThis.fetch = realFetch;

// ── 4. Source wiring (must hold for chat shell + Live) ────────────────────
const shell = fs.readFileSync(
  path.join(root, "src/components/PanelinCalculadoraV3_backup.jsx"),
  "utf8",
);
ok(shell.includes("setAiPick: chat.setAiPick"), "shell forwards setAiPick into chat props");
ok(shell.includes("aiProvider: chat.aiProvider"), "shell forwards aiProvider");

const voiceHook = fs.readFileSync(path.join(root, "src/hooks/useVoiceSession.js"), "utf8");
ok(voiceHook.includes("resolveSdpEndpoint"), "useVoiceSession uses resolveSdpEndpoint (OpenAI)");
ok(voiceHook.includes("buildGrokRealtimeWsUrl"), "useVoiceSession uses Grok WebSocket URL builder");
ok(voiceHook.includes("usesGrokWebSocketTransport"), "useVoiceSession branches Grok vs OpenAI transport");
ok(voiceHook.includes("sessData.realtime_base"), "useVoiceSession stores server realtime_base");
ok(voiceHook.includes("aiProvider"), "useVoiceSession sends aiProvider on mint");
ok(
  !voiceHook.includes("POST to realtime_base (OpenAI or xAI)"),
  "hook header no longer claims xAI SDP POST",
);
const chatPanel = fs.readFileSync(path.join(root, "src/components/PanelinChatPanel.jsx"), "utf8");
ok(chatPanel.includes("send={send}"), "chat voice panel receives send()");
ok(chatPanel.includes("aiProvider={aiProvider}"), "chat voice panel receives aiProvider");
ok(chatPanel.includes("PanelinVoicePanel"), "chat embeds PanelinVoicePanel");

const livePage = fs.readFileSync(path.join(root, "src/components/PanelinLivePage.jsx"), "utf8");
ok(livePage.includes("aiProvider: aiSel.aiProvider"), "Live page passes aiProvider to voice hook");

const csp = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
ok(csp.includes("https://api.x.ai"), "CSP allows api.x.ai");
ok(csp.includes("wss://api.x.ai"), "CSP allows wss://api.x.ai for Grok Voice WebSocket");
ok(csp.includes("https://api.openai.com"), "CSP allows api.openai.com");
ok(csp.includes("media-src"), "CSP sets media-src for Realtime audio");
// ── 5. voice/action relay (real Express route) ────────────────────────────
process.env.API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "voice-contract-token";
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3001";
const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const app = express();
app.use(express.json());
app.use("/api", agentVoiceRouter);
const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const actionOk = await fetch(`${base}/api/agent/voice/action`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: { type: "setScenario", payload: { scenario: "techo" } } }),
});
const actionJson = await actionOk.json();
ok(actionOk.status === 200 && actionJson.ok === true, "voice/action accepts setScenario");
ok(actionJson.action?.type === "setScenario", "voice/action echoes validated action");

const actionBad = await fetch(`${base}/api/agent/voice/action`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: { type: "dropDatabase", payload: {} } }),
});
ok(actionBad.status === 400, "voice/action rejects unknown action type");

server.close();

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

// HTTP gates for shopper endpoints added after #1142 (session/action).
// status / identify / chat / log / live — origin, validation, pageUrl strip.
// Do not call identify/log with a real Admin row (Sheets). Do not chat with
// a non-empty message (would hit xAI).
// Run: node tests/publicVoiceShopperRoutes.test.js

import http from "node:http";
import assert from "node:assert/strict";
import express from "express";

process.env.PUBLIC_STOREFRONT_VOICE = "1";
process.env.GROK_API_KEY = "xai-" + "y".repeat(48);
process.env.APP_ENV = "test";

const { default: createPublicVoiceRouter } = await import("../server/routes/publicVoice.js");
const { config } = await import("../server/config.js");
const {
  markStorefrontCreditsDead,
  __resetStorefrontVoiceCredits,
} = await import("../server/lib/voice/storefrontVoiceCredits.js");
const { __testLive__ } = await import("../server/lib/voice/storefrontLive.js");

if (!config.grokApiKey) config.grokApiKey = process.env.GROK_API_KEY;
config.storefrontVoiceEnabled = true;
config.storefrontVoiceOrigins = [
  "https://bmcuruguay.com.uy",
  "https://www.bmcuruguay.com.uy",
];

__resetStorefrontVoiceCredits();
__testLive__.reset();

const app = express();
app.use(express.json());
app.use("/api/public/voice", createPublicVoiceRouter());

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;
const SHOP = "https://bmcuruguay.com.uy";

async function req(path, { origin = SHOP, body, method = "POST" } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (origin !== undefined) headers.Origin = origin;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json };
}

const prevEnv = config.appEnv;

{
  config.appEnv = "production";
  config.storefrontVoiceEnabled = false;
  const r = await req("/api/public/voice/status", { method: "GET" });
  assert.equal(r.status, 404, "flag off → 404 on /status");
  config.storefrontVoiceEnabled = true;
}

{
  config.appEnv = "production";
  const evil = await req("/api/public/voice/status", {
    method: "GET",
    origin: "https://evil.example",
  });
  assert.equal(evil.status, 403, "evil origin → 403 on /status");
  const empty = await req("/api/public/voice/identify", {
    origin: "",
    body: { cliente: "Ana", telefono: "099123456", consent: true },
  });
  assert.equal(empty.status, 403, "production empty origin → 403 on /identify");
}

{
  config.appEnv = "development";
  const ok = await req("/api/public/voice/status", { method: "GET" });
  assert.equal(ok.status, 200, "/status 200");
  assert.equal(ok.json?.bubble, true);

  markStorefrontCreditsDead({
    status: 403,
    body: "Your team has used all available credits or reached monthly spending limit",
  });
  const dry = await req("/api/public/voice/status", { method: "GET" });
  assert.equal(dry.status, 200);
  assert.equal(dry.json?.bubble, false, "credits-dead cache hides orb");
  __resetStorefrontVoiceCredits();
}

{
  const noConsent = await req("/api/public/voice/identify", {
    body: { cliente: "Ana", telefono: "099123456", consent: false },
  });
  assert.equal(noConsent.status, 400, "identify without consent → 400");
  assert.match(String(noConsent.json?.error || ""), /nombre y celular/i);

  const short = await req("/api/public/voice/identify", {
    body: { cliente: "Ana", telefono: "099", consent: true },
  });
  assert.equal(short.status, 400, "identify short phone → 400");
  assert.match(String(short.json?.error || ""), /celular/i);

  const noName = await req("/api/public/voice/identify", {
    body: { cliente: "A", telefono: "099123456", consent: true },
  });
  assert.equal(noName.status, 400, "identify short name → 400");
}

{
  const empty = await req("/api/public/voice/chat", { body: { message: "   " } });
  assert.equal(empty.status, 400, "empty chat → 400 (no xAI call)");
  assert.match(String(empty.json?.error || ""), /consulta/i);

  config.appEnv = "production";
  const evilChat = await req("/api/public/voice/chat", {
    origin: "https://evil.example",
    body: { message: "hola" },
  });
  assert.equal(evilChat.status, 403, "evil origin → 403 on /chat");
  config.appEnv = "development";
}

{
  const noPhone = await req("/api/public/voice/log", {
    body: { transcript: "hola IsoDec", adminRow: 31 },
  });
  assert.equal(noPhone.status, 400, "log without phone → 400");

  const skipped = await req("/api/public/voice/log", {
    body: { telefono: "099123456", transcript: "  ", adminRow: 31 },
  });
  assert.equal(skipped.status, 200);
  assert.equal(skipped.json?.skipped, true, "empty transcript is a no-op");

  const headerRow = await req("/api/public/voice/log", {
    body: { telefono: "099123456", transcript: "hola IsoDec", adminRow: 1 },
  });
  assert.equal(headerRow.status, 400, "log header-row adminRow → 400 (no Sheets write)");
  assert.match(String(headerRow.json?.error || ""), /adminRow/i);
}

{
  const noId = await req("/api/public/voice/live/state", { method: "GET" });
  assert.equal(noId.status, 400, "live/state without id → 400");

  const emptyTurn = await req("/api/public/voice/live/turn", {
    body: { id: "live-shop-1", role: "user", text: "  " },
  });
  assert.equal(emptyTurn.status, 400, "live/turn empty text → 400");
}

{
  const ping = await req("/api/public/voice/live/ping", {
    body: {
      id: "live-shop-js",
      cliente: "Ana",
      telefono: "099111222",
      pageUrl: "javascript:alert(1)",
    },
  });
  assert.equal(ping.status, 200);
  assert.equal(ping.json?.ok, true);
  const stored = __testLive__.get("live-shop-js");
  assert.ok(stored, "ping created memory session");
  assert.equal(stored.pageUrl, "", "javascript: pageUrl stripped before persist");
  assert.equal(stored.phoneHash.length, 16, "phone stored hashed");
  assert.notEqual(stored.phoneHash, "099111222");
}

config.appEnv = prevEnv;
__resetStorefrontVoiceCredits();
__testLive__.reset();
await new Promise((resolve) => server.close(resolve));
console.log("publicVoiceShopperRoutes.test.js ok");

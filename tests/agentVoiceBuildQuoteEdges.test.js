/**
 * Voice buildQuote action + mint error redaction edges.
 * Complements panelinLiveVoice.test.js (session mint happy-path / auth).
 *
 * Run: node tests/agentVoiceBuildQuoteEdges.test.js
 */

import http from "node:http";
import express from "express";
import assert from "node:assert/strict";

process.env.PUBLIC_BASE_URL = "http://localhost:3001";
process.env.API_AUTH_TOKEN = "panelin-live-test-token";
process.env.OPENAI_API_KEY = "sk-proj-" + "x".repeat(40);

const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { config } = await import("../server/config.js");
const { clearVoiceErrors, listVoiceErrors } = await import("../server/lib/voiceErrorLog.js");

if (!config.openaiApiKey) config.openaiApiKey = process.env.OPENAI_API_KEY;

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

const SECRET_INSTRUCTIONS = "SYSTEM SECRET PROMPT DO NOT LEAK";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("api.openai.com/v1/realtime/client_secrets")) {
    return {
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            message: `bad request body {"instructions":"${SECRET_INSTRUCTIONS}","model":"x"}`,
          },
        }),
    };
  }
  return realFetch(url);
};

async function req(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer panelin-live-test-token",
      "Content-Type": "application/json",
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

console.log("\n— agentVoiceBuildQuoteEdges\n");

// ── buildQuote action validation ───────────────────────────────────────────
{
  const bad = await req("/api/agent/voice/action", {
    method: "POST",
    body: JSON.stringify({
      action: {
        type: "buildQuote",
        payload: { scenario: "solo_piso", techo: { familia: "ISODEC_EPS", espesor: 100, largo: 10, ancho: 6 } },
      },
    }),
  });
  ok(bad.status === 200 && bad.json?.ok === false && bad.json?.rejected === true, "buildQuote invalid scenario → rejected");
  ok(Array.isArray(bad.json?.errors) && bad.json.errors.length > 0, "buildQuote reject includes errors[]");
}

{
  const good = await req("/api/agent/voice/action", {
    method: "POST",
    body: JSON.stringify({
      action: {
        type: "buildQuote",
        payload: {
          scenario: "solo_techo",
          listaPrecios: "web",
          techo: { familia: "ISODEC_EPS", espesor: 100, largo: 10, ancho: 6 },
        },
      },
    }),
  });
  ok(good.status === 200 && good.json?.ok === true, "buildQuote valid → ok");
  ok(
    good.json?.action?.preview?.subtotalUSD > 0 && good.json?.action?.preview?.totalConIVA > 0,
    "buildQuote enriches action.preview with non-zero USD",
  );
  ok(Array.isArray(good.json?.action?.warnings), "buildQuote exposes warnings array");
}

{
  const emptyBom = await req("/api/agent/voice/action", {
    method: "POST",
    body: JSON.stringify({
      action: {
        type: "buildQuote",
        payload: {
          scenario: "solo_techo",
          techo: { familia: "NO_EXISTE", espesor: 100, largo: 10, ancho: 6 },
        },
      },
    }),
  });
  ok(
    emptyBom.json?.ok === false && emptyBom.json?.rejected === true,
    "buildQuote empty/invalid BOM → rejected (no zero-dollar ok)",
  );
}

{
  const passthrough = await req("/api/agent/voice/action", {
    method: "POST",
    body: JSON.stringify({
      action: { type: "setWizardStep", payload: { step: 2 } },
    }),
  });
  ok(passthrough.status === 200 && passthrough.json?.ok === true, "non-buildQuote action relays ok");
}

// ── mint failure: instructions redacted in ring + HTTP error ──────────────
clearVoiceErrors();
{
  const mintFail = await req("/api/agent/voice/session", {
    method: "POST",
    body: JSON.stringify({ calcState: { scenario: "techo" } }),
  });
  ok(mintFail.status === 502 && mintFail.json?.ok === false, "mint 4xx → 502");
  const errText = String(mintFail.json?.error || "");
  ok(!errText.includes(SECRET_INSTRUCTIONS), "HTTP error must not leak instructions text");
  ok(/\[redacted\]/i.test(errText) || !/"instructions"\s*:\s*"/i.test(errText), "HTTP error redacts instructions field");

  const ring = listVoiceErrors();
  const mintEntry = ring.find((e) => e.kind === "session_mint");
  ok(Boolean(mintEntry), "session_mint recorded in voice error ring");
  ok(
    mintEntry && !String(mintEntry.detail || "").includes(SECRET_INSTRUCTIONS),
    "voice error ring detail must not leak instructions",
  );
  ok(
    mintEntry && /\[redacted\]/i.test(String(mintEntry.detail || "")),
    "voice error ring detail uses [redacted] for instructions",
  );
}

server.close();
globalThis.fetch = realFetch;

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

/**
 * Voice Mode (#1108) relays Grok function-calls to POST /api/agent/voice/action,
 * which executes allowlisted AGENT_TOOLS server-side. Write tools (CRM / WA /
 * Sheets / email) must stay rejected — never kind:"tool".
 *
 * Run: node tests/voiceActionAllowlist.test.js
 */
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

import { VOICE_BRAIN_TOOL_SET } from "../server/lib/voiceBrainPack.js";
import { DEFAULT_WRITE_DENY } from "../server/mcp/denyList.js";

process.env.API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "voice-allowlist-token";
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3001";

const WRITE_SAMPLES = [
  "guardar_en_crm",
  "enviar_whatsapp_link",
  "sheets_write_range",
  "email_enviar",
  "wolfboard_quote_batch",
  "cancelar_cotizacion",
];

for (const name of DEFAULT_WRITE_DENY) {
  assert.equal(
    VOICE_BRAIN_TOOL_SET.has(name),
    false,
    `voice allowlist must not include write tool ${name}`,
  );
}
for (const name of WRITE_SAMPLES) {
  assert.ok(DEFAULT_WRITE_DENY.includes(name), `sample ${name} is a default write deny`);
}

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

async function postAction(body) {
  const res = await fetch(`${base}/api/agent/voice/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer voice-allowlist-token",
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const missing = await postAction({});
assert.equal(missing.status, 400, "missing action → 400");
assert.notEqual(missing.json?.kind, "tool");

const nullAction = await postAction({ action: null });
assert.equal(nullAction.status, 400, "null action → 400");

for (const type of WRITE_SAMPLES) {
  const { status, json } = await postAction({
    action: { type, payload: { user_confirmed: true, pdf_url: "https://example.test/x" } },
    calcState: { scenario: "solo_techo" },
  });
  assert.equal(status, 400, `${type} must not execute (status)`);
  assert.notEqual(json?.kind, "tool", `${type} must not return kind:tool`);
  assert.equal(json?.ok, false);
}

const form = await postAction({
  action: { type: "setFlete", payload: { flete: 40 } },
});
assert.equal(form.status, 200, "setFlete remains a form action");
assert.equal(form.json?.ok, true);
assert.equal(form.json?.action?.type, "setFlete");
assert.notEqual(form.json?.kind, "tool");

const readTool = await postAction({
  action: { type: "get_calc_state", payload: {} },
  calcState: { scenario: "solo_fachada", listaPrecios: "venta" },
});
assert.equal(readTool.status, 200);
assert.equal(readTool.json?.kind, "tool");
assert.match(String(readTool.json?.result || ""), /solo_fachada/);

await new Promise((r) => server.close(r));
console.log("voiceActionAllowlist.test.js: ok");

// Voice Brain Pack — console instructions + shared brain tools, no secrets
// Run: node tests/voiceBrainPack.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  buildVoiceBrainPack,
  sanitizeBootstrapForClient,
  VOICE_BRAIN_TOOL_ALLOWLIST,
  agentToolToRealtimeFunction,
  buildVoiceFileSearchTool,
  DEFAULT_XAI_COLLECTION_BMC_PRODUCT_BIBLE,
} = await import("../server/lib/voiceBrainPack.js");
const { PANELIN_BMC_VOICE_INSTRUCTIONS } = await import(
  "../server/lib/voice/panelinBmcInstructions.js"
);

const pack = buildVoiceBrainPack(
  { scenario: "solo_techo", listaPrecios: "web" },
  { leadContext: { cliente: "Ferretería Sur", consulta: "techo 10x8 IsoDec" } },
);

assert.ok(pack.instructions.includes("Panelin"), "instructions name Panelin");
assert.ok(pack.instructions.includes("Iso-dec"), "instructions include speech-friendly Iso-dec");
assert.ok(pack.instructions.includes("aplicar_estado_calc"), "instructions tell model to fill the form");
assert.ok(pack.instructions.includes("CONTEXTO DEL LEAD"), "lead context injected");
assert.ok(pack.instructions.includes("Ferretería Sur"), "lead cliente present");
assert.ok(pack.instructions.includes("ESTADO ACTUAL DE LA CALCULADORA"), "calc state block present");
assert.ok(!pack.instructions.includes("end_call_2") || pack.instructions.includes("no phone hangup"),
  "in-app instructions do not require phone hangup as the only close");

const names = (pack.tools || []).map((t) => t.name || t.type);
assert.ok(names.includes("web_search"), "web_search attached");
const fileSearch = (pack.tools || []).find((t) => t.type === "file_search");
assert.ok(fileSearch, "file_search attached for product bible");
assert.ok(
  fileSearch.vector_store_ids.includes(DEFAULT_XAI_COLLECTION_BMC_PRODUCT_BIBLE),
  "file_search uses bmc-product-bible collection",
);
assert.ok(pack.instructions.includes("file_search"), "instructions tell model to use file_search");
assert.ok(
  pack.instructions.includes("Never treat those hits as prices")
    || pack.instructions.includes("NEVER use file_search results as USD"),
  "instructions keep prices off the collection",
);
assert.ok(names.includes("obtener_precio_panel"), "obtener_precio_panel still attached");
assert.ok(names.includes("calcular_cotizacion"), "calcular_cotizacion attached");
assert.ok(names.includes("aplicar_estado_calc"), "aplicar_estado_calc attached");
assert.ok(names.includes("generar_pdf"), "generar_pdf attached");
assert.ok(pack.instructions.includes("generar_pdf"), "instructions tell model to call generar_pdf");
assert.ok(
  pack.instructions.includes("NEVER say you cannot generate PDFs"),
  "instructions forbid claiming PDF tool is missing",
);
assert.ok(names.includes("setTecho"), "form function setTecho attached");
for (const n of VOICE_BRAIN_TOOL_ALLOWLIST) {
  assert.ok(names.includes(n), `allowlist tool present: ${n}`);
}

const serialized = JSON.stringify(pack);
assert.ok(!/"authorization"\s*:/i.test(serialized), "bootstrap has no authorization field");
assert.ok(!/PANELI_MCP_SECRET/i.test(serialized), "bootstrap has no MCP secret name");
assert.ok(!/Bearer\s+(sk-|xai-|ek_)/i.test(serialized), "bootstrap has no API-key Bearer");

assert.equal(pack.voice, "eve");
assert.equal(pack.language_hint, "es-ES");
assert.ok(Array.isArray(pack.keyterms) && pack.keyterms.includes("IsoDec"));

const fn = agentToolToRealtimeFunction({
  name: "demo",
  description: "d",
  input_schema: { type: "object", properties: { x: { type: "number" } } },
});
assert.equal(fn.type, "function");
assert.equal(fn.parameters.properties.x.type, "number");

const cleaned = sanitizeBootstrapForClient({
  tools: [{ type: "mcp", server_url: "https://x", authorization: "Bearer supersecret" }],
});
assert.equal(cleaned.tools[0].authorization, undefined);
assert.ok(!JSON.stringify(cleaned).includes("supersecret"));
assert.throws(
  () => sanitizeBootstrapForClient({ instructions: "use Bearer sk-live-abc123456" }),
  /leaked a secret/,
);

assert.equal(buildVoiceFileSearchTool(""), null);
assert.equal(buildVoiceFileSearchTool("   "), null);
assert.equal(
  buildVoiceFileSearchTool("collection_abc").vector_store_ids[0],
  "collection_abc",
);
const noBible = buildVoiceBrainPack({}, { collectionId: "" });
assert.ok(
  !(noBible.tools || []).some((t) => t.type === "file_search"),
  "empty collectionId omits file_search",
);

assert.ok(PANELIN_BMC_VOICE_INSTRUCTIONS.includes("Role & Persona"));
assert.ok(PANELIN_BMC_VOICE_INSTRUCTIONS.includes("CRITICAL INSTRUCTIONS"));
assert.ok(PANELIN_BMC_VOICE_INSTRUCTIONS.includes("file_search"));

const panel = fs.readFileSync(path.join(ROOT, "src/components/PanelinVoicePanel.jsx"), "utf8");
assert.ok(panel.includes("useVoiceSession"), "floating Voice Mode uses useVoiceSession");
assert.ok(panel.includes('voiceProvider: "grok"'), "floating Voice Mode pins Grok");
assert.ok(panel.includes("isGrokRealtimeSupported"), "Grok realtime capability gate");

const vs = fs.readFileSync(path.join(ROOT, "src/hooks/voiceSupport.js"), "utf8");
assert.ok(vs.includes("export function isGrokRealtimeSupported"));

console.log("voiceBrainPack.test.js: ok");

// Public storefront voice pack — allowlist, lista web, consent.
// Run: node tests/storefrontVoicePack.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStorefrontVoicePack,
  forceListaWeb,
  isPublicStorefrontTool,
  assertCaptureLead,
  assertIdentifyLead,
  normalizeStorefrontPhone,
  buildWhatsAppHandoff,
  stripInternalPrices,
  STOREFRONT_READ_TOOLS,
  STOREFRONT_VOICE_GREETING_TEXT,
  STOREFRONT_LEAD_ORIGEN,
  isStorefrontShopTool,
} from "../server/lib/voice/storefrontVoicePack.js";
import { STOREFRONT_VOICE_INSTRUCTIONS } from "../server/lib/voice/storefrontVoiceInstructions.js";
import { STOREFRONT_AGENT_CONFIG } from "../server/lib/voice/storefrontAgentConfig.js";
import { isStorefrontOriginAllowed } from "../server/routes/publicVoice.js";
import { packToolsToOpenAI, sanitizeChatHistory } from "../server/lib/voice/storefrontChat.js";
import {
  loadKnowledgeDocs,
  loadPublicKnowledgeDocs,
  redactKnowledgeForStorefront,
} from "../server/lib/knowledgeLoader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pack = buildStorefrontVoicePack({ pageUrl: "https://bmcuruguay.com.uy/products/isodec" });
const names = (pack.tools || []).map((t) => t.name || t.type);

assert.ok(pack.instructions.includes("shoppers"), "buyer-facing, not sales team");
assert.ok(!pack.instructions.includes("sales team only"), "must not reuse operator persona");
assert.ok(pack.instructions.includes("lista-web") || pack.instructions.includes("lista **web**") || pack.instructions.includes("web"), "web list");
assert.ok(!names.includes("web_search"), "no billed web_search on voice pack");
assert.ok(names.includes("calcular_cotizacion"), "calc");
assert.ok(names.includes("capture_lead"), "capture_lead");
assert.ok(names.includes("handoff_whatsapp"), "handoff");
assert.ok(names.includes("shop_search"), "shop_search");
assert.ok(names.includes("add_to_cart"), "add_to_cart");
assert.ok(names.includes("navigate"), "navigate");
assert.ok(names.includes("get_cart"), "get_cart");

const widgetSrc = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
assert.ok(widgetSrc.includes("cart:update"), "Horizon cart:update after add");
assert.ok(widgetSrc.includes("openCart"), "open Shopify cart drawer");
assert.ok(widgetSrc.includes('id="bmc-cart"'), "Carrito button");
assert.ok(widgetSrc.includes("SHOP_TOOLS"), "browser shop tools");
assert.ok(widgetSrc.includes('state.status === "idle"'), "idle cart must not persist voice resume");
assert.ok(widgetSrc.includes("leftPage"), "failed navigate still calls response.create");
assert.ok(names.includes("generar_pdf"), "PDF on insist path");
assert.ok(!names.includes("aplicar_estado_calc"), "no form fill");
assert.ok(!names.includes("sheets_read_range"), "no sheets");
assert.ok(!names.includes("historial_cliente"), "no CRM history");
assert.ok(!names.includes("setTecho"), "no operator form tools");
for (const n of STOREFRONT_READ_TOOLS) {
  assert.ok(names.includes(n), `read tool ${n}`);
}

assert.equal(pack.voice, "rex");
assert.equal(pack.language_hint, "es-MX");
assert.equal(pack.turn_detection.silence_duration_ms, 900);
assert.equal(pack.turn_detection.threshold, 0.5);
assert.equal(pack.turn_detection.idle_timeout_ms, 10000);
assert.equal(pack.greeting, STOREFRONT_VOICE_GREETING_TEXT);
assert.ok(pack.instructions.includes("bmcuruguay.com.uy/products/isodec"), "page url as context");
assert.ok(!JSON.stringify(pack).includes("PANELI_MCP_SECRET"), "no MCP secret");

assert.equal(isPublicStorefrontTool("calcular_cotizacion"), true);
assert.equal(isPublicStorefrontTool("generar_pdf"), true);
assert.equal(isPublicStorefrontTool("wolfboard_marcar_enviado"), false);
assert.equal(isPublicStorefrontTool("wa_lead_to_admin"), false);
assert.equal(isStorefrontShopTool("add_to_cart"), true);
assert.equal(isStorefrontShopTool("calcular_cotizacion"), false);

const forced = forceListaWeb("obtener_precio_panel", { familia: "ISODEC_EPS", espesor: 100, lista: "venta" });
assert.equal(forced.lista, "web");
const forcedCalc = forceListaWeb("calcular_cotizacion", { listaPrecios: "venta", scenario: "solo_techo" });
assert.equal(forcedCalc.listaPrecios, "web");
const forcedPdf = forceListaWeb("generar_pdf", { listaPrecios: "venta", flete: 440, scenario: "solo_techo" });
assert.equal(forcedPdf.listaPrecios, "web");
assert.equal(forcedPdf.flete, 0);

assert.equal(normalizeStorefrontPhone("099 162 401"), "598099162401");
assert.equal(normalizeStorefrontPhone("+598 99 123 456"), "59899123456");

const noConsent = assertCaptureLead({
  cliente: "Juan",
  telefono: "099123456",
  consulta: "techo IsoDec 10x8",
  consent: false,
});
assert.equal(noConsent.ok, false);

const yes = assertCaptureLead({
  cliente: "Juan",
  telefono: "099123456",
  consulta: "techo IsoDec 10x8 100 mm",
  zona: "Maldonado",
  consent: true,
});
assert.equal(yes.ok, true);
assert.equal(yes.lead.origen, STOREFRONT_LEAD_ORIGEN);
assert.equal(yes.lead.telefono.startsWith("598"), true);

const wa = buildWhatsAppHandoff({ cliente: "Juan", consulta: "techo 10x8" }, "59892663245");
assert.ok(wa.url.includes("wa.me/59892663245"));
assert.ok(wa.url.includes("Juan"));

const stripped = stripInternalPrices({
  lista: "web",
  precio_usd_m2_sin_iva: 41,
  precio_venta: 33,
  costo: 20,
  flete: 99,
  nested: { precio_venta: 1, ok: true, flete_usd: 8 },
});
assert.equal(stripped.precio_usd_m2_sin_iva, 41);
assert.equal(stripped.precio_venta, undefined);
assert.equal(stripped.costo, undefined);
assert.equal(stripped.flete, undefined);
assert.equal(stripped.nested.precio_venta, undefined);
assert.equal(stripped.nested.flete_usd, undefined);
assert.equal(stripped.nested.ok, true);

const idFail = assertIdentifyLead({ cliente: "Ana", telefono: "099", consent: true });
assert.equal(idFail.ok, false);
const idOk = assertIdentifyLead({ cliente: "Ana", telefono: "099123456", consent: true });
assert.equal(idOk.ok, true);
assert.equal(idOk.lead.cliente, "Ana");
assert.match(idOk.lead.consulta, /Chat tienda Panelin/);
const namedPack = buildStorefrontVoicePack({ shopperName: "Ana" });
assert.ok(namedPack.instructions.includes("Already identified as Ana"));

assert.equal(STOREFRONT_AGENT_CONFIG.quote.mode, "insist-only");
assert.deepEqual([...STOREFRONT_AGENT_CONFIG.lead.required], ["nombre", "telefono"]);
assert.equal(STOREFRONT_AGENT_CONFIG.quote.pdf, true);
assert.equal(STOREFRONT_AGENT_CONFIG.quote.shipping, "never");
assert.equal(STOREFRONT_AGENT_CONFIG.voice, "rex");
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("insist"));
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("flete"));
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("Estoy aprendiendo"));
assert.ok(/classify/i.test(STOREFRONT_VOICE_INSTRUCTIONS));

assert.equal(
  isStorefrontOriginAllowed("https://bmcuruguay.com.uy", {
    appEnv: "production",
    storefrontVoiceOrigins: ["https://bmcuruguay.com.uy", "https://www.bmcuruguay.com.uy"],
  }),
  true,
);
assert.equal(
  isStorefrontOriginAllowed("https://evil.example", {
    appEnv: "production",
    storefrontVoiceOrigins: ["https://bmcuruguay.com.uy"],
  }),
  false,
);
assert.equal(
  isStorefrontOriginAllowed("", { appEnv: "production", storefrontVoiceOrigins: [] }),
  false,
);
assert.equal(
  isStorefrontOriginAllowed("", { appEnv: "development", storefrontVoiceOrigins: [] }),
  true,
);

assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("Role & Persona"));
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("capture_lead"));

const widget = fs.readFileSync(
  path.join(ROOT, "server/public/storefront-voice/widget.js"),
  "utf8",
);
assert.ok(widget.includes("/api/public/voice/session"), "widget mints public session");
assert.ok(widget.includes("/api/public/voice/chat"), "widget text-to-text");
assert.ok(widget.includes("/api/public/voice/identify"), "name+phone gate");
assert.ok(widget.includes("/api/public/voice/log"), "chat log to Admin 2.0");
assert.ok(widget.includes("¡Dale, chateamos!"), "friendly identify CTA");
assert.ok(widget.includes("if (!state.identified) return"), "chat locked until identified");
assert.ok(widget.includes('id="bmc-in"'), "text input");
assert.ok(widget.includes("panelin.png"), "Panelin poster");
assert.ok(widget.includes("panelin-lista-loop.mp4"), "calculator Panelin loop");
assert.ok(widget.includes("<video"), "orb is video");
assert.ok(widget.includes("¿Necesitás ayuda?"), "help label on bubble");
assert.ok(
  fs.existsSync(path.join(ROOT, "server/public/storefront-voice/panelin.png")),
  "avatar poster",
);
assert.ok(
  fs.existsSync(path.join(ROOT, "public/video/panelin-lista-loop.mp4")),
  "source loop in calculator public/",
);
const dockerignore = fs.readFileSync(path.join(ROOT, ".dockerignore"), "utf8");
assert.ok(
  dockerignore.includes("!public/video/panelin-lista-loop.mp4"),
  "Cloud Run COPY needs dockerignore exception for the loop mp4",
);
assert.ok(!widget.includes("/api/agent/voice/action"), "widget must not hit operator action");
assert.ok(widget.includes("alreadyTalking"), "do not re-greet mid-chat");
assert.ok(widget.includes('type: "response.create"'), "first turn is model-generated, not a hardcoded force_message");
assert.ok(!widget.includes("¿Buscás un techo, una pared, o una cámara?"), "no hardcoded techo/pared/cámara opener");
assert.ok(widget.includes("/cart/add.js"), "Shopify cart add");
assert.ok(widget.includes("/products.json"), "Shopify catalog search");
assert.ok(widget.includes("bmc_panelin_resume"), "resume after navigate");
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("cómo te puedo ayudar"));
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("Do not use a scripted menu"));
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("canned"));
assert.ok(widget.includes("El flete hay que corroborarlo"), "widget hint no-freight");
assert.ok(widget.includes("generar_pdf"), "widget surfaces PDF url");
assert.ok(widget.includes("addQuoteCard"), "presupuesto PDF card");
assert.ok(widget.includes("Presupuesto"), "presupuesto title");
assert.ok(widget.includes("fillRichText"), "chat links clickable");
assert.ok(widget.includes("out.navigated"), "auto-open product/collection page");
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("opens that page"), "instructions: navigate to product");
assert.ok(!widget.includes("Quiero cotizar un techo"), "no hardcoded techo chip as agent reply");
assert.equal(pack.greeting, "");
assert.ok(widget.includes("function openPanel"), "panel open");
{
  const openFn = widget.match(/function openPanel\(\) \{[\s\S]*?\n  \}/);
  assert.ok(openFn && !openFn[0].includes("startCall"), "text-first: open does not mint voice");
}
assert.ok(widget.includes("startCall()"), "Hablar still starts voice");
assert.ok(widget.includes("/api/public/voice/status"), "credits probe before orb");
assert.ok(widget.includes("function hideBubble"), "unmount orb when credits dead");
assert.ok(widget.includes("PCM_SILENCE_PEAK"), "do not append silent PCM");
assert.ok(widget.includes("SILENCE_CUT_MS = 10"), "10s client silence cut");
{
  const idSubmit = widget.match(/idForm\.addEventListener\("submit"[\s\S]*?picks\.addEventListener/);
  assert.ok(idSubmit && !idSubmit[0].includes("startCall"), "identify stays on text");
}
assert.ok(widget.includes("sendVoiceText"), "typed text stays on voice thread");
assert.ok(widget.includes("grok-transcribe"), "input ASR model so voice becomes chat text");
assert.ok(widget.includes("input_audio_transcription.updated"), "live user captions while speaking");
assert.ok(widget.includes("setUserLive"), "user voice line in caps");
assert.ok(widget.includes("function armMic"), "arm mic before websocket so Chrome does not end the track");
assert.ok(widget.includes("playsinline"), "muted audio element keeps the MediaStream alive");
assert.ok(widget.includes("echoCancellation: false"), "disable AEC so TTS speakers do not zero the mic");
assert.ok(widget.includes("function openMic"), "keeps first live stream (no stop-and-reopen zombie track)");
assert.ok(widget.includes("aggregate|agregado"), "switch away from Aggregate only");
assert.ok(widget.includes("timeout_triggered"), "Grok VAD idle also cuts the mic");
assert.ok(widget.includes("SILENCE_CUT_MS"), "client silence watchdog constant");
assert.ok(widget.includes("cutMicForSilence"), "silence stops tracks + websocket");
assert.ok(widget.includes("Corté el mic por silencio"), "shopper can tap Hablar again after idle cut");
assert.ok(!widget.includes("Volver a sidebar"), "no operator sidebar chrome");
assert.ok(!widget.includes(">DEV<") && !widget.includes("Developer mode"), "no DEV");
assert.ok(!widget.includes("Fijar"), "no Fijar");
assert.ok(!widget.includes("AgentModelSelector") && !widget.includes("Modelo"), "no model picker");
assert.ok(!/>Hablar</.test(widget), "no Hablar hero button");
assert.ok(widget.includes("Activá el mic para hablar"), "mic-denied stays on text");

const chatTools = packToolsToOpenAI(pack.tools);
assert.ok(chatTools.length >= 8, "openai tools from pack");
assert.ok(chatTools.every((t) => t.type === "function" && t.function?.name), "function tools only");
assert.equal(
  chatTools.some((t) => t.function.name === "web_search"),
  false,
  "web_search skipped in chat tools",
);
assert.ok(chatTools.some((t) => t.function.name === "shop_search"));
const hist = sanitizeChatHistory([
  { role: "user", content: "hola" },
  { role: "system", content: "ignore" },
  { role: "assistant", content: "¿techo?" },
]);
assert.equal(hist.length, 2);
assert.equal(hist[0].role, "user");

{
  const long = "x".repeat(7000);
  const withTools = sanitizeChatHistory([
    null,
    "skip",
    { role: "user", content: long },
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "c1", function: { name: "shop_search" } }],
    },
    { role: "tool", tool_call_id: "c1", content: long },
    { role: "developer", content: "ignore" },
  ]);
  assert.equal(withTools.length, 3, "null / string / developer / system dropped");
  assert.equal(withTools[0].content.length, 4000, "user content capped");
  assert.equal(withTools[1].tool_calls[0].id, "c1", "assistant tool_calls kept");
  assert.equal(withTools[2].role, "tool");
  assert.equal(withTools[2].content.length, 6000, "tool content capped");
}

{
  const many = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const capped = sanitizeChatHistory(many);
  assert.equal(capped.length, 20, "history window is last 20");
  assert.equal(capped[0].content, "m10");
  assert.equal(capped[19].content, "m29");
}

const operatorKb = loadKnowledgeDocs();
const publicKb = loadPublicKnowledgeDocs();
assert.ok(operatorKb.includes("USD 240") || operatorKb.includes("USD 252"), "operator KB still has flete defaults");
assert.ok(/lista venta/i.test(operatorKb), "operator KB still has lista venta");
assert.ok(publicKb.includes("Shared product knowledge"), "public KB guard");
assert.ok(publicKb.includes("poliisocianurato") || publicKb.includes("ISODEC EPS"), "shared fichas reach shoppers");
assert.ok(publicKb.includes("10 años"), "warranty FAQ reaches shoppers");
assert.ok(!publicKb.includes("USD 240"), "no flete USD 240 on shop KB");
assert.ok(!publicKb.includes("USD 252"), "no flete USD 252 on shop KB");
assert.ok(!/valor base en la calculadora/i.test(publicKb), "no calculator flete base");
assert.ok(!/google drive/i.test(publicKb), "no operator Drive");

assert.ok(pack.instructions.includes("Shared product knowledge"), "voice pack injects public KB");
assert.ok(
  pack.instructions.includes("poliisocianurato") || pack.instructions.includes("ISODEC EPS"),
  "shipped pack includes product facts from data/knowledge",
);
assert.ok(pack.instructions.includes("10 años"), "warranty from markdown KB is in the pack");
assert.ok(!pack.instructions.includes("USD 240"), "shipped pack must not speak flete USD 240");
assert.ok(!pack.instructions.includes("USD 252"), "shipped pack must not speak flete USD 252");
assert.ok(!/google drive/i.test(pack.instructions), "shipped pack has no Google Drive");

const redacted = redactKnowledgeForStorefront(
  "**P: ¿El flete está incluido?**\nR: No. USD 240 lista venta o USD 252 lista web.\n\n**P: ¿PIR o EPS?**\nR: PIR aísla más (λ=0,022).",
);
assert.ok(!redacted.includes("USD 240"), "drop freight Q&A");
assert.ok(redacted.includes("PIR aísla"), "keep product Q&A");

{
  const lines = redactKnowledgeForStorefront(
    [
      "ISODEC PIR λ=0,022.",
      "Precio lista venta interno 33 USD.",
      "Archivo en Google Drive del operador.",
      "CRM_Operativo fila 12.",
      "Garantía 10 años.",
    ].join("\n"),
  );
  assert.ok(lines.includes("ISODEC PIR"), "keep product line");
  assert.ok(lines.includes("10 años"), "keep warranty");
  assert.ok(!/lista venta/i.test(lines), "drop lista venta line");
  assert.ok(!/google drive/i.test(lines), "drop Drive line");
  assert.ok(!/\bCRM\b/.test(lines), "drop CRM line");
}

const dockerfile = fs.readFileSync(path.join(ROOT, "server/Dockerfile"), "utf8");
assert.ok(dockerfile.includes("COPY data/knowledge"), "Cloud Run ships data/knowledge");
assert.ok(
  dockerignore.includes("!data/knowledge"),
  "dockerignore must allow data/knowledge markdown",
);

console.log("storefrontVoicePack.test.js: ok");

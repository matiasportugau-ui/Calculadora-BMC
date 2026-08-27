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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pack = buildStorefrontVoicePack({ pageUrl: "https://bmcuruguay.com.uy/products/isodec" });
const names = (pack.tools || []).map((t) => t.name || t.type);

assert.ok(pack.instructions.includes("shoppers"), "buyer-facing, not sales team");
assert.ok(!pack.instructions.includes("sales team only"), "must not reuse operator persona");
assert.ok(pack.instructions.includes("lista-web") || pack.instructions.includes("lista **web**") || pack.instructions.includes("web"), "web list");
assert.ok(names.includes("web_search"), "web_search");
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
assert.ok(widget.includes("force_message"), "greeting via force_message");
assert.ok(widget.includes("/cart/add.js"), "Shopify cart add");
assert.ok(widget.includes("/products.json"), "Shopify catalog search");
assert.ok(widget.includes("bmc_panelin_resume"), "resume after navigate");
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("Do not say hello again"));
assert.ok(widget.includes("El flete hay que corroborarlo"), "widget hint no-freight");
assert.ok(widget.includes("generar_pdf"), "widget surfaces PDF url");
assert.ok(widget.includes("addQuoteCard"), "presupuesto PDF card");
assert.ok(widget.includes("Presupuesto"), "presupuesto title");
assert.ok(widget.includes("fillRichText"), "chat links clickable");
assert.ok(widget.includes("out.navigated"), "auto-open product/collection page");
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("opens that page"), "instructions: navigate to product");
assert.ok(widget.includes("Contame qué necesitás"), "calculator empty-state copy");
assert.ok(widget.includes("Quiero cotizar un techo"), "chip techo");
assert.ok(widget.includes("function openPanel"), "voice default on open");
assert.ok(widget.includes("startCall()"), "startCall on open");
assert.ok(widget.includes("sendVoiceText"), "typed text stays on voice thread");
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

console.log("storefrontVoicePack.test.js: ok");

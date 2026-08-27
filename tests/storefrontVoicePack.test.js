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
  normalizeStorefrontPhone,
  buildWhatsAppHandoff,
  stripInternalPrices,
  STOREFRONT_READ_TOOLS,
  STOREFRONT_VOICE_GREETING_TEXT,
  STOREFRONT_LEAD_ORIGEN,
  isStorefrontShopTool,
} from "../server/lib/voice/storefrontVoicePack.js";
import { STOREFRONT_VOICE_INSTRUCTIONS } from "../server/lib/voice/storefrontVoiceInstructions.js";
import { isStorefrontOriginAllowed } from "../server/routes/publicVoice.js";

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
assert.ok(!names.includes("generar_pdf"), "no PDF");
assert.ok(!names.includes("aplicar_estado_calc"), "no form fill");
assert.ok(!names.includes("sheets_read_range"), "no sheets");
assert.ok(!names.includes("historial_cliente"), "no CRM history");
assert.ok(!names.includes("setTecho"), "no operator form tools");
for (const n of STOREFRONT_READ_TOOLS) {
  assert.ok(names.includes(n), `read tool ${n}`);
}

assert.equal(pack.voice, "ara");
assert.equal(pack.language_hint, "es-MX");
assert.equal(pack.turn_detection.silence_duration_ms, 900);
assert.equal(pack.greeting, STOREFRONT_VOICE_GREETING_TEXT);
assert.ok(pack.instructions.includes("bmcuruguay.com.uy/products/isodec"), "page url as context");
assert.ok(!JSON.stringify(pack).includes("PANELI_MCP_SECRET"), "no MCP secret");

assert.equal(isPublicStorefrontTool("calcular_cotizacion"), true);
assert.equal(isPublicStorefrontTool("generar_pdf"), false);
assert.equal(isPublicStorefrontTool("wa_lead_to_admin"), false);
assert.equal(isStorefrontShopTool("add_to_cart"), true);
assert.equal(isStorefrontShopTool("calcular_cotizacion"), false);

const forced = forceListaWeb("obtener_precio_panel", { familia: "ISODEC_EPS", espesor: 100, lista: "venta" });
assert.equal(forced.lista, "web");
const forcedCalc = forceListaWeb("calcular_cotizacion", { listaPrecios: "venta", scenario: "solo_techo" });
assert.equal(forcedCalc.listaPrecios, "web");

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
  nested: { precio_venta: 1, ok: true },
});
assert.equal(stripped.precio_usd_m2_sin_iva, 41);
assert.equal(stripped.precio_venta, undefined);
assert.equal(stripped.costo, undefined);
assert.equal(stripped.nested.precio_venta, undefined);
assert.equal(stripped.nested.ok, true);

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
assert.ok(!widget.includes("/api/agent/voice/action"), "widget must not hit operator action");
assert.ok(widget.includes("force_message"), "greeting via force_message");
assert.ok(widget.includes("/cart/add.js"), "Shopify cart add");
assert.ok(widget.includes("/products.json"), "Shopify catalog search");
assert.ok(widget.includes("bmc_panelin_resume"), "resume after navigate");
assert.ok(
  /state\.status\s*===\s*["']idle["']/.test(widget) && widget.includes("persistResume"),
  "resume sessionStorage only while voice call is active",
);
assert.ok(
  widget.includes("leftPage") && widget.includes("JSON.parse(output)"),
  "drawer cart navigate must still response.create (leftPage gate)",
);
assert.ok(
  /leftPage:\s*false/.test(widget) && /opened:\s*["']drawer["']/.test(widget),
  "same-tab cart drawer reports leftPage:false",
);
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("Do not say hello again"));

console.log("storefrontVoicePack.test.js: ok");

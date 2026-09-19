// Public shop tool allowlist — operator writes never reach the widget pack.
// Complementary to tip storefrontVoicePack (a few named denies) + open #1142 /action suite.
// Run: node tests/storefrontPublicToolDenyGates.test.js

import assert from "node:assert/strict";
import {
  buildStorefrontVoicePack,
  isPublicStorefrontTool,
  isStorefrontShopTool,
  STOREFRONT_TOOL_SET,
  STOREFRONT_WRITE_TOOLS,
  STOREFRONT_READ_TOOLS,
  STOREFRONT_CLIENT_TOOLS,
} from "../server/lib/voice/storefrontVoicePack.js";

const OPERATOR_WRITES = [
  "wolfboard_actualizar_fila",
  "sheets_write_range",
  "enviar_whatsapp_link",
  "admin_cargar_pdfs_fila",
  "archivar_pdfs_drive",
  "pea_explain_gap",
  "aplicar_estado_calc",
  "setTecho",
  "web_search",
  "historial_cliente",
  "sheets_read_range",
];

for (const name of OPERATOR_WRITES) {
  assert.equal(isPublicStorefrontTool(name), false, `${name} must stay off the shop allowlist`);
  assert.equal(isStorefrontShopTool(name), false, `${name} is not a browser shop tool`);
}

assert.deepEqual([...STOREFRONT_WRITE_TOOLS], ["capture_lead", "generar_pdf"]);
for (const name of ["capture_lead", "generar_pdf", "calcular_cotizacion", "handoff_whatsapp"]) {
  assert.equal(isPublicStorefrontTool(name), true, `${name} is shop-allowed`);
  assert.equal(isStorefrontShopTool(name), false, `${name} runs server-side, not shop_*`);
}

for (const name of ["shop_search", "add_to_cart", "navigate", "present_choices"]) {
  assert.equal(isPublicStorefrontTool(name), true);
  assert.equal(isStorefrontShopTool(name), true);
}

const pack = buildStorefrontVoicePack({ pageUrl: "https://bmcuruguay.com.uy/products/isodec" });
const names = (pack.tools || []).map((t) => t.name || t.type).filter(Boolean);

for (const name of names) {
  if (name === "web_search") {
    assert.fail("web_search must not ship on the public voice pack");
  }
  assert.equal(
    STOREFRONT_TOOL_SET.has(name),
    true,
    `pack tool ${name} is outside STOREFRONT_TOOL_SET`,
  );
}

for (const name of OPERATOR_WRITES) {
  assert.equal(names.includes(name), false, `pack must not expose ${name}`);
}

for (const name of STOREFRONT_READ_TOOLS) {
  assert.ok(names.includes(name), `read tool ${name} in pack`);
}
for (const name of STOREFRONT_WRITE_TOOLS) {
  assert.ok(names.includes(name), `write tool ${name} in pack`);
}
for (const name of STOREFRONT_CLIENT_TOOLS) {
  assert.ok(names.includes(name), `client tool ${name} in pack`);
}

assert.equal(isPublicStorefrontTool(""), false);
assert.equal(isPublicStorefrontTool(null), false);
assert.equal(isStorefrontShopTool(""), false);

console.log("storefrontPublicToolDenyGates.test.js: ok");

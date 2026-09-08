/**
 * POST /action shop_* → HTTP 400 shop_tool_client_only (#1216).
 * Browser tools must not look like a successful server tool (200 + nested error).
 * Complementary to publicVoiceAdmin source-match and open #1142/#1177 HTTP suites.
 * Run: node tests/storefrontShopActionGate.test.js
 */
process.env.PUBLIC_STOREFRONT_VOICE = "1";
process.env.APP_ENV = "development";

const http = (await import("node:http")).default;
const assert = (await import("node:assert/strict")).default;
const express = (await import("express")).default;
const {
  STOREFRONT_SHOP_TOOLS,
  isStorefrontShopTool,
  isPublicStorefrontTool,
} = await import("../server/lib/voice/storefrontVoicePack.js");
const { default: createPublicVoiceRouter, storefrontActionLogPayload } = await import(
  "../server/routes/publicVoice.js"
);
const { config } = await import("../server/config.js");

config.storefrontVoiceEnabled = true;
config.appEnv = "development";
config.storefrontVoiceOrigins = [
  "https://bmcuruguay.com.uy",
  "https://www.bmcuruguay.com.uy",
];

console.log("storefrontShopActionGate");

{
  for (const name of STOREFRONT_SHOP_TOOLS) {
    assert.equal(isStorefrontShopTool(name), true, name);
    assert.equal(isPublicStorefrontTool(name), true, `${name} stays on the public pack`);
  }
  assert.equal(isStorefrontShopTool("handoff_whatsapp"), false, "WA handoff is client, not shop_*");
  assert.equal(isStorefrontShopTool("add_quote_to_cart"), false, "PDF→cart is widget-injected");
  assert.equal(isStorefrontShopTool("calcular_cotizacion"), false);
  assert.equal(isStorefrontShopTool("SHOP_SEARCH"), false, "allowlist is case-sensitive");
  assert.equal(isStorefrontShopTool(" shop_search"), false);
  assert.equal(isStorefrontShopTool(""), false);
}

{
  const withCode = storefrontActionLogPayload("shop_search", 400, { code: "shop_tool_client_only" });
  assert.equal(withCode.code, "shop_tool_client_only");
  const noCode = storefrontActionLogPayload("shop_search", 400, {});
  assert.equal("code" in noCode, false);
  const emptyCode = storefrontActionLogPayload("shop_search", 400, { code: "" });
  assert.equal("code" in emptyCode, false, "empty code is omitted");
  const notObj = storefrontActionLogPayload("shop_search", 400, "shop_tool_client_only");
  assert.equal("code" in notObj, false, "non-object extra is ignored");
  const nullExtra = storefrontActionLogPayload("shop_search", 400, null);
  assert.equal("code" in nullExtra, false);
}

const app = express();
app.use(express.json());
app.use("/api/public/voice", createPublicVoiceRouter());

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;
const SHOP = "https://bmcuruguay.com.uy";

async function postAction(action) {
  const r = await fetch(`${BASE}/api/public/voice/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SHOP },
    body: JSON.stringify({ action }),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json };
}

{
  for (const name of ["shop_search", "add_to_cart", "present_choices", "navigate", "get_cart"]) {
    const r = await postAction({ type: name, payload: { q: "IsoDec" } });
    assert.equal(r.status, 400, `${name} → 400`);
    assert.equal(r.json?.ok, false);
    assert.equal(r.json?.code, "shop_tool_client_only", `${name} stable code`);
    assert.match(String(r.json?.error || ""), /navegador/i);
  }
}

{
  const byName = await postAction({ name: "shop_product", payload: {} });
  assert.equal(byName.status, 400, "action.name alias is also client-only");
  assert.equal(byName.json?.code, "shop_tool_client_only");
}

{
  const op = await postAction({ type: "aplicar_estado_calc", payload: {} });
  assert.equal(op.status, 400, "operator tool stays denied");
  assert.equal(op.json?.code, undefined, "operator deny is not shop_tool_client_only");
  assert.match(String(op.json?.error || ""), /no permitida/i);
}

{
  const quoteCart = await postAction({ type: "add_quote_to_cart", payload: { lines: [] } });
  assert.equal(quoteCart.status, 400);
  assert.equal(
    quoteCart.json?.code,
    undefined,
    "add_quote_to_cart is not in STOREFRONT_SHOP_TOOLS — generic deny",
  );
}

{
  const missing = await postAction(null);
  assert.equal(missing.status, 400);
  assert.match(String(missing.json?.error || ""), /action object required/i);
}

await new Promise((resolve) => server.close(resolve));
console.log("storefrontShopActionGate: ok");

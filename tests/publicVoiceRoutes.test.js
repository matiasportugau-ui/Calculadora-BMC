// Offline HTTP contract for POST /api/public/voice/{session,action}.
// Public shopper surface: origin/flag gates, operator-tool deny, lista web,
// shop tools stay in-browser, capture_lead requires consent.
// Run: node tests/publicVoiceRoutes.test.js

import http from "node:http";
import express from "express";

process.env.PUBLIC_STOREFRONT_VOICE = "1";
process.env.GROK_API_KEY = "xai-" + "y".repeat(48);

const { default: createPublicVoiceRouter } = await import("../server/routes/publicVoice.js");
const { config } = await import("../server/config.js");

if (!config.grokApiKey) config.grokApiKey = process.env.GROK_API_KEY;
config.storefrontVoiceEnabled = true;
config.storefrontVoiceOrigins = [
  "https://bmcuruguay.com.uy",
  "https://www.bmcuruguay.com.uy",
];
config.storefrontWaNumber = "59892663245";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.x.ai/v1/realtime/client_secrets")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "xai-ek_storefront_secret",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        id: "grok_storefront_sess",
        model: "grok-voice-latest",
      }),
    };
  }
  return realFetch(url, init);
};

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

async function req(path, { origin, body, method = "POST" } = {}) {
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
  return { status: r.status, json, headers: r.headers };
}

console.log("\n— publicVoiceRoutes");

const prevEnv = config.appEnv;

{
  config.appEnv = "production";
  config.storefrontVoiceEnabled = false;
  const r = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: { action: { type: "handoff_whatsapp" } },
  });
  assert(r.status === 404 && r.json?.ok === false, "flag off → 404");
  config.storefrontVoiceEnabled = true;
}

{
  config.appEnv = "production";
  const evil = await req("/api/public/voice/action", {
    origin: "https://evil.example",
    body: { action: { type: "handoff_whatsapp" } },
  });
  assert(evil.status === 403 && /Origen/i.test(String(evil.json?.error || "")), "evil origin → 403");

  const empty = await req("/api/public/voice/action", {
    body: { action: { type: "handoff_whatsapp" } },
  });
  assert(empty.status === 403, "production empty origin → 403");
}

{
  config.appEnv = "development";
  const missing = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: {},
  });
  assert(missing.status === 400 && /action object required/i.test(String(missing.json?.error || "")), "missing action → 400");

  const primitive = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: { action: "handoff_whatsapp" },
  });
  assert(primitive.status === 400, "string action → 400 (express body object required)");
}

{
  const denied = [
    "generar_pdf",
    "admin_cargar_pdfs_fila",
    "archivar_pdfs_drive",
    "sheets_write_range",
    "guardar_en_crm",
    "wa_lead_to_admin",
    "enviar_whatsapp_link",
    "aplicar_estado_calc",
  ];
  for (const type of denied) {
    const r = await req("/api/public/voice/action", {
      origin: "https://bmcuruguay.com.uy",
      body: { action: { type, payload: { user_confirmed: true } } },
    });
    assert(
      r.status === 400 && r.json?.ok === false && /no permitida/i.test(String(r.json?.error || "")),
      `operator tool ${type} → 400`,
    );
    assert(r.json?.kind !== "tool", `${type} never kind:tool`);
  }
}

{
  const shop = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: { action: { type: "add_to_cart", payload: { variant_id: 1 } } },
  });
  assert(shop.status === 200 && shop.json?.kind === "tool", "shop tool → 200 kind:tool");
  const parsed = JSON.parse(shop.json.result);
  assert(parsed.ok === false && /navegador/i.test(String(parsed.error || "")), "shop tool stays in browser");
  assert(!/no implementada/i.test(String(parsed.error || "")), "shop tool did not hit executeTool");
}

{
  const wa = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: { action: { type: "handoff_whatsapp", payload: { cliente: "Ana", consulta: "IsoDec 10x8" } } },
  });
  assert(wa.status === 200 && wa.json?.kind === "tool", "handoff → 200");
  const parsed = JSON.parse(wa.json.result);
  assert(parsed.ok === true && String(parsed.url).includes("wa.me/59892663245"), "handoff wa.me BMC number");
  assert(decodeURIComponent(parsed.url).includes("Ana"), "handoff includes name");
}

{
  const noConsent = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: {
      action: {
        type: "capture_lead",
        payload: { cliente: "Juan", telefono: "099123456", consulta: "techo IsoDec 10x8", consent: false },
      },
    },
  });
  assert(noConsent.status === 200 && noConsent.json?.kind === "tool", "no-consent still kind:tool");
  const parsed = JSON.parse(noConsent.json.result);
  assert(parsed.ok === false && /consentimiento/i.test(String(parsed.error || "")), "capture_lead refuses without consent");
}

{
  const short = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: {
      action: {
        type: "capture_lead",
        payload: { cliente: "Juan", telefono: "099123456", consulta: "techo", consent: true },
      },
    },
  });
  const parsed = JSON.parse(short.json.result);
  assert(parsed.ok === false && /consulta/i.test(String(parsed.error || "")), "short consulta refused");
}

{
  const price = await req("/api/public/voice/action", {
    origin: "https://bmcuruguay.com.uy",
    body: {
      action: {
        type: "obtener_precio_panel",
        payload: { familia: "ISODEC_EPS", espesor: 100, lista: "venta" },
      },
    },
  });
  assert(price.status === 200 && price.json?.kind === "tool", "precio panel → tool");
  const parsed = JSON.parse(price.json.result);
  assert(parsed.lista === "web", "forceListaWeb overwrites lista venta");
  assert(parsed.precio_venta === undefined, "stripInternalPrices drops precio_venta");
  assert(parsed.costo === undefined, "stripInternalPrices drops costo");
  assert(typeof parsed.precio_usd_m2_sin_iva === "number", "public web m2 price present");
}

{
  config.appEnv = "development";
  const sess = await req("/api/public/voice/session", {
    origin: "https://bmcuruguay.com.uy",
    body: { pageUrl: "https://bmcuruguay.com.uy/products/isodec" },
  });
  assert(sess.status === 200 && sess.json?.ok === true, "session mint → 200");
  assert(sess.json?.provider === "grok", "session provider grok");
  assert(sess.json?.client_secret?.value === "xai-ek_storefront_secret", "ephemeral secret");
  assert(sess.json?.session_bootstrap?.voice === "rex", "bootstrap voice rex");
  const boot = JSON.stringify(sess.json.session_bootstrap || {});
  assert(boot.includes("isodec"), "pageUrl in bootstrap");
  assert(!/PANELI_MCP_SECRET/i.test(boot), "bootstrap has no MCP secret");
  const names = (sess.json.session_bootstrap?.tools || []).map((t) => t.name || t.type);
  assert(!names.includes("generar_pdf"), "session tools omit generar_pdf");
  assert(!names.includes("admin_cargar_pdfs_fila"), "session tools omit Admin write");
  assert(sess.headers.get("access-control-allow-origin") === "https://bmcuruguay.com.uy", "CORS echoes shop origin");
}

{
  const js = await req("/api/public/voice/session", {
    origin: "https://bmcuruguay.com.uy",
    body: { pageUrl: "javascript:alert(1)" },
  });
  const instr = String(js.json?.session_bootstrap?.instructions || "");
  assert(!instr.includes("javascript:"), "javascript: pageUrl stripped");
}

config.appEnv = prevEnv;
server.close();
globalThis.fetch = realFetch;

console.log(`\npublicVoiceRoutes: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

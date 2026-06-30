// WhatsApp outbound unification — offline. Stubs globalThis.fetch; verifies both
// public senders delegate to the single postWhatsAppMessage core and keep their
// distinct error contracts.
import { postWhatsAppMessage, sendWhatsAppText } from "../server/lib/whatsappOutbound.js";
import { sendWaReply } from "../server/lib/omni/outbound/waReply.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const realFetch = globalThis.fetch;
let lastCall = null;
function stubFetch({ ok = true, status = 200, data = { messages: [{ id: "wamid.X" }] } }) {
  globalThis.fetch = async (url, opts) => {
    lastCall = { url, body: JSON.parse(opts.body) };
    return { ok, status, json: async () => data };
  };
}

const CREDS = { accessToken: "tok", phoneNumberId: "PNID" };
const config = { whatsappAccessToken: "tok", whatsappPhoneNumberId: "PNID" };

try {
  // ── postWhatsAppMessage: single Graph POST shape ──
  stubFetch({ ok: true });
  const core = await postWhatsAppMessage({ to: "+598 91 234 567", text: "hola", ...CREDS });
  assert("core URL targets /v21.0/{pnid}/messages", lastCall.url === "https://graph.facebook.com/v21.0/PNID/messages");
  assert("core normalizes to digits", lastCall.body.to === "59891234567");
  assert("core body is whatsapp text", lastCall.body.messaging_product === "whatsapp" && lastCall.body.type === "text");
  assert("core returns {ok,status,data}", core.ok === true && core.status === 200 && !!core.data);

  // 4096 cap
  stubFetch({ ok: true });
  await postWhatsAppMessage({ to: "598x", text: "a".repeat(5000), ...CREDS });
  assert("core caps body at 4096", lastCall.body.text.body.length === 4096);

  // missing phone / config throws
  let threwPhone = false;
  try { await postWhatsAppMessage({ to: "", text: "x", ...CREDS }); } catch { threwPhone = true; }
  assert("core throws on missing phone", threwPhone);
  let threwCfg = false;
  try { await postWhatsAppMessage({ to: "598", text: "x", accessToken: "", phoneNumberId: "" }); } catch { threwCfg = true; }
  assert("core throws on missing config", threwCfg);

  // ── sendWhatsAppText: throws on !ok, returns data on ok ──
  stubFetch({ ok: true, data: { messages: [{ id: "wamid.OK" }] } });
  const ok1 = await sendWhatsAppText({ to: "59899", text: "hi", ...CREDS });
  assert("sendWhatsAppText returns data on ok", ok1?.messages?.[0]?.id === "wamid.OK");
  stubFetch({ ok: false, status: 400, data: { error: { message: "bad" } } });
  let textThrew = false;
  try { await sendWhatsAppText({ to: "59899", text: "hi", ...CREDS }); }
  catch (e) { textThrew = /WhatsApp API: bad/.test(e.message); }
  assert("sendWhatsAppText THROWS on HTTP error", textThrew);

  // ── sendWaReply: {ok,...} shape + 598 normalization, never throws ──
  stubFetch({ ok: true });
  const r1 = await sendWaReply({ config, toPhone: "091234567", text: "hola" });
  assert("sendWaReply ok → {ok:true,data}", r1.ok === true && !!r1.data);
  assert("sendWaReply applies 598 normalization", lastCall.body.to === "59891234567");

  stubFetch({ ok: false, status: 470, data: { error: { message: "window closed" } } });
  const r2 = await sendWaReply({ config, toPhone: "59899", text: "hola" });
  assert("sendWaReply !ok → {ok:false,status,data}", r2.ok === false && r2.status === 470 && r2.error === "window closed");

  const r3 = await sendWaReply({ config: {}, toPhone: "59899", text: "hola" });
  assert("sendWaReply no creds → whatsapp_not_configured", r3.ok === false && r3.error === "whatsapp_not_configured");

  // network error → caught, not thrown
  globalThis.fetch = async () => { throw new Error("network down"); };
  const r4 = await sendWaReply({ config, toPhone: "59899", text: "hola" });
  assert("sendWaReply network error → {ok:false} (no throw)", r4.ok === false && /network down/.test(r4.error));
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\nwhatsappOutboundUnified: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

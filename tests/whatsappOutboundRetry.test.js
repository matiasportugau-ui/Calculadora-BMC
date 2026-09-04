// WhatsApp outbound retry / error-classification — offline. Stubs globalThis.fetch
// with response sequences and injects a no-op sleep. Run: node tests/whatsappOutboundRetry.test.js
delete process.env.WHATSAPP_GRAPH_API_VERSION;
import {
  DEFAULT_GRAPH_API_VERSION,
  WhatsAppApiError,
  buildMarkReadPayload,
  classifyGraphError,
  defaultSleep,
  markWhatsAppRead,
  postWhatsAppMessage,
  postWhatsAppPayload,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "../server/lib/whatsappOutbound.js";

let passed = 0;
let failed = 0;
function assert(name, condition, actual) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}${actual !== undefined ? ` — got: ${JSON.stringify(actual)}` : ""}`); failed += 1; }
}

const realFetch = globalThis.fetch;
const calls = [];
function stubSeq(seq) {
  calls.length = 0;
  let i = 0;
  globalThis.fetch = async (url, opts) => {
    const r = seq[Math.min(i, seq.length - 1)]; i += 1;
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: r.status < 400, status: r.status, json: async () => r.data ?? {} };
  };
}
const graphErr = (code, message = "err") => ({ error: { message, type: "OAuthException", code, error_data: { details: "d" }, fbtrace_id: "FBT" } });
const CREDS = { accessToken: "tok", phoneNumberId: "PNID" };
const fast = { sleep: async () => {}, jitter: 0 };
const ok = { status: 200, data: { messages: [{ id: "wamid.OK" }] } };

try {
  // ── classification ──
  assert("classify 131030 → recipient_not_allowed (no retry)", (() => { const c = classifyGraphError({ status: 400, data: graphErr(131030) }); return c.kind === "recipient_not_allowed" && !c.retryable && c.fbtraceId === "FBT" && c.details === "d"; })());
  assert("classify 131047 → outside_24h_window", classifyGraphError({ status: 400, data: graphErr(131047) }).kind === "outside_24h_window");
  assert("classify 190 → token_invalid", classifyGraphError({ status: 401, data: graphErr(190) }).kind === "token_invalid");
  assert("classify 131026 → undeliverable", classifyGraphError({ status: 400, data: graphErr(131026) }).kind === "undeliverable");
  assert("classify HTTP 429 (no code) → rate_limited retryable", (() => { const c = classifyGraphError({ status: 429, data: {} }); return c.kind === "rate_limited" && c.retryable; })());
  assert("classify 130429 / 131056 → rate_limited", classifyGraphError({ status: 400, data: graphErr(130429) }).kind === "rate_limited" && classifyGraphError({ status: 400, data: graphErr(131056) }).kind === "rate_limited");
  assert("classify HTTP 503 (empty body) → server_error retryable", (() => { const c = classifyGraphError({ status: 503, data: {} }); return c.kind === "server_error" && c.retryable; })());
  assert("classify 131000 → server_error retryable", classifyGraphError({ status: 500, data: graphErr(131000) }).retryable === true);
  assert("classify HTTP 400 unknown code → unknown, no retry", (() => { const c = classifyGraphError({ status: 400, data: graphErr(100) }); return c.kind === "unknown" && !c.retryable; })());

  // ── retry ──
  stubSeq([{ status: 500 }, { status: 502, data: graphErr(131000) }, ok]);
  let r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: fast });
  assert("500, 502, 200 → ok after 3 attempts", r.ok && r.attempts === 3 && calls.length === 3, { r, calls: calls.length });

  stubSeq([{ status: 500 }, { status: 500 }, { status: 500 }, ok]);
  r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: fast });
  assert("5xx ×3 → gives up after exactly 3 attempts with error.kind server_error", !r.ok && r.status === 500 && r.attempts === 3 && r.error.kind === "server_error" && calls.length === 3, { r, calls: calls.length });

  stubSeq([{ status: 429, data: graphErr(130429, "Rate limit hit") }, ok]);
  r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: fast });
  assert("429 → retried → ok", r.ok && calls.length === 2, calls.length);

  stubSeq([{ status: 500 }, ok]);
  r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: { attempts: 1 } });
  assert("retry.attempts=1 → single call", !r.ok && calls.length === 1, calls.length);

  stubSeq([{ status: 400, data: graphErr(131030) }, ok]);
  r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: fast });
  assert("131030 → not retried", !r.ok && r.error.kind === "recipient_not_allowed" && calls.length === 1, calls.length);

  const logs = [];
  stubSeq([{ status: 401, data: graphErr(190, "Error validating access token") }, ok]);
  r = await postWhatsAppMessage({ to: "59891234567", text: "hi", ...CREDS, retry: fast, logger: { error: (o, m) => logs.push(m), warn() {}, info() {} } });
  assert("190 → not retried, logged at error level with rotation hint", !r.ok && r.error.kind === "token_invalid" && calls.length === 1 && /rotate/.test(logs[0] || ""), { calls: calls.length, logs });

  // ── sendWhatsAppText contract ──
  stubSeq([{ status: 500 }, { status: 500 }, { status: 500 }]);
  let threw = null;
  try { await sendWhatsAppText({ to: "59891234567", text: "hi", ...CREDS, retry: fast }); } catch (e) { threw = e; }
  assert("sendWhatsAppText throws WhatsAppApiError (graphStatus, kind, message prefix)", threw instanceof WhatsAppApiError && threw.graphStatus === 500 && threw.kind === "server_error" && /^WhatsApp API: /.test(threw.message) && threw.status === undefined, { name: threw?.name, msg: threw?.message, status: threw?.status });

  stubSeq([{ status: 400, data: graphErr(131047, "Re-engagement message") }, { status: 200, data: { messages: [{ id: "wamid.TPL" }] } }]);
  r = await sendWhatsAppText({ to: "59891234567", text: "hi", ...CREDS, retry: fast, fallbackTemplate: { name: "hello_world", lang: "en_US" } });
  assert("131047 + fallbackTemplate → template sent once, result flagged fallback", r.fallback === "template" && r.fallback_template === "hello_world" && r.messages[0].id === "wamid.TPL" && calls.length === 2 && calls[1].body.type === "template" && calls[1].body.template.language.code === "en_US", { r, body: calls[1]?.body });

  stubSeq([{ status: 400, data: graphErr(131047) }, ok]);
  threw = null;
  try { await sendWhatsAppText({ to: "59891234567", text: "hi", ...CREDS, retry: fast }); } catch (e) { threw = e; }
  assert("131047 without fallback → throws outside_24h_window, single call", threw?.kind === "outside_24h_window" && calls.length === 1, calls.length);

  stubSeq([{ status: 400, data: graphErr(131047) }, { status: 400, data: graphErr(132001, "Template does not exist") }]);
  threw = null;
  try { await sendWhatsAppText({ to: "59891234567", text: "hi", ...CREDS, retry: fast, fallbackTemplate: { name: "missing" } }); } catch (e) { threw = e; }
  assert("fallback template failure surfaces the template error", threw instanceof WhatsAppApiError && threw.code === 132001, threw?.code);

  // ── payload shapes / version ──
  stubSeq([ok]);
  await postWhatsAppMessage({ to: "+598 91 234 567", text: "hola", contextMessageId: "wamid.IN", ...CREDS });
  assert(`default URL uses ${DEFAULT_GRAPH_API_VERSION}`, calls[0].url === `https://graph.facebook.com/${DEFAULT_GRAPH_API_VERSION}/PNID/messages`, calls[0].url);
  assert("text payload: digits + context.message_id + recipient_type", calls[0].body.to === "59891234567" && calls[0].body.context.message_id === "wamid.IN" && calls[0].body.recipient_type === "individual", calls[0].body);
  stubSeq([ok]);
  await postWhatsAppMessage({ to: "598", text: "x", ...CREDS, version: "v25.0" });
  assert("version override honored", calls[0].url.includes("/v25.0/"), calls[0].url);

  stubSeq([ok]);
  r = await sendWhatsAppTemplate({ to: "598 91", name: "order_update", lang: "es", components: [{ type: "body", parameters: [{ type: "text", text: "123" }] }], ...CREDS });
  assert("sendWhatsAppTemplate builds template payload with components", calls[0].body.type === "template" && calls[0].body.template.name === "order_update" && calls[0].body.template.language.code === "es" && calls[0].body.template.components.length === 1 && r.messages[0].id === "wamid.OK", calls[0].body);
  threw = null;
  try { await sendWhatsAppTemplate({ to: "598", name: "", ...CREDS }); } catch (e) { threw = e; }
  assert("sendWhatsAppTemplate requires name", /template name/.test(threw?.message || ""));

  stubSeq([{ status: 500 }, ok]);
  r = await markWhatsAppRead({ messageId: "wamid.IN", ...CREDS });
  assert("markWhatsAppRead: status=read payload, single attempt, no throw", !r.ok && calls.length === 1 && calls[0].body.status === "read" && calls[0].body.message_id === "wamid.IN", { r, body: calls[0]?.body });
  assert("buildMarkReadPayload shape", JSON.stringify(buildMarkReadPayload({ messageId: "m" })) === JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: "m" }));

  threw = null;
  try { await postWhatsAppPayload({ payload: { to: "", type: "text" }, ...CREDS }); } catch (e) { threw = e; }
  assert("payload with empty `to` throws", /destination/.test(threw?.message || ""));

  // ── abort-aware backoff ──
  const ac = new AbortController();
  stubSeq([{ status: 500 }, { status: 500 }, ok]);
  const p = postWhatsAppMessage({ to: "598", text: "x", ...CREDS, signal: ac.signal, retry: { delaysMs: [500, 500, 500], jitter: 0 } });
  setTimeout(() => ac.abort(new Error("SIGTERM")), 20);
  threw = null;
  try { await p; } catch (e) { threw = e; }
  assert("abort during backoff sleep rejects with AbortError (worker shutdown wins)", threw?.name === "AbortError" && calls.length === 1, { name: threw?.name, calls: calls.length });
  threw = null;
  try { await defaultSleep(1000, AbortSignal.abort()); } catch (e) { threw = e; }
  assert("defaultSleep rejects immediately on an already-aborted signal", threw?.name === "AbortError");
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\nwhatsappOutboundRetry: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

// WhatsApp Cloud API webhook + /whatsapp/send — offline. Spins an express app on
// port 0 with the shared helpers from server/lib/wa/cloudWebhook.js and the
// /whatsapp router; signs payloads with a real HMAC; stubs globalThis.fetch for
// the Graph calls. Run: node tests/whatsappCloudWebhook.test.js
process.env.API_AUTH_TOKEN = "test-auth-token";
delete process.env.NODE_ENV;
delete process.env.APP_ENV;

const crypto = await import("node:crypto");
const { default: express } = await import("express");
const {
  contactNameFor,
  createAutoReplier,
  createSignatureGuard,
  createVerifyHandler,
  flattenWebhook,
  logWebhookEvents,
  messageText,
} = await import("../server/lib/wa/cloudWebhook.js");
const { createWhatsAppCloudRouter } = await import("../server/routes/whatsappCloud.js");
const { WhatsAppApiError } = await import("../server/lib/whatsappOutbound.js");

let passed = 0;
let failed = 0;
function assert(name, condition, actual) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}${actual !== undefined ? ` — got: ${JSON.stringify(actual)}` : ""}`); failed += 1; }
}

const SECRET = "app-secret-test";
const VERIFY = "verify-token-test";
const TOKEN = process.env.API_AUTH_TOKEN;
const silent = { info() {}, warn() {}, error() {} };
const baseCfg = () => ({
  whatsappVerifyToken: VERIFY,
  whatsappAppSecret: SECRET,
  whatsappAccessToken: "tok",
  whatsappPhoneNumberId: "PNID",
  whatsappGraphApiVersion: "v24.0",
  whatsappTestRecipient: "59891234567",
  whatsappSendAllowAny: false,
  whatsappFallbackTemplateName: "",
  whatsappFallbackTemplateLang: "en_US",
});

const sign = (body) => "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
const PATHS = ["/webhooks/whatsapp", "/whatsapp/webhook"];

function buildApp(config) {
  const app = express();
  app.use(PATHS, (req, res, next) => {
    if (req.method !== "POST") return next();
    return express.raw({ type: "application/json", limit: "1mb" })(req, res, next);
  });
  app.use((req, res, next) => (PATHS.includes(req.path) && req.method === "POST" ? next() : express.json()(req, res, next)));
  app.get(PATHS, createVerifyHandler(config));
  app.post(PATHS, createSignatureGuard(config, silent), (req, res) => {
    res.status(200).json({ ok: true, entries: flattenWebhook(req.waBody).length });
  });
  app.use("/whatsapp", createWhatsAppCloudRouter(config, silent));
  return app;
}

async function listen(app) {
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const realFetch = globalThis.fetch;
const calls = [];
function stubFetchSeq(seq) {
  calls.length = 0;
  let i = 0;
  // Only Graph calls are stubbed; the test's own requests to the local server go through.
  globalThis.fetch = async (url, opts) => {
    if (!String(url).startsWith("https://graph.facebook.com/")) return realFetch(url, opts);
    const r = seq[Math.min(i, seq.length - 1)]; i += 1;
    calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    return { ok: r.status < 400, status: r.status, json: async () => r.data ?? {} };
  };
}
const graphErr = (code, message = "err") => ({ error: { message, type: "OAuthException", code, fbtrace_id: "FB1" } });

const PAYLOAD = {
  object: "whatsapp_business_account",
  entry: [{
    id: "WABA1",
    changes: [{
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "15550001111", phone_number_id: "PNID" },
        contacts: [{ profile: { name: "Otro" }, wa_id: "59800000000" }, { profile: { name: "Ana" }, wa_id: "59891234567" }],
        messages: [{ from: "59891234567", id: "wamid.IN1", timestamp: "1757000000", type: "text", text: { body: "Hola, precio panel 100mm?" } }],
      },
    }],
  }],
};

try {
  // ── GET verify ──────────────────────────────────────────────────────────────
  {
    const { server, base } = await listen(buildApp(baseCfg()));
    try {
      for (const p of PATHS) {
        const r = await fetch(`${base}${p}?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`);
        const t = await r.text();
        assert(`GET ${p} handshake → 200 + challenge`, r.status === 200 && t === "12345", { status: r.status, t });
        assert(`GET ${p} handshake is text/plain`, /text\/plain/.test(r.headers.get("content-type") || ""));
      }
      let r = await fetch(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345`);
      assert("GET wrong verify token → 403", r.status === 403, r.status);
      r = await fetch(`${base}/whatsapp/webhook?hub.verify_token=${VERIFY}&hub.challenge=12345`);
      assert("GET missing hub.mode → 403", r.status === 403, r.status);
    } finally { server.close(); }
  }
  {
    const cfg = baseCfg(); cfg.whatsappVerifyToken = "";
    const { server, base } = await listen(buildApp(cfg));
    try {
      const r = await fetch(`${base}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=1`);
      assert("GET with no verify token configured → 403 (empty never matches)", r.status === 403, r.status);
    } finally { server.close(); }
  }

  // ── POST signature guard ───────────────────────────────────────────────────
  {
    const { server, base } = await listen(buildApp(baseCfg()));
    const body = JSON.stringify(PAYLOAD);
    const post = (path, headers, data = body) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: data });
    try {
      let r = await post("/whatsapp/webhook", {});
      assert("POST without X-Hub-Signature-256 → 403", r.status === 403 && (await r.json()).error === "invalid_signature", r.status);
      r = await post("/whatsapp/webhook", { "X-Hub-Signature-256": "sha256=deadbeef" });
      assert("POST with bad signature → 403", r.status === 403, r.status);
      r = await post("/whatsapp/webhook", { "X-Hub-Signature-256": sign(body + " ") });
      assert("POST signature over a different body → 403", r.status === 403, r.status);
      r = await post("/whatsapp/webhook", { "X-Hub-Signature-256": sign(body) });
      const j = await r.json();
      assert("POST with valid HMAC → 200 {ok:true}", r.status === 200 && j.ok === true && j.entries === 1, j);
      r = await post("/webhooks/whatsapp", { "X-Hub-Signature-256": sign(body) });
      assert("POST legacy path /webhooks/whatsapp shares the guard → 200", r.status === 200, r.status);
      const bad = "{not json";
      r = await post("/whatsapp/webhook", { "X-Hub-Signature-256": sign(bad) }, bad);
      assert("POST unparseable JSON with valid HMAC → 200 ack (no retry storm)", r.status === 200, r.status);
    } finally { server.close(); }
  }
  {
    const cfg = baseCfg(); cfg.whatsappAppSecret = "";
    const { server, base } = await listen(buildApp(cfg));
    try {
      const body = JSON.stringify(PAYLOAD);
      const r = await fetch(`${base}/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sign(body) }, body });
      const j = await r.json();
      assert("POST with no app secret configured (non-test env) → 403, never accepted", r.status === 403 && j.error === "webhook_secret_not_configured", { status: r.status, j });
    } finally { server.close(); }
  }

  // ── flattenWebhook / helpers ───────────────────────────────────────────────
  {
    const multi = {
      entry: [
        { id: "A", changes: [{ field: "messages", value: { metadata: { phone_number_id: "P1" }, messages: [{ id: "m1", from: "1", type: "text", text: { body: "x" } }] } }, { field: "account_update", value: { foo: 1 } }] },
        { id: "B", changes: [{ field: "messages", value: { metadata: { phone_number_id: "P2" }, statuses: [{ id: "s1", status: "read" }] } }] },
      ],
    };
    const flat = flattenWebhook(multi);
    assert("flattenWebhook iterates all entries/changes with field=messages", flat.length === 2 && flat[0].phoneNumberId === "P1" && flat[1].statuses.length === 1, flat.map((f) => f.phoneNumberId));
    assert("flattenWebhook tolerates garbage", flattenWebhook(null).length === 0 && flattenWebhook({ entry: "x" }).length === 0);
    const v = PAYLOAD.entry[0].changes[0].value;
    assert("contactNameFor matches contact by wa_id (not contacts[0])", contactNameFor(v, v.messages[0]) === "Ana", contactNameFor(v, v.messages[0]));
    assert("contactNameFor falls back to number", contactNameFor({ contacts: [] }, { from: "5989" }) === "5989");
    assert("messageText: text body / image caption / button title", messageText({ text: { body: "a" } }) === "a" && messageText({ image: { caption: "c" } }) === "c" && messageText({ interactive: { button_reply: { title: "Sí" } } }) === "Sí");

    const lines = [];
    const log = { info: (obj, msg) => lines.push({ obj, msg }) };
    const longText = "z".repeat(300);
    const counts = logWebhookEvents(log, flattenWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "P" }, messages: [{ id: "m", from: "1", type: "text", text: { body: longText } }], statuses: [{ id: "s", status: "delivered", pricing: { billable: true } }] } }] }] }));
    const msgLine = lines.find((l) => l.obj.event === "wa_inbound_message");
    const stLine = lines.find((l) => l.obj.event === "wa_status");
    assert("logWebhookEvents logs one line per message and status + summary", counts.messages === 1 && counts.statuses === 1 && lines.length === 3, counts);
    assert("logWebhookEvents truncates text preview (≤121 chars) and never logs the full body", msgLine.obj.text_preview.length <= 121 && !JSON.stringify(lines).includes(longText));
    assert("logWebhookEvents carries status + pricing", stLine.obj.status === "delivered" && stLine.obj.pricing.billable === true);
  }

  // ── createAutoReplier ──────────────────────────────────────────────────────
  {
    const sent = []; const read = [];
    const mk = (cfgOver = {}, deps = {}) => createAutoReplier({
      config: { whatsappAutoReplyEnabled: true, whatsappAutoReplyMode: "ack", whatsappAutoReplyText: "Recibido", whatsappAutoReplyCooldownMs: null, whatsappAutoReplyAgentTimeoutMs: 1000, ...cfgOver },
      logger: silent,
      sendText: async (o) => { sent.push(o); return { messages: [{ id: "wamid.OUT" }] }; },
      markRead: async (o) => { read.push(o); return { ok: true }; },
      ...deps,
    });
    const v = PAYLOAD.entry[0].changes[0].value;
    const msg = v.messages[0];

    let r = await mk({ whatsappAutoReplyEnabled: false })(msg, v);
    assert("autoReply disabled → skipped", r.sent === false && r.skipped_reason === "disabled", r);

    const ack = mk();
    r = await ack(msg, v);
    assert("ack mode sends the configured text quoting the inbound wamid", r.sent === true && r.wamid === "wamid.OUT" && sent[0].to === "59891234567" && sent[0].text === "Recibido" && sent[0].contextMessageId === "wamid.IN1", r);
    assert("ack mode marks the inbound as read first", read.length === 1 && read[0].messageId === "wamid.IN1");
    r = await ack(msg, v);
    assert("same wamid again → duplicate (in-memory)", r.skipped_reason === "duplicate", r);
    r = await ack({ ...msg, id: "wamid.IN2" }, v, { isDuplicate: true });
    assert("isDuplicate from DB rowCount=0 → duplicate", r.skipped_reason === "duplicate", r);
    r = await ack({ ...msg, id: "wamid.IN3" }, v);
    assert("ack mode default cooldown (1h) → second text from same sender skipped", r.skipped_reason === "cooldown", r);
    r = await ack({ ...msg, id: "wamid.IN4", from: "59800000000" }, v);
    assert("different sender inside cooldown → replied", r.sent === true, r);
    r = await ack({ ...msg, id: "wamid.IN5", from: "15550001111" }, v);
    assert("message from own number → own_number", r.skipped_reason === "own_number", r);
    r = await ack({ ...msg, id: "wamid.IN6", from: "59811111111", type: "image", text: undefined }, v);
    assert("non-text message → not_text", r.skipped_reason === "not_text", r);
    r = await ack({ from: "5989" }, v);
    assert("malformed message → malformed", r.skipped_reason === "malformed", r);

    const noCd = mk({ whatsappAutoReplyCooldownMs: 0 });
    await noCd(msg, v); r = await noCd({ ...msg, id: "wamid.IN7" }, v);
    assert("cooldown override 0 → consecutive replies allowed", r.sent === true, r);

    const before = sent.length;
    r = await mk({ whatsappAutoReplyCooldownMs: 0 }, { markRead: async () => { throw new Error("131030 read fail"); } })(msg, v);
    assert("markRead failure does not block the reply", r.sent === true && sent.length === before + 1, r);

    const apiErr = new WhatsAppApiError("WhatsApp API: nope", { graphStatus: 400, code: 131030, kind: "recipient_not_allowed" });
    r = await mk({ whatsappAutoReplyCooldownMs: 0 }, { sendText: async () => { throw apiErr; } })(msg, v);
    assert("send failure → sent:false with Meta kind/code, never throws", r.sent === false && r.skipped_reason === "send_failed" && r.kind === "recipient_not_allowed" && r.code === 131030, r);

    const agent = mk({ whatsappAutoReplyMode: "agent" }, { callAgentOnce: async (messages, opts) => ({ text: `Panelin: ${messages[0].content}`, provider: "stub", channel: opts.channel }) });
    r = await agent(msg, v);
    assert("agent mode replies with callAgentOnce text (channel wa)", r.sent === true && r.mode === "agent" && r.fallback === null && sent.at(-1).text === "Panelin: Hola, precio panel 100mm?", { r, last: sent.at(-1) });
    r = await agent({ ...msg, id: "wamid.IN8" }, v);
    assert("agent mode default cooldown 0 → every question answered", r.sent === true, r);
    r = await mk({ whatsappAutoReplyMode: "agent" }, { callAgentOnce: () => new Promise(() => {}) })(msg, v);
    assert("agent timeout → falls back to ack text", r.sent === true && r.fallback === "ack" && sent.at(-1).text === "Recibido", r);
    r = await mk({ whatsappAutoReplyMode: "agent" }, { callAgentOnce: async () => { throw new Error("llm down"); } })(msg, v);
    assert("agent error → falls back to ack text", r.sent === true && r.fallback === "ack", r);
    r = await mk({ whatsappAutoReplyMode: "agent", whatsappAutoReplyText: "" }, { callAgentOnce: async () => ({ text: "" }) })(msg, v);
    assert("agent empty + no ack text → empty_reply (nothing sent)", r.sent === false && r.skipped_reason === "empty_reply", r);
  }

  // ── POST /whatsapp/send ────────────────────────────────────────────────────
  {
    const cfg = baseCfg();
    const { server, base } = await listen(buildApp(cfg));
    const send = (body, headers = { Authorization: `Bearer ${TOKEN}` }) => fetch(`${base}/whatsapp/send`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    try {
      let r = await send({ text: "hi" }, {});
      assert("POST /whatsapp/send without token → 401", r.status === 401, r.status);
      r = await send({}, { "x-api-key": TOKEN });
      assert("POST /whatsapp/send without text/template → 400", r.status === 400 && (await r.json()).error === "text_or_template_required", r.status);
      r = await send({ to: "59899999999", text: "hi" });
      assert("POST /whatsapp/send to a non-test recipient → 400 recipient_not_allowed", r.status === 400 && (await r.json()).error === "recipient_not_allowed", r.status);

      stubFetchSeq([{ status: 200, data: { messaging_product: "whatsapp", contacts: [{ input: "59891234567", wa_id: "59891234567" }], messages: [{ id: "wamid.SENT1", message_status: "accepted" }] } }]);
      r = await send({ text: "hola" });
      let j = await r.json();
      assert("POST /whatsapp/send defaults `to` to WHATSAPP_TEST_RECIPIENT and returns the wamid", r.status === 200 && j.ok && j.message_id === "wamid.SENT1" && j.to === "59891234567" && j.wa_id === "59891234567", j);
      assert("Graph call targets v24.0/{PNID}/messages with Bearer + text body", calls[0].url === "https://graph.facebook.com/v24.0/PNID/messages" && calls[0].headers.Authorization === "Bearer tok" && calls[0].body.type === "text" && calls[0].body.text.body === "hola", calls[0]);

      stubFetchSeq([{ status: 400, data: graphErr(131030, "(#131030) Recipient phone number not in allowed list") }]);
      r = await send({ to: "+598 91 234 567", text: "hola" });
      j = await r.json();
      assert("131030 → 422 recipient_not_allowed with portal hint, no retry", r.status === 422 && j.error === "recipient_not_allowed" && j.code === 131030 && /API Setup/.test(j.hint) && calls.length === 1, { status: r.status, j, calls: calls.length });

      stubFetchSeq([{ status: 400, data: graphErr(131047, "Re-engagement message") }]);
      r = await send({ text: "hola" });
      j = await r.json();
      assert("131047 without fallback template → 422 outside_24h_window", r.status === 422 && j.error === "outside_24h_window" && calls.length === 1, { status: r.status, j });

      stubFetchSeq([{ status: 401, data: graphErr(190, "Error validating access token") }]);
      r = await send({ text: "hola" });
      j = await r.json();
      assert("190 → 401 token_invalid, no retry", r.status === 401 && j.error === "token_invalid" && calls.length === 1, { status: r.status, j });

      stubFetchSeq([{ status: 500, data: {} }, { status: 503, data: {} }, { status: 200, data: { messages: [{ id: "wamid.RETRY" }] } }]);
      // speed: override retry delays via env-free path is not exposed on the route; 500→503→200 takes ~2s of real backoff
      r = await send({ text: "hola" });
      j = await r.json();
      assert("5xx twice then 200 → 200 after 3 attempts (backoff applied)", r.status === 200 && j.message_id === "wamid.RETRY" && calls.length === 3, { status: r.status, j, calls: calls.length });

      stubFetchSeq([{ status: 200, data: { messages: [{ id: "wamid.TPL" }] } }]);
      r = await send({ template: { name: "hello_world", lang: "en_US" } });
      j = await r.json();
      assert("template body → type template", r.status === 200 && calls[0].body.type === "template" && calls[0].body.template.name === "hello_world" && j.message_id === "wamid.TPL", calls[0]?.body);
    } finally { server.close(); globalThis.fetch = realFetch; }
  }
  {
    const cfg = baseCfg(); cfg.whatsappFallbackTemplateName = "hello_world"; cfg.whatsappSendAllowAny = true;
    const { server, base } = await listen(buildApp(cfg));
    try {
      stubFetchSeq([{ status: 400, data: graphErr(131047, "window") }, { status: 200, data: { messages: [{ id: "wamid.FALLBACK" }] } }]);
      const r = await fetch(`${base}/whatsapp/send`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ to: "59877777777", text: "hola" }) });
      const j = await r.json();
      assert("131047 with WHATSAPP_FALLBACK_TEMPLATE_NAME → template sent, fallback flagged", r.status === 200 && j.message_id === "wamid.FALLBACK" && j.fallback === "template" && calls.length === 2 && calls[1].body.type === "template", { status: r.status, j });
      assert("WHATSAPP_SEND_ALLOW_ANY=1 accepts other recipients", calls[0].body.to === "59877777777");
    } finally { server.close(); globalThis.fetch = realFetch; }
  }
  {
    const cfg = baseCfg(); cfg.whatsappAccessToken = ""; cfg.whatsappPhoneNumberId = "";
    const { server, base } = await listen(buildApp(cfg));
    try {
      const r = await fetch(`${base}/whatsapp/send`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ text: "hola" }) });
      const j = await r.json();
      assert("no Graph creds → 503 whatsapp_not_configured listing missing vars", r.status === 503 && j.missing.length === 2, j);
    } finally { server.close(); }
  }
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\nwhatsappCloudWebhook: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
